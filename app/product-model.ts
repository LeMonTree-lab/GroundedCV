export type FactStatus = "pending" | "confirmed" | "uncertain" | "rejected";

export type Fact = {
  id: string;
  text: string;
  type: string;
  status: FactStatus;
  source: string;
};

export type Experience = {
  id: string;
  title: string;
  meta: string;
  category: string;
  facts: Fact[];
  forbidden: string[];
};

export type FactAsset = {
  id: string;
  title: string;
  category: "技能卡" | "教育与研究卡" | "获奖/证书卡" | "作品与链接卡";
  meta: string;
  facts: Fact[];
  forbidden: string[];
};

/** A single fact-library record.  Experience cards and supporting assets share
 * one collection so they have the same provenance, confirmation and guardrail
 * rules, while retaining their distinct resume sections. */
export type FactRecord = Experience | FactAsset;

export type JobTarget = {
  company: string;
  title: string;
  description: string;
};

export type SemanticJobRequirement = {
  id: string;
  text: string;
  type: string;
  level: "covered" | "transferable" | "partial" | "missing";
  factIds: string[];
  reason: string;
  safeExpression: string;
  followUp: string;
};

export type ResumeClaim = {
  id: string;
  experienceId: string;
  experienceTitle: string;
  experienceMeta: string;
  section: "工作经历" | "项目经历" | "教育与研究" | "技能" | "奖项/证书" | "作品与链接" | "其他经历";
  text: string;
  facts: string[];
  jd: string[];
  risk: "low" | "medium";
};

export type InterviewResponse = {
  claimId: string;
  riskId: string;
  answers: string[];
  completedAt?: string;
};

export type ClaimRevision = {
  id: string;
  claimId: string;
  riskId: string;
  action: "keep" | "weaken" | "delete";
  beforeText: string;
  afterText?: string;
  reason: string;
  appliedAt: string;
};

export type GeneratedResume = {
  generatedAt: string;
  candidateName: string;
  targetTitle: string;
  claims: ResumeClaim[];
  confirmedFactCount: number;
  includedExperienceCount: number;
  interviewResponses: InterviewResponse[];
  revisions: ClaimRevision[];
};

export type GroundedProject = {
  id: string;
  mode: "example" | "personal";
  sourceName: string;
  sourceText: string;
  candidateName: string;
  /** Current unified fact-asset library. */
  factAssets: FactRecord[];
  /** @deprecated Kept only so projects saved before the library refactor load safely. */
  experiences?: Experience[];
  /** @deprecated Kept only so projects saved before the library refactor load safely. */
  assets?: FactAsset[];
  job: JobTarget;
  jobAnalysis?: SemanticJobRequirement[];
  resume?: GeneratedResume;
  updatedAt: string;
};

export const PROJECT_STORAGE_KEY = "groundedcv.project.v1";

export function isExperienceAsset(record: FactRecord): record is Experience {
  return /工作|实习|项目|校园|实践|其他经历/.test(record.category);
}

/** Reads both the new unified storage and older browser-local projects. */
export function getFactAssets(project: GroundedProject): FactRecord[] {
  return Array.isArray(project.factAssets)
    ? project.factAssets
    : [...(project.experiences ?? []), ...(project.assets ?? [])];
}

export function normalizeGroundedProject(project: GroundedProject): GroundedProject {
  const current = { ...project };
  delete current.experiences;
  delete current.assets;
  return { ...current, factAssets: getFactAssets(project) };
}

export const DEWU_JOB: JobTarget = {
  company: "上海得物信息集团有限公司",
  title: "内部 AI 工具产品实习生",
  description:
    "参与内部AI工具的需求调研、竞品分析与产品方案设计，协助梳理内部业务流程，挖掘可通过AI提效的场景，输出需求文档；跟进产品开发过程，协调研发、设计等角色，推动功能按期上线；收集用户反馈，整理使用数据，协助产品迭代优化；关注AI工具类产品动态，定期输出竞品调研与趋势分析。了解LLM、Prompt、Agent、Skill等概念，使用过Codex、Claude等AI工具，具备Vibe Coding能力。",
};

