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

export type JobTarget = {
  company: string;
  title: string;
  description: string;
};

export type GroundedProject = {
  id: string;
  mode: "example" | "personal";
  sourceName: string;
  sourceText: string;
  candidateName: string;
  experiences: Experience[];
  job: JobTarget;
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

export function createSampleProject(): GroundedProject {
  return {
    id: "sample-dewu",
    mode: "example",
    sourceName: "匿名示例简历",
    sourceText: "GroundedCV 内置匿名示例",
    candidateName: "林舟",
    experiences: structuredClone(SAMPLE_EXPERIENCES),
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
  /^(教育经历|教育背景|工作经历|实习经历|项目经历|校园经历|实践经历|获奖经历|荣誉奖项|专业技能|技能证书|个人总结|自我评价)[：:]?$/;

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
    .filter((section) => section.lines.length);

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
