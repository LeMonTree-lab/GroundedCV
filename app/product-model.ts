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
  section: "工作经历" | "项目经历" | "其他经历";
  text: string;
  facts: string[];
  jd: string[];
  risk: "low" | "medium";
};

export type GeneratedResume = {
  generatedAt: string;
  candidateName: string;
  targetTitle: string;
  claims: ResumeClaim[];
  confirmedFactCount: number;
  includedExperienceCount: number;
};

export type GroundedProject = {
  id: string;
  mode: "example" | "personal";
  sourceName: string;
  sourceText: string;
  candidateName: string;
  experiences: Experience[];
  assets: FactAsset[];
  job: JobTarget;
  jobAnalysis?: SemanticJobRequirement[];
  resume?: GeneratedResume;
  updatedAt: string;
};

export const PROJECT_STORAGE_KEY = "groundedcv.project.v1";

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
    experiences: structuredClone(SAMPLE_EXPERIENCES),
    assets: structuredClone(SAMPLE_ASSETS),
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

const SECTION_PATTERN =
  /^(教育经历|教育背景|研究方向|工作经历|实习经历|项目经历|校园经历|实践经历|获奖经历|荣誉奖项|专业技能|技能证书|作品集|作品链接|个人作品|个人总结|自我评价)[：:]?$/;

const ASSET_CATEGORIES: Record<string, FactAsset["category"]> = {
  "专业技能": "技能卡", "技能证书": "技能卡", "教育经历": "教育与研究卡", "教育背景": "教育与研究卡",
  "研究方向": "教育与研究卡", "获奖经历": "获奖/证书卡", "荣誉奖项": "获奖/证书卡",
  "作品集": "作品与链接卡", "作品链接": "作品与链接卡", "个人作品": "作品与链接卡",
};

export function experiencesFromResumeText(text: string, sourceName: string): Experience[] {
  const lines = text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);

  const sections: Array<{ category: string; lines: string[] }> = [];
  let current = { category: "简历经历", lines: [] as string[] };

  for (const line of lines) {
    const heading = line.match(SECTION_PATTERN);
    if (heading) {
      if (current.lines.length) sections.push(current);
      current = { category: heading[1], lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.length) sections.push(current);

  const usefulSections = sections
    .map((section) => ({
      ...section,
      lines: section.lines.filter((line) => line.length >= 5),
    }))
    .filter((section) => section.lines.length)
    .filter((section) => !ASSET_CATEGORIES[section.category]);

  if (!usefulSections.length) {
    return [
      {
        id: "EXP-01",
        title: "导入的简历内容",
        meta: sourceName,
        category: "简历经历",
        facts: [
          {
            id: "F001",
            text: "暂未识别到可确认的经历描述，请点击“编辑经历”补充。",
            type: "待补充",
            status: "pending",
            source: sourceName,
          },
        ],
        forbidden: ["不得根据缺失信息推断职责、数字、技能或结果"],
      },
    ];
  }

  return usefulSections.slice(0, 8).map((section, sectionIndex) => {
    const titleCandidate = section.lines[0];
    const factLines = section.lines
      .slice(titleCandidate.length <= 32 ? 1 : 0)
      .filter((line) => line.length >= 8)
      .slice(0, 12);
    const normalizedFacts = factLines.length ? factLines : section.lines.slice(0, 8);

    return {
      id: `EXP-${String(sectionIndex + 1).padStart(2, "0")}`,
      title: titleCandidate.length <= 32 ? titleCandidate : `${section.category} ${sectionIndex + 1}`,
      meta: `${section.category}｜来自 ${sourceName}`,
      category: section.category,
      facts: normalizedFacts.map((line, factIndex) => ({
        id: `F${sectionIndex + 1}${String(factIndex + 1).padStart(2, "0")}`,
        text: line,
        type: inferFactType(line),
        status: "pending" as FactStatus,
        source: `${sourceName} · ${section.category}第 ${factIndex + 1} 条`,
      })),
      forbidden: ["不得新增原文中不存在的数字、工具、职责范围和项目结果"],
    };
  });
}

export function assetsFromResumeText(text: string, sourceName: string): FactAsset[] {
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const groups: Array<{ category: string; lines: string[] }> = [];
  let category = "";
  for (const line of lines) {
    const heading = line.match(SECTION_PATTERN)?.[1];
    if (heading) { category = heading; continue; }
    if (ASSET_CATEGORIES[category] && line.length >= 3) {
      const latest = groups.find((group) => group.category === category);
      if (latest) latest.lines.push(line); else groups.push({ category, lines: [line] });
    }
  }
  return groups.map((group, index) => ({
    id: `AST-${String(index + 1).padStart(2, "0")}`,
    title: group.category,
    category: ASSET_CATEGORIES[group.category],
    meta: `来自 ${sourceName}`,
    facts: group.lines.slice(0, 12).map((text, factIndex) => ({ id: `FA${index + 1}${String(factIndex + 1).padStart(2, "0")}`, text, type: inferFactType(text), status: "pending" as FactStatus, source: `${sourceName} · ${group.category}` })),
    forbidden: ["不得新增原文中不存在的技能等级、证书状态或奖项影响力"],
  }));
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
    experiences: experiencesFromResumeText(text, sourceName),
    assets: assetsFromResumeText(text, sourceName),
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

function resumeSection(category: string): ResumeClaim["section"] {
  if (/工作|实习/.test(category)) return "工作经历";
  if (/项目|实践|校园/.test(category)) return "项目经历";
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
  const records = [...project.experiences, ...(project.assets ?? [])];
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

  const claims: ResumeClaim[] = confirmedExperiences.flatMap(({ experience, facts }, experienceIndex) =>
    facts.slice(0, 4).map((fact, factIndex) => ({
      id: `C${String(experienceIndex + 1).padStart(2, "0")}${factIndex + 1}`,
      experienceId: experience.id,
      experienceTitle: experience.title,
      experienceMeta: experience.meta,
      section: resumeSection(experience.category),
      text: fact.text,
      facts: [fact.id],
      jd: matchingJdIds(fact.text, project.job),
      risk: /\d|%|提升|推动|主导|上线/.test(fact.text) ? "medium" : "low",
    })),
  );

  return {
    generatedAt: new Date().toISOString(),
    candidateName: project.candidateName,
    targetTitle: project.job.title || "目标岗位待填写",
    claims,
    confirmedFactCount: confirmedExperiences.reduce((total, item) => total + item.facts.length, 0),
    includedExperienceCount: confirmedExperiences.length,
  };
}
