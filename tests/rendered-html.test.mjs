import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the GroundedCV product shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>GroundedCV｜可信简历实验室<\/title>/i);
  assert.match(html, /把每一句简历/);
  assert.match(html, /上传 PDF \/ DOCX/);
  assert.match(html, /粘贴简历文字/);
  assert.match(html, /先看匿名示例/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});

test("keeps the seven-stage product flow in the client app", async () => {
  const app = await readFile(new URL("../app/GroundedCVApp.tsx", import.meta.url), "utf8");
  const model = await readFile(new URL("../app/product-model.ts", import.meta.url), "utf8");
  for (const label of ["经历事实库", "目标岗位", "岗位化简历", "Claim 风险", "面试追问", "反向修改", "最终报告"]) {
    assert.match(app, new RegExp(label));
  }
  assert.match(app, /R01/);
  assert.match(app, /F102/);
  assert.match(app, /navigator\.clipboard/);
  assert.match(app, /window\.print/);
  assert.match(app, /upsertExperience/);
  assert.match(app, /PROJECT_STORAGE_KEY/);
  assert.match(app, /先生成事实草稿/);
  assert.match(app, /generateGroundedResume/);
  assert.match(app, /AI 按岗位改写/);
  assert.match(app, /AI 拆解为原子事实/);
  assert.match(app, /function inspectResume/);
  assert.match(app, /AI 语义匹配/);
  assert.match(app, /可迁移/);
  assert.match(app, /当前项目的事实来源与表述对照/);
  assert.match(app, /saveInterviewResponse/);
  assert.match(app, /applyClaimRevision/);
  assert.match(app, /本次项目实际做了什么改变/);
  assert.match(app, /setAiSettings\(\{ apiKey: "", model: "deepseek-v4-flash" \}\)/);
  assert.match(model, /export function generateGroundedResume/);
  assert.match(model, /fact\.status === "confirmed"/);
  assert.match(model, /includedExperienceCount/);
  assert.match(model, /interviewResponses/);
  assert.match(model, /ClaimRevision/);
});

test("keeps DeepSeek keys in the current page session", async () => {
  const client = await readFile(new URL("../app/deepseek-client.ts", import.meta.url), "utf8");
  assert.match(client, /https:\/\/api\.deepseek\.com\/chat\/completions/);
  assert.match(client, /response_format: \{ type: "json_object" \}/);
  assert.match(client, /splitExperienceWithAi/);
  assert.match(client, /rewriteResumeWithAi/);
  assert.match(client, /analyzeJobFitWithAi/);
  assert.doesNotMatch(client, /localStorage|sessionStorage/);
});

test("supports real resume entry points", async () => {
  const start = await readFile(new URL("../app/StartScreen.tsx", import.meta.url), "utf8");
  const parser = await readFile(new URL("../app/file-parser.ts", import.meta.url), "utf8");
  assert.match(start, /parseResumeFile/);
  assert.match(start, /createPersonalProject/);
  assert.match(parser, /pdfjs-dist/);
  assert.match(parser, /mammoth/);
  assert.match(parser, /扫描件/);
});

test("treats skills and credentials as traceable fact assets", async () => {
  const app = await readFile(new URL("../app/GroundedCVApp.tsx", import.meta.url), "utf8");
  const model = await readFile(new URL("../app/product-model.ts", import.meta.url), "utf8");
  for (const label of ["技能卡", "教育与研究卡", "获奖/证书卡", "作品与链接卡"]) assert.match(model, new RegExp(label));
  assert.match(model, /assetsFromResumeText/);
  assert.match(model, /"教育与研究" \| "技能" \| "奖项\/证书" \| "作品与链接"/);
  assert.match(model, /category === "技能卡"/);
  assert.match(app, /其他事实资产/);
  assert.match(app, /\.\.\.assets/);
});
