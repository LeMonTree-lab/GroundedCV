/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  DEEPSEEK_API_KEY?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

type TrialRecord = { token: string; expiresAt: number };
const MAX_MONTHLY_TRIALS = 10;
const TRIAL_TTL_MS = 30 * 60 * 1000;
const fallbackTrials = new Map<string, TrialRecord>();
const fallbackMonthly = new Map<string, number>();

function json(body: unknown, status = 200, request?: Request) {
  const origin = request?.headers.get("Origin");
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Headers": "Content-Type, x-groundedcv-device, x-groundedcv-trial-token",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Vary: "Origin",
    },
  });
}

function monthKey() { return new Date().toISOString().slice(0, 7); }
function validDeviceId(value: unknown): value is string { return typeof value === "string" && value.length >= 8 && value.length <= 120; }

async function prepareUsageTable(db?: D1Database) {
  if (!db) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS groundedcv_trial_usage (
    usage_key TEXT PRIMARY KEY,
    month TEXT NOT NULL,
    sessions INTEGER NOT NULL DEFAULT 0,
    token TEXT,
    token_expires_at INTEGER,
    updated_at TEXT NOT NULL
  )`).run();
}

async function startTrial(request: Request, env: Env) {
  const body = await request.json().catch(() => ({})) as { deviceId?: unknown };
  if (!validDeviceId(body.deviceId)) return json({ message: "试用设备标识无效，请刷新页面后重试。" }, 400, request);
  const deviceId = body.deviceId;
  const month = monthKey();
  const now = Date.now();
  const token = crypto.randomUUID();
  try {
    if (env.DB) {
      await prepareUsageTable(env.DB);
      const deviceKey = `device:${deviceId}`;
      const existing = await env.DB.prepare("SELECT token, token_expires_at FROM groundedcv_trial_usage WHERE usage_key = ?").bind(deviceKey).first<{ token?: string; token_expires_at?: number }>();
      if (existing?.token && Number(existing.token_expires_at) > now) return json({ trialToken: existing.token }, 200, request);
      if (existing) return json({ code: "DEVICE_LIMIT", message: "本设备的免费试用次数已用完，请在 AI 设置中填入自己的 DeepSeek Key。" }, 429, request);
      const monthKeyValue = `month:${month}`;
      const monthly = await env.DB.prepare("SELECT sessions FROM groundedcv_trial_usage WHERE usage_key = ?").bind(monthKeyValue).first<{ sessions?: number }>();
      const used = Number(monthly?.sessions ?? 0);
      if (used >= MAX_MONTHLY_TRIALS) return json({ code: "MONTH_LIMIT", message: "本月公开试用额度已用完，请稍后再试或填入自己的 DeepSeek Key。" }, 429, request);
      await env.DB.batch([
        env.DB.prepare("INSERT INTO groundedcv_trial_usage (usage_key, month, sessions, token, token_expires_at, updated_at) VALUES (?, ?, 1, ?, ?, ?)").bind(deviceKey, month, token, now + TRIAL_TTL_MS, new Date().toISOString()),
        monthly ? env.DB.prepare("UPDATE groundedcv_trial_usage SET sessions = sessions + 1, updated_at = ? WHERE usage_key = ?").bind(new Date().toISOString(), monthKeyValue) : env.DB.prepare("INSERT INTO groundedcv_trial_usage (usage_key, month, sessions, updated_at) VALUES (?, ?, 1, ?)").bind(monthKeyValue, month, new Date().toISOString()),
      ]);
      return json({ trialToken: token, remaining: Math.max(0, MAX_MONTHLY_TRIALS - used - 1) }, 200, request);
    }
  } catch {
    // Fall through to the isolate-local fallback when no D1 binding is available.
  }
  const existing = fallbackTrials.get(deviceId);
  if (existing && existing.expiresAt > now) return json({ trialToken: existing.token }, 200, request);
  if (existing) return json({ code: "DEVICE_LIMIT", message: "本设备的免费试用次数已用完，请在 AI 设置中填入自己的 DeepSeek Key。" }, 429, request);
  const used = fallbackMonthly.get(month) ?? 0;
  if (used >= MAX_MONTHLY_TRIALS) return json({ code: "MONTH_LIMIT", message: "本月公开试用额度已用完，请稍后再试或填入自己的 DeepSeek Key。" }, 429, request);
  fallbackTrials.set(deviceId, { token, expiresAt: now + TRIAL_TTL_MS });
  fallbackMonthly.set(month, used + 1);
  return json({ trialToken: token, remaining: Math.max(0, MAX_MONTHLY_TRIALS - used - 1) }, 200, request);
}

async function validTrial(deviceId: string, token: string, env: Env) {
  const now = Date.now();
  try {
    if (env.DB) {
      await prepareUsageTable(env.DB);
      const row = await env.DB.prepare("SELECT token, token_expires_at FROM groundedcv_trial_usage WHERE usage_key = ?").bind(`device:${deviceId}`).first<{ token?: string; token_expires_at?: number }>();
      return Boolean(row?.token && row.token === token && Number(row.token_expires_at) > now);
    }
  } catch { /* use fallback */ }
  const row = fallbackTrials.get(deviceId);
  return Boolean(row && row.token === token && row.expiresAt > now);
}

function parseModelJson(content: string) {
  const clean = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("模型返回格式无法解析");
  return JSON.parse(clean.slice(start, end + 1));
}

async function proxyAi(request: Request, env: Env) {
  if (!env.DEEPSEEK_API_KEY) return json({ message: "公开试用尚未配置服务端 AI，请稍后再试或填入自己的 DeepSeek Key。" }, 503, request);
  const body = await request.json().catch(() => ({})) as { deviceId?: unknown; trialToken?: unknown; system?: unknown; user?: unknown; model?: unknown };
  if (!validDeviceId(body.deviceId) || typeof body.trialToken !== "string" || !(await validTrial(body.deviceId, body.trialToken, env))) return json({ code: "TRIAL_INVALID", message: "试用会话已失效，请刷新页面重新开始。" }, 403, request);
  if (typeof body.system !== "string" || typeof body.user !== "string" || body.system.length + body.user.length > 100_000) return json({ message: "请求内容过长，请减少简历或岗位文字后重试。" }, 400, request);
  const upstream = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.DEEPSEEK_API_KEY.trim()}` },
    body: JSON.stringify({ model: body.model === "deepseek-v4-pro" ? "deepseek-v4-pro" : "deepseek-v4-flash", stream: false, temperature: 0.2, max_tokens: 1800, thinking: { type: "disabled" }, response_format: { type: "json_object" }, messages: [{ role: "system", content: body.system }, { role: "user", content: body.user }] }),
  });
  const data = await upstream.json().catch(() => ({})) as { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }> };
  if (!upstream.ok) return json({ message: "公开试用的 AI 服务暂时不可用，请稍后再试或填入自己的 DeepSeek Key。" }, 502, request);
  const raw = data.choices?.[0]?.message?.content;
  const content = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.map((item) => item.text ?? "").join("") : "";
  try { return json({ data: parseModelJson(content) }, 200, request); } catch { return json({ message: "模型返回格式无法解析，请稍后重试。" }, 502, request); }
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/trial/start") {
      if (request.method === "OPTIONS") return json({}, 204, request);
      if (request.method !== "POST") return json({ message: "Method Not Allowed" }, 405, request);
      return startTrial(request, env);
    }
    if (url.pathname === "/api/ai") {
      if (request.method === "OPTIONS") return json({}, 204, request);
      if (request.method !== "POST") return json({ message: "Method Not Allowed" }, 405, request);
      return proxyAi(request, env);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
