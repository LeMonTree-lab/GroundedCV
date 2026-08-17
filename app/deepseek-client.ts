import { resumeSection, type Experience, type Fact, type FactAsset, type GroundedProject, type ResumeClaim, type SemanticJobRequirement } from "./product-model";

export type AiSettings = {
  apiKey: string;
  model: "deepseek-v4-flash" | "deepseek-v4-pro";
};

type ChatResponse = { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>; error?: { message?: string } };

function requireKey(settings: AiSettings) {
  if (!settings.apiKey.trim()) throw new Error("请先在「AI 设置」中填入 DeepSeek API Key。");
}

function parseJsonPayload<T>(content: string): T {
  const clean = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end < start) throw new SyntaxError("未找到 JSON 对象");
  return JSON.parse(clean.slice(start, end + 1)) as T;
}

async function requestJson<T>(settings: AiSettings, system: string, user: string): Promise<T> {
  requireKey(settings);
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.apiKey.trim()}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: settings.model,
        stream: false,
        temperature: 0.2,
        max_tokens: 2200,
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
      });
      const data = await response.json() as ChatResponse;
      if (!response.ok) throw new Error(data.error?.message || `DeepSeek 请求失败（${response.status}）`);
      const raw = data.choices?.[0]?.message?.content;
      const content = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.map((item) => item.text ?? "").join("") : "";
      if (!content.trim()) throw new Error("DeepSeek 本次返回空内容");
      return parseJsonPayload<T>(content);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("AI 请求失败");
      if (lastError instanceof DOMException && lastError.name === "AbortError") break;
    } finally {
      window.clearTimeout(timer);
    }
  }
  if (lastError instanceof DOMException && lastError.name === "AbortError") throw new Error("请求超时，请检查网络后重试。");
  if (lastError instanceof SyntaxError) throw new Error("模型两次都返回了无法解析的格式，请稍后重试。");
  throw new Error(lastError?.message === "DeepSeek 本次返回空内容" ? "DeepSeek 连续两次返回空内容，请稍后再试或切换 deepseek-v4-pro。" : lastError?.message ?? "AI 请求失败。");
}

export async function splitExperienceWithAi(settings: AiSettings, rawText: string): Promise<Array<Pick<Fact, "text" | "type">>> {
  const data = await requestJson<{ facts?: Array<{ text?: string; type?: string }> }>(
    settings,
    `你是简历事实核查助手。把用户的经历文本拆成可逐项确认的原子事实。必须输出 json。
规则：
1. 不补充原文没有的数字、工具、职责、结果或因果关系。
2. 每条只表达一个可核实主张；数字、成果和方法尽量分开。
3. type 只能是：行动、方法、工具、数字 / 结果、协作、项目状态、其他。
4. 保留原文事实，不润色成夸大的简历句。
输出：{"facts":[{"text":"...","type":"行动"}]}`,
    `请拆解以下真实经历：\n${rawText}`,
  );
  const facts = (data.facts ?? [])
    .map((fact) => ({ text: String(fact.text ?? "").trim(), type: String(fact.type ?? "其他").trim() }))
    .filter((fact) => fact.text.length >= 4)
    .slice(0, 16);
  if (!facts.length) throw new Error("没有识别到可确认事实，请改用换行手动拆分。");
  return facts;
}