export const SAMPLE_EXPERIENCES: Experience[] = [
  {
    id: "EXP-02",
    title: "城市规划设计机构 · 工作经历",
    meta: "规划设计师｜3 年｜某城市规划设计研究机构",
    category: "工作经历",
    facts: [
      { id: "F102", text: "通过政府部门、行业专家和居民访谈开展需求调研", type: "方法", status: "pending", source: "原简历 · 工作经历第 1 条" },
      { id: "F103", text: "累计整理 500+ 条需求", type: "数字", status: "pending", source: "原简历 · 工作经历第 1 条" },
      { id: "F104", text: "形成需求池并进行优先级划分", type: "行动", status: "confirmed", source: "原简历 · 工作经历第 1 条" },
      { id: "F108", text: "协调政府、专家和业务单位开展需求评审", type: "协作", status: "confirmed", source: "原简历 · 工作经历第 3 条" },
    ],
    forbidden: ["不得将规划方案通过审批表述为软件功能上线", "不得将参与多个项目概括为独立主导全部项目"],
  },
  {
    id: "EXP-03",
    title: "AI 未来办公场景 · 概念项目",
    meta: "产品设计成员｜概念验证｜数字艺术设计赛事金奖",
    category: "项目经历",
    facts: [
      { id: "F202", text: "梳理社交平台 1000+ 条公开评价数据", type: "数字 / 行动", status: "uncertain", source: "原简历 · 项目经历第 1 条" },
      { id: "F203", text: "提炼情绪支持、灵感激发等需求", type: "结果", status: "confirmed", source: "原简历 · 项目经历第 1 条" },
      { id: "F205", text: "设计灵感仓、逻辑仓和共生仓等功能模块", type: "产品设计", status: "confirmed", source: "原简历 · 项目经历第 2 条" },
      { id: "F206", text: "使用 Gemini、ChatGPT 等工具完成概念验证与视觉设计", type: "工具", status: "pending", source: "原简历 · 项目经历第 3 条" },
    ],
    forbidden: ["不得表述为已上线 AI 产品", "不得推断拥有真实活跃用户或生产级 Agent"],
  },
  {
    id: "EXP-04",
    title: "Citywalk 步行友好街道 · 用户研究",
    meta: "专题项目｜公开内容分析｜产品模式设计",
    category: "项目经历",
    facts: [
      { id: "F302", text: "收集并分析抖音、小红书等平台公开内容", type: "方法", status: "confirmed", source: "原简历 · 项目经历第 1 条" },
      { id: "F303", text: "提炼 800+ 热门 POI 并形成热力图", type: "数字 / 结果", status: "pending", source: "原简历 · 项目经历第 1 条" },
      { id: "F305", text: "建立用户画像并梳理用户旅程", type: "产品方法", status: "confirmed", source: "原简历 · 项目经历第 2 条" },
      { id: "F307", text: "设计 3 类 Citywalk 产品模式", type: "方案", status: "pending", source: "原简历 · 项目经历第 3 条" },
    ],
    forbidden: ["不得将 POI 数量称为用户样本量", "不得虚构上线后的用户体验提升"],
  },
];

export const SAMPLE_ASSETS: FactAsset[] = [
  { id: "AST-01", title: "工具与技能", category: "技能卡", meta: "个人确认的工具能力", facts: [
    { id: "F901", text: "使用 Figma 完成产品原型设计", type: "工具 / 技能", status: "confirmed", source: "个人技能" },
    { id: "F902", text: "具备 Python、SQL 基础", type: "工具 / 技能", status: "confirmed", source: "个人技能" },
  ], forbidden: ["不得将基础能力表述为生产级开发能力"] },
  { id: "AST-02", title: "教育与研究方向", category: "教育与研究卡", meta: "硕士在读", facts: [
    { id: "F903", text: "研究方向涉及 LLM、Agent 与城市仿真", type: "研究方向", status: "confirmed", source: "教育背景" },
  ], forbidden: ["不得将研究方向表述为已发表成果或商业项目经验"] },
  { id: "AST-03", title: "奖项与认可", category: "获奖/证书卡", meta: "项目成果", facts: [
    { id: "F904", text: "AI 未来办公场景项目获得数字艺术设计赛事金奖", type: "获奖", status: "confirmed", source: "获奖经历" },
  ], forbidden: ["不得将赛事奖项表述为商业客户认可"] },
];

export function createSampleProject(): GroundedProject {
  return {
    id: "sample-dewu",
    mode: "example",
    sourceName: "匿名示例简历",
    sourceText: "GroundedCV 内置匿名示例",
    candidateName: "林舟",
    factAssets: [...structuredClone(SAMPLE_EXPERIENCES), ...structuredClone(SAMPLE_ASSETS)],
    job: { ...DEWU_JOB },
    updatedAt: new Date().toISOString(),
  };
}

function cleanLine(line: string) {
  return line
    .replace(/^[\s•·●▪■◆◇\-—–*]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferFactType(text: string) {
  if (/\d|%|万|千|百|余/.test(text)) return "数字 / 结果";
  if (/负责|参与|主导|协调|推动|设计|完成|建立|梳理|分析|调研/.test(text)) return "行动";
  if (/Figma|Axure|Python|SQL|ChatGPT|Claude|Codex|Gemini|Agent|LLM/i.test(text)) return "工具 / 技能";
  return "经历事实";
}

const SECTION_LABELS = ["教育经历", "教育背景", "研究方向", "工作经历", "工作经验", "实习经历", "实习经验", "项目经历", "项目经验", "科研经历", "科研项目", "校园经历", "学生工作", "社团经历", "志愿服务", "实践经历", "社会实践", "竞赛经历", "获奖经历", "荣誉奖项", "专业技能", "技能证书", "语言能力", "作品集", "作品链接", "个人作品", "个人总结", "自我评价", "基本信息", "个人信息"];
const SECTION_NAMES = SECTION_LABELS.join("|");

const ASSET_CATEGORIES: Record<string, FactAsset["category"]> = {
  "专业技能": "技能卡", "技能证书": "技能卡", "教育经历": "教育与研究卡", "教育背景": "教育与研究卡",
  "研究方向": "教育与研究卡", "获奖经历": "获奖/证书卡", "荣誉奖项": "获奖/证书卡",
  "语言能力": "技能卡",
  "作品集": "作品与链接卡", "作品链接": "作品与链接卡", "个人作品": "作品与链接卡",
  "自我评价": "技能卡", "个人总结": "技能卡",
  "基本信息": "教育与研究卡", "个人信息": "教育与研究卡",
};

const EXPERIENCE_SECTION_CATEGORY: Record<string, string> = {
  "工作经历": "工作经历", "工作经验": "工作经历",
  "实习经历": "实习经历", "实习经验": "实习经历",
  "项目经历": "项目经历", "项目经验": "项目经历", "科研经历": "项目经历", "科研项目": "项目经历", "竞赛经历": "项目经历",
  "校园经历": "校园经历", "学生工作": "校园经历", "社团经历": "校园经历", "志愿服务": "校园经历",
  "实践经历": "实践经历", "社会实践": "实践经历",
};

const EXPERIENCE_SECTIONS = new Set(Object.keys(EXPERIENCE_SECTION_CATEGORY));

function canonicalSection(category: string) {
  return EXPERIENCE_SECTION_CATEGORY[category] ?? category;
}

/** Personal profile data can be useful in the original file, but it is not
 * evidence for a role and must never become an experience card or a claim. */
function isProfileOnlyLine(text: string) {
  return /(?:^|[｜|，,\s])(年龄|性别|出生(?:年月|日期)?|籍贯|民族|婚姻|政治面貌|身高|体重|现居地|户籍|身份证|手机号?|电话|邮箱|微信|QQ)(?:[：:｜|，,\s]|$)/i.test(text)
    || /\b\d{11}\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(text);
}

function isLanguageScoreLine(text: string) {
  return /(?:CET[- ]?[46]|大学英语[四五六]级|雅思|IELTS|托福|TOEFL|TEM[- ]?[48]|英语[四六]级|PTE|GRE|GMAT)/i.test(text);
}

function needsConfirmation(text: string) {
  // A source-clear fact should be auto-collected. Ask only when wording could
  // materially overstate personal ownership, ability level or business impact.
  // Dates, language scores and named awards alone are not treated as risky.
  return /主导|独立(?:负责|完成|推进)|全权|牵头|领导|推动.*(?:上线|落地)|上线|增长|提升|降低|转化|GMV|营收|ROI|TOP|排名前|熟练|精通|专家|负责.*(?:全程|整体)|从0到1|从零到一/i.test(text)
    || (/[；;]/.test(text) && text.split(/[；;]/).filter(Boolean).length >= 3);
}

function importedStatus(text: string): FactStatus {
  return needsConfirmation(text) ? "pending" : "confirmed";
}

function resumeSections(text: string) {
  // PDF extraction often loses the newline around a section heading. Restore it
  // before parsing so a project section is not swallowed by profile text.
  const normalizedText = text.replace(new RegExp(`(${SECTION_NAMES})(?=[：:]|\\n|\\s+第?\\d+(?:页)?\\b)`, "g"), "\n$1\n");
  const rawLines = normalizedText
    .split(/\r?\n/)
    .map(cleanLine)
    // Page counters such as "3" or "第 3 页" are frequently extracted as content.
    // They must not become facts or alter a section heading.
    .filter((line) => Boolean(line) && !/^(?:第?\d+|第?\d+页)$/.test(line));
  const sections: Array<{ category: string; lines: string[] }> = [];
  let current = { category: "其他信息", lines: [] as string[] };
  const push = () => {
    const lines = current.lines.filter((line) => line.length >= 3);
    if (lines.length) sections.push({ ...current, lines });
  };
  for (const rawLine of rawLines) {
    const line = cleanLine(rawLine);
    const sectionLabel = SECTION_LABELS.find((label) => {
      return new RegExp(`^(?:第?\\d+[、.．]\\s*)?${label}(?:[：:]|\\s+第?\\d+(?:页)?|\\s*)`, "i").test(line);
    });
    if (sectionLabel) {
      const remainder = line
        .replace(new RegExp(`^(?:第?\\d+[、.．]\\s*)?${sectionLabel}(?:[：:]|\\s+第?\\d+(?:页)?)?\\s*`, "i"), "")
        .trim();
      push();
      current = { category: canonicalSection(sectionLabel), lines: remainder ? [remainder] : [] };
      continue;
    }
    current.lines.push(line);
  }
  push();
  return sections;
}

function inferTitle(category: string, lines: string[], index: number) {
  const candidate = lines.find((line) => line.length <= 45 && !isProfileOnlyLine(line) && !isLanguageScoreLine(line) && !/^(时间|职责|内容|描述)[：:]/.test(line));
  if (!candidate) return `${category} ${index + 1}`;
  // A single long paragraph is a fact, not a card title.
  return candidate.length <= 34 ? candidate : `${category} ${index + 1}`;
}

function looksLikeExperienceTitle(line: string) {
  return line.length >= 4
    && line.length <= 42
    && !/[。；;，,：:]/.test(line)
    && !isProfileOnlyLine(line)
    && !isLanguageScoreLine(line)
    && !/^(负责|参与|协助|完成|使用|熟悉|掌握|获奖|时间|职责|内容|描述|年龄|性别|英语)/.test(line);
}

function splitExperienceSection(section: { category: string; lines: string[] }) {
  // A project section can contain several short titles followed by descriptions.
  // Keep them as separate cards rather than flattening them into one card.
  const blocks: string[][] = [];
  let current: string[] = [];
  section.lines.forEach((line, index) => {
    const next = section.lines[index + 1] ?? "";
    const startsNewBlock = looksLikeExperienceTitle(line) && (next.length >= 6 || index === section.lines.length - 1);
    if (startsNewBlock && current.length) {
      blocks.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  });
  if (current.length) blocks.push(current);
  return blocks.length > 1 ? blocks : [section.lines];
}

function categoryLooksLikeExperience(category: string, lines: string[]) {
  if (EXPERIENCE_SECTIONS.has(category)) return true;
  return /项目|实习|实践|课题|竞赛|系统|平台|调研|设计/.test(category)
    && lines.filter((line) => !isProfileOnlyLine(line) && !isLanguageScoreLine(line)).length >= 2;
}

export function experiencesFromResumeText(text: string, sourceName: string): Experience[] {
  const usefulSections = resumeSections(text)
    .filter((section) => section.lines.length)
    .filter((section) => !ASSET_CATEGORIES[section.category])
    .filter((section) => categoryLooksLikeExperience(section.category, section.lines));

  const blocks = usefulSections.flatMap((section) => splitExperienceSection(section).map((lines) => ({ category: canonicalSection(section.category), lines })));
  return blocks.slice(0, 8).map((section, sectionIndex) => {
    const title = inferTitle(section.category, section.lines, sectionIndex);
    const factLines = section.lines
      .filter((line) => line !== title || section.lines.length === 1)
      .filter((line) => !isProfileOnlyLine(line) && !isLanguageScoreLine(line))
      .filter((line) => line.length >= 6)
      .slice(0, 12);
    return {
      id: `EXP-${String(sectionIndex + 1).padStart(2, "0")}`,
      title,
      meta: `${section.category}｜来自 ${sourceName}`,
      category: section.category,
      facts: factLines.map((line, factIndex) => ({
        id: `F${sectionIndex + 1}${String(factIndex + 1).padStart(2, "0")}`,
        text: line,
        type: inferFactType(line),
        status: importedStatus(line),
        source: `${sourceName} · ${section.category}第 ${factIndex + 1} 条`,
      })),
      forbidden: ["不得新增原文中不存在的数字、工具、职责范围和项目结果"],
    };
  });
}

export function assetsFromResumeText(text: string, sourceName: string): FactAsset[] {
  const sections = resumeSections(text);
  const groups = sections
    .filter((section) => ASSET_CATEGORIES[section.category])
    .map((section) => ({ category: section.category, lines: section.lines }))
    // Text before the first recognised heading is usually personal information.
    .concat(sections.filter((section) => section.category === "其他信息").map((section) => ({ category: "个人信息", lines: section.lines })));
  return groups.map((group, index) => ({
    id: `AST-${String(index + 1).padStart(2, "0")}`,
    title: group.category,
    category: ASSET_CATEGORIES[group.category],
    meta: `来自 ${sourceName}`,
    // Contact details, age and other identity data are deliberately not made into
    // resume claims. Language scores may remain a skill asset, but never a card
    // title or an experience fact.
    facts: group.lines
      .filter((text) => !isProfileOnlyLine(text))
      .slice(0, 12)
      .map((text, factIndex) => ({ id: `FA${index + 1}${String(factIndex + 1).padStart(2, "0")}`, text, type: inferFactType(text), status: importedStatus(text), source: `${sourceName} · ${group.category}` })),
    forbidden: ["不得新增原文中不存在的技能等级、证书状态或奖项影响力"],
  })).filter((asset) => asset.facts.length);
}

export function createPersonalProject(
  text: string,
  sourceName: string,
): GroundedProject {
  const firstLine = cleanLine(text.split(/\r?\n/).find(Boolean) ?? "");
  const inlineName = text.match(/([\u4e00-\u9fa5·]{2,8})\s*(?:电话|手机|邮箱)[:：]?/);
  const candidateName = /^[\u4e00-\u9fa5·]{2,8}$/.test(firstLine)
    ? firstLine
    : inlineName?.[1] ?? "我的简历";

  return {
    id: `project-${Date.now()}`,
    mode: "personal",
    sourceName,
    sourceText: text,
    candidateName,
    factAssets: [...experiencesFromResumeText(text, sourceName), ...assetsFromResumeText(text, sourceName)],
    job: { company: "", title: "", description: "" },
    updatedAt: new Date().toISOString(),
  };
}

export function createEmptyProject(): GroundedProject {
  return createPersonalProject(
    "请在经历卡中添加你的第一段经历",
    "手动创建",
  );
}

const MATCH_TERMS = [
  "需求", "调研", "用户", "产品", "方案", "原型", "流程", "数据", "分析",
  "AI", "LLM", "Prompt", "Agent", "Skill", "Codex", "Figma", "SQL", "Python",
  "协作", "协调", "评审", "迭代", "测试", "上线", "竞品", "运营",
];

export function resumeSection(category: string): ResumeClaim["section"] {
  if (/工作|实习/.test(category)) return "工作经历";
  if (/项目|实践|校园/.test(category)) return "项目经历";
  if (category === "技能卡") return "技能";
  if (category === "教育与研究卡") return "教育与研究";
  if (category === "获奖/证书卡") return "奖项/证书";
  if (category === "作品与链接卡") return "作品与链接";
  return "其他经历";
}

function matchingJdIds(text: string, job: JobTarget) {
  const requirements = job.description
    .split(/[\n；;。]/)
    .flatMap((item) => item.length > 45 ? item.split(/[，,]/) : [item])
    .map((item) => item.trim())
    .filter((item) => item.length >= 5)
    .slice(0, 12);
  const terms = MATCH_TERMS.filter((term) => text.toLowerCase().includes(term.toLowerCase()));
  return requirements
    .map((requirement, index) => ({ requirement, id: `JD${String(index + 1).padStart(2, "0")}` }))
    .filter(({ requirement }) => terms.some((term) => requirement.toLowerCase().includes(term.toLowerCase())))
    .map(({ id }) => id)
    .slice(0, 3);
}

export function generateGroundedResume(project: GroundedProject): GeneratedResume {
  const records = getFactAssets(project);
  const confirmedExperiences = records
    .map((experience) => ({
      experience,
      facts: experience.facts.filter((fact) => fact.status === "confirmed"),
    }))
    .filter((item) => item.facts.length > 0)
    .sort((left, right) => {
      const score = (item: typeof left) =>
        item.facts.reduce((total, fact) => total + matchingJdIds(fact.text, project.job).length, 0);
      return score(right) - score(left);
    });

  const claims: ResumeClaim[] = confirmedExperiences.flatMap(({ experience, facts }, experienceIndex) => {
    // Keep complete records visible: group facts in pairs instead of rendering a
    // sparse one-fact-per-line draft. The connector only joins already-confirmed
    // facts and introduces no new outcome, tool, responsibility or number.
    const groups = facts.slice(0, 6).reduce<Fact[][]>((items, fact, index) => {
      const groupIndex = Math.floor(index / 3);
      (items[groupIndex] ??= []).push(fact);
      return items;
    }, []);
    return groups.map((group, factIndex) => ({
      id: `C${String(experienceIndex + 1).padStart(2, "0")}${factIndex + 1}`,
      experienceId: experience.id,
      experienceTitle: experience.title,
      experienceMeta: experience.meta,
      section: resumeSection(experience.category),
      text: group.map((fact) => fact.text.replace(/[。；;]+$/, "")).join("；"),
      facts: group.map((fact) => fact.id),
      jd: [...new Set(group.flatMap((fact) => matchingJdIds(fact.text, project.job)))],
      risk: group.some((fact) => /\d|%|提升|推动|主导|上线/.test(fact.text)) ? "medium" : "low",
    }));
  });

  return {
    generatedAt: new Date().toISOString(),
    candidateName: project.candidateName,
    targetTitle: project.job.title || "目标岗位待填写",
    claims,
    confirmedFactCount: confirmedExperiences.reduce((total, item) => total + item.facts.length, 0),
    includedExperienceCount: confirmedExperiences.length,
    interviewResponses: [],
    revisions: [],
  };
}