export async function analyzeJobFitWithAi(settings: AiSettings, job: GroundedProject["job"], experiences: Array<Experience | FactAsset>): Promise<SemanticJobRequirement[]> {
  const facts = experiences.flatMap((experience) => experience.facts.map((fact) => ({
    id: fact.id, text: fact.text, type: fact.type, status: fact.status, experience: experience.title,
  })));
  const data = await requestJson<{ requirements?: Array<Partial<SemanticJobRequirement>> }>(
    settings,
    `你是求职证据匹配助手。把岗位 JD 拆成能力单元，并只依据用户事实库进行语义匹配。必须输出 json。
规则：
1. level 只能为 covered、transferable、partial、missing。
2. covered：确认事实直接支持；transferable：能力/方法相近但业务场景不同；partial：有相关动作但缺关键证据；missing：没有证据。
3. factIds 只能引用输入中的事实 ID，且 covered / transferable 只能引用 status=confirmed 的事实。
4. 不得把“用户旅程”说成“内部业务流程优化”，不得把概念项目说成正式上线。
5. safeExpression 必须是可写入简历的安全表达；missing 时留空。followUp 是用户可回答的具体补充问题；只有 partial 时填写。
输出：{"requirements":[{"id":"JD01","text":"...","type":"核心任务","level":"transferable","factIds":["F101"],"reason":"...","safeExpression":"...","followUp":"..."}]}`,
    JSON.stringify({ job, facts }),
  );
  const validIds = new Map(facts.map((fact) => [fact.id, fact]));
  return (data.requirements ?? []).slice(0, 14).flatMap((item, index) => {
    const level = ["covered", "transferable", "partial", "missing"].includes(String(item.level)) ? item.level as SemanticJobRequirement["level"] : "missing";
    const factIds = [...new Set((item.factIds ?? []).filter((id): id is string => typeof id === "string" && validIds.has(id)))];
    const validForLevel = level === "partial" ? factIds : factIds.filter((id) => validIds.get(id)?.status === "confirmed");
    return [{
      id: String(item.id ?? `JD${String(index + 1).padStart(2, "0")}`),
      text: String(item.text ?? "").trim(),
      type: String(item.type ?? "岗位要求").trim(),
      level: validForLevel.length || level === "missing" ? level : "missing",
      factIds: validForLevel,
      reason: String(item.reason ?? "当前事实库暂无足够证据。").trim(),
      safeExpression: String(item.safeExpression ?? "").trim(),
      followUp: String(item.followUp ?? "").trim(),
    } satisfies SemanticJobRequirement].filter((item) => item.text.length >= 4);
  });
}

type AiClaim = { experienceId?: string; text?: string; facts?: string[]; risk?: "low" | "medium" };

export async function rewriteResumeWithAi(settings: AiSettings, project: GroundedProject): Promise<ResumeClaim[]> {
  const confirmed = [...project.experiences, ...(project.assets ?? [])].map((experience) => ({
    id: experience.id,
    title: experience.title,
    meta: experience.meta,
    category: experience.category,
    forbidden: experience.forbidden,
    facts: experience.facts.filter((fact) => fact.status === "confirmed").map((fact) => ({ id: fact.id, text: fact.text, type: fact.type })),
  })).filter((experience) => experience.facts.length);
  if (!confirmed.length) throw new Error("请先确认至少一条事实，再生成简历。");
  const data = await requestJson<{ claims?: AiClaim[] }>(
    settings,
    `你是中文求职简历编辑。根据 JD 为候选人生成简历 bullet，但必须严格受事实库约束，输出 json。
规则：
1. 只能使用输入 confirmed facts 的信息；不得新增数字、技能、工具、职责范围、项目上线状态、用户量或因果关系。
2. 每条 claim 必须给出所有支撑它的 facts ID；facts 只能引用同一个 experienceId 的 ID。
3. 每个输入记录只要有确认事实，必须至少生成 1 条；尤其“项目经历、项目经验、实践经历、校园经历”绝不能遗漏。优先选择与 JD 最相关的内容，将同一记录中 1-3 条确认事实组织为完整 bullet，体现行动、方法或产出；每条 28-90 个中文字符。
4. 可以把相近经历迁移到 JD 语言中，但必须用保守措辞（如“参与、协助、基于…整理、完成…材料”），不能把学习、竞赛、课程或设计基础改写成正式上线、独立负责或已有业务结果。
5. 原事实中含数字、增长、上线、主导、推动等高风险内容时 risk 写 medium；否则 low。
6. 不支持的 JD 能力不要硬写。
输出：{"claims":[{"experienceId":"EXP-01","text":"...","facts":["F101"],"risk":"low"}]}`,
    JSON.stringify({ job: project.job, experiences: confirmed }),
  );
  const sourceById = new Map([...project.experiences, ...(project.assets ?? [])].map((experience) => [experience.id, experience]));
  return (data.claims ?? []).flatMap((item, index) => {
    const experience = sourceById.get(String(item.experienceId ?? ""));
    const text = String(item.text ?? "").trim();
    const facts = [...new Set((item.facts ?? []).filter((id) => experience?.facts.some((fact) => fact.id === id && fact.status === "confirmed")))];
    if (!experience || text.length < 8 || !facts.length) return [];
    const section = resumeSection(experience.category);
    const sourceText = facts.map((id) => experience.facts.find((fact) => fact.id === id)?.text ?? "").join(" ");
    return [{
      id: `AI${String(index + 1).padStart(2, "0")}`,
      experienceId: experience.id,
      experienceTitle: experience.title,
      experienceMeta: experience.meta,
      section,
      text,
      facts,
      jd: [],
      risk: item.risk === "medium" || /\d|%|主导|推动|上线|提升/.test(sourceText) ? "medium" : "low",
    } satisfies ResumeClaim];
  });
}
