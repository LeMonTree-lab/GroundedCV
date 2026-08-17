"use client";

import { useEffect, useMemo, useState } from "react";
import StartScreen from "./StartScreen";
import { analyzeJobFitWithAi, rewriteResumeWithAi, splitExperienceWithAi, type AiSettings } from "./deepseek-client";
import {
  PROJECT_STORAGE_KEY,
  createSampleProject,
  generateGroundedResume,
  type Experience,
  type FactAsset,
  type Fact,
  type FactStatus,
  type GroundedProject,
  type InterviewResponse,
  type ClaimRevision,
  type JobTarget,
  type ResumeClaim,
  type SemanticJobRequirement,
} from "./product-model";

const STEPS = [
  ["01", "经历事实库", "确认 AI 能使用的事实"],
  ["02", "目标岗位", "拆解 JD 与事实覆盖"],
  ["03", "岗位化简历", "生成整份可追溯简历"],
  ["04", "Claim 风险", "发现夸大与无依据表述"],
  ["05", "面试追问", "验证每条 Claim 能否自证"],
  ["06", "反向修改", "弱化或删除不可信内容"],
  ["07", "最终报告", "导出可信投递版本"],
];

const statusLabel: Record<FactStatus, string> = {
  pending: "待确认",
  confirmed: "已确认",
  uncertain: "不确定",
  rejected: "不采用",
};

const REQUIREMENTS = [
  { id: "JD01", text: "内部 AI 工具需求调研", type: "核心任务", level: "covered", facts: "F102 · F202", reason: "有访谈与公开评价分析经历" },
  { id: "JD02", text: "AI 工具竞品分析", type: "核心任务", level: "missing", facts: "暂无事实", reason: "原简历未出现明确竞品分析案例" },
  { id: "JD03", text: "产品方案设计", type: "核心任务", level: "covered", facts: "F205 · F307", reason: "有功能模块及产品模式设计" },
  { id: "JD04", text: "梳理内部业务流程", type: "核心任务", level: "partial", facts: "F104 · F305", reason: "有需求池和用户旅程，但不是内部流程" },
  { id: "JD05", text: "挖掘 AI 提效场景", type: "核心任务", level: "partial", facts: "F201 · F204", reason: "有 AI 办公概念，落地流程待确认" },
  { id: "JD06", text: "输出需求文档", type: "交付能力", level: "unknown", facts: "F111 · F309", reason: "有报告产出，缺少明确 PRD 案例" },
  { id: "JD08", text: "协调研发、设计等角色", type: "协作能力", level: "partial", facts: "F108", reason: "有跨角色协调，但角色构成不同" },
  { id: "JD09", text: "推动功能按期上线", type: "结果要求", level: "missing", facts: "暂无事实", reason: "规划审批不等于软件功能上线" },
  { id: "RQ04", text: "了解 LLM、Prompt、Agent、Skill", type: "AI 基础", level: "partial", facts: "F004 · F206", reason: "研究方向和工具实践支持部分概念" },
  { id: "PF04", text: "使用 AI 编程工具完成 Demo", type: "加分项", level: "missing", facts: "待 GroundedCV 完成", reason: "当前不能把未完成项目提前写入简历" },
];

const coverageLabel: Record<string, string> = {
  covered: "已覆盖",
  transferable: "可迁移",
  partial: "部分覆盖",
  missing: "未覆盖",
  unknown: "信息不足",
};

const RESUME_CLAIMS = [
  { id: "C01", section: "工作经历", text: "参与多类城市规划项目的需求分析，通过多方访谈整理需求并形成需求池，依据影响范围与实施条件完成优先级划分。", facts: ["F102", "F104"], jd: ["JD01", "JD04"], risk: "low" },
  { id: "C02", section: "工作经历", text: "协调政府、专家与业务单位开展需求评审，跟进 10+ 轮方案优化并推动项目通过评审。", facts: ["F108", "F109", "F110"], jd: ["JD08"], risk: "medium" },
  { id: "C03", section: "项目经历", text: "围绕 AI 与创意工作者协同场景，分析 1000+ 条公开评价，提炼情绪支持与灵感激发需求。", facts: ["F202", "F203"], jd: ["JD01", "JD05"], risk: "medium" },
  { id: "C04", section: "项目经历", text: "设计灵感仓、逻辑仓与共生仓等功能模块，使用 Gemini、ChatGPT 完成概念验证与视觉设计。", facts: ["F205", "F206"], jd: ["JD03", "RQ04"], risk: "low" },
];

const RISKS = [
  { id: "R01", claim: "C02", severity: "high", type: "因果夸大", phrase: "推动项目通过评审", reason: "事实只支持参与方案优化及项目最终通过评审，不能确认个人行为与结果存在直接因果。", suggestion: "参与 10+ 轮方案优化，相关项目最终通过专家评审。" },
  { id: "R02", claim: "C03", severity: "medium", type: "数字待核实", phrase: "分析 1000+ 条公开评价", reason: "数字来自原简历，但事实卡仍标记为不确定，需要确认统计口径和来源。", suggestion: "分析社交平台公开评价，提炼情绪支持与灵感激发需求。" },
  { id: "R03", claim: "C04", severity: "low", type: "工具边界", phrase: "使用 Gemini、ChatGPT 完成概念验证", reason: "工具使用事实尚未再次确认，但未推断模型训练或生产级 Agent 能力。", suggestion: "使用多种生成式 AI 工具辅助概念验证与视觉设计。" },
];

type LiveRisk = { id: string; claim: ResumeClaim; severity: "high" | "medium" | "low"; type: string; phrase: string; reason: string; suggestion: string; sourceFacts: Fact[] };

/**
 * A risk suggestion must be a real rewrite, not merely a copy of the current
 * claim.  Rule-based weakening is deliberately conservative: it only reduces
 * the strength of an existing verb and never introduces a new outcome/tool.
 */
function softenClaimText(text: string, sourceFacts: Fact[]) {
  const replacements: Array<[RegExp, string]> = [
    [/收集并分析/g, "收集并整理"],
    [/分析(?=.{0,18}(评价|内容|数据))/g, "整理"],
    [/提炼/g, "梳理"],
    [/建立/g, "协助建立"],
    [/完成(?=(产品原型|原型设计))/g, "进行"],
    [/设计(?=(灵感仓|逻辑仓|共生仓|\d+ 类))/g, "参与设计"],
    [/使用 Figma 完成/g, "使用 Figma 进行"],
    [/研究方向涉及/g, "关注"],
    [/具备/g, "了解"],
    [/获得/g, "曾获"],
    [/推动/g, "参与"],
    [/提升/g, "支持优化"],
    [/主导/g, "参与"],
  ];
  for (const [pattern, replacement] of replacements) {
    const next = text.replace(pattern, replacement);
    if (next !== text) return next;
  }
  const source = sourceFacts[0]?.text;
  // This keeps the fall-back factual and visibly more modest even for a
  // sentence whose wording cannot be safely transformed by a rule.
  return source && source !== text ? `参与相关工作：${source}` : `参与相关工作：${text}`;
}

function inspectResume(project: GroundedProject): LiveRisk[] {
  const claims = project.resume?.claims ?? [];
  const facts = [...project.experiences, ...(project.assets ?? [])].flatMap((record) => record.facts);
  return claims.map((claim, index) => {
    const sources = facts.filter((fact) => claim.facts.includes(fact.id));
    const sourceText = sources.map((fact) => fact.text).join("；");
    const risky = claim.text.match(/主导|推动|提升|增长|上线|独立负责|显著/g)?.[0];
    const numbers = claim.text.match(/\d+(?:[+.%万千])?/g) ?? [];
    const newNumber = numbers.find((number) => !sourceText.includes(number));
    if (newNumber) return { id: `R${index + 1}`, claim, severity: "high", type: "新增数字", phrase: newNumber, reason: `“${newNumber}”未出现在该 Claim 绑定的确认事实中。`, suggestion: sourceText, sourceFacts: sources };
    if (risky && !sourceText.includes(risky)) return { id: `R${index + 1}`, claim, severity: "high", type: "表达强度升级", phrase: risky, reason: `原始事实没有直接支持“${risky}”这一责任或结果强度。`, suggestion: sourceText, sourceFacts: sources };
    if (/\d|%|万|千|百/.test(sourceText)) return { id: `R${index + 1}`, claim, severity: "medium", type: "数字 / 结果待核实", phrase: sourceText.match(/\d+(?:[+.%万千])?/)?.[0] ?? "结果", reason: "该表述引用了已确认的数字或结果；投递前仍建议核对统计口径和个人贡献边界。", suggestion: softenClaimText(claim.text, sources), sourceFacts: sources };
    return { id: `R${index + 1}`, claim, severity: "low", type: "来源完整", phrase: "确认事实", reason: "当前句子已绑定确认事实，未发现规则可识别的新增数字或责任升级。若你希望进一步保守表达，可选择弱化版本。", suggestion: softenClaimText(claim.text, sources), sourceFacts: sources };
  });
}

export default function GroundedCVApp() {
  const [project, setProject] = useState<GroundedProject>(() => createSampleProject());
  const [savedProject, setSavedProject] = useState<GroundedProject | null>(null);
  const [screen, setScreen] = useState<"start" | "workspace">("start");
  const [hydrated, setHydrated] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [selectedExperience, setSelectedExperience] = useState("EXP-02");
  const [selectedRiskId, setSelectedRiskId] = useState("");
  const [notice, setNotice] = useState("");
  const [aiSettings, setAiSettings] = useState<AiSettings>({ apiKey: "", model: "deepseek-v4-flash" });
  const [apiSettingsOpen, setApiSettingsOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY);
      if (raw) setSavedProject(JSON.parse(raw) as GroundedProject);
    } catch {
      window.localStorage.removeItem(PROJECT_STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated || screen !== "workspace") return;
    window.localStorage.setItem(
      PROJECT_STORAGE_KEY,
      JSON.stringify({ ...project, updatedAt: new Date().toISOString() }),
    );
    setSavedProject(project);
  }, [hydrated, project, screen]);

  const experiences = project.experiences;
  const assets = project.assets ?? [];
  const facts = useMemo(() => [...experiences, ...assets].flatMap((item) => item.facts), [experiences, assets]);
  const confirmed = facts.filter((fact) => fact.status === "confirmed").length;
  const pending = facts.filter((fact) => fact.status === "pending").length;
  const currentExperience = (experiences.find((item) => item.id === selectedExperience) ?? experiences[0])!;
  const liveRisks = useMemo(() => inspectResume(project), [project]);

  const selectedRisk = liveRisks.find((item) => item.id === selectedRiskId)
    ?? liveRisks.find((item) => item.severity !== "low")
    ?? liveRisks[0];

  function saveInterviewResponse(response: InterviewResponse) {
    setProject((current) => {
      if (!current.resume) return current;
      const previous = current.resume.interviewResponses ?? [];
      return {
        ...current,
        resume: {
          ...current.resume,
          interviewResponses: [...previous.filter((item) => item.claimId !== response.claimId), response],
          revisions: current.resume.revisions ?? [],
        },
      };
    });
  }

  function applyClaimRevisions(decisions: Array<{ risk: LiveRisk; action: ClaimRevision["action"] }>) {
    setProject((current) => {
      if (!current.resume) return current;
      const decisionByClaim = new Map(decisions.map((item) => [item.risk.claim.id, item]));
      const claims = current.resume.claims
        .filter((claim) => decisionByClaim.get(claim.id)?.action !== "delete")
        .map((claim) => {
          const decision = decisionByClaim.get(claim.id);
          return decision?.action === "weaken" ? { ...claim, text: decision.risk.suggestion, risk: "low" as const } : claim;
        });
      const revisions: ClaimRevision[] = decisions.map(({ risk, action }, index) => ({
        id: `REV-${Date.now()}-${index}`,
        claimId: risk.claim.id,
        riskId: risk.id,
        action,
        beforeText: risk.claim.text,
        afterText: action === "delete" ? undefined : action === "weaken" ? risk.suggestion : risk.claim.text,
        reason: action === "keep" ? "用户确认保留原文" : action === "weaken" ? risk.reason : "用户选择不在最终简历中采用此 Claim",
        appliedAt: new Date().toISOString(),
      }));
      return {
        ...current,
        resume: {
          ...current.resume,
          claims,
          revisions: [...(current.resume.revisions ?? []).filter((item) => !decisionByClaim.has(item.claimId)), ...revisions],
          interviewResponses: current.resume.interviewResponses ?? [],
        },
      };
    });
    setNotice(`已处理 ${decisions.length} 条 Claim，并生成最终简历`);
    window.setTimeout(() => setNotice(""), 2400);
  }

  function startProject(nextProject: GroundedProject) {
    setProject(nextProject);
    setSelectedExperience(nextProject.experiences[0]?.id ?? "");
    setActiveStep(0);
    setScreen("workspace");
  }

  function updateFact(factId: string, status: FactStatus) {
    setProject((current) => ({
      ...current,
      resume: undefined,
      experiences: current.experiences.map((experience) => ({
        ...experience,
        facts: experience.facts.map((fact) => (fact.id === factId ? { ...fact, status } : fact)),
      })),
      assets: (current.assets ?? []).map((asset) => ({ ...asset, facts: asset.facts.map((fact) => fact.id === factId ? { ...fact, status } : fact) })),
    }));
    setNotice(status === "confirmed" ? `${factId} 已加入可信事实库` : `${factId} 已标记为${statusLabel[status]}`);
    window.setTimeout(() => setNotice(""), 2200);
  }

  function upsertExperience(experience: Experience) {
    setProject((current) => {
      const exists = current.experiences.some((item) => item.id === experience.id);
      return {
        ...current,
        resume: undefined,
        experiences: exists
          ? current.experiences.map((item) => item.id === experience.id ? experience : item)
          : [...current.experiences, experience],
      };
    });
    setSelectedExperience(experience.id);
    setNotice("经历卡已保存");
    window.setTimeout(() => setNotice(""), 1800);
  }

  function deleteExperience(experienceId: string) {
    const next = experiences.find((item) => item.id !== experienceId);
    setProject((current) => ({
      ...current,
      resume: undefined,
      experiences: current.experiences.filter((item) => item.id !== experienceId),
    }));
    setSelectedExperience(next?.id ?? "");
    setNotice("经历卡已删除");
    window.setTimeout(() => setNotice(""), 1800);
  }

  function upsertAsset(asset: FactAsset) {
    setProject((current) => ({ ...current, resume: undefined, assets: (current.assets ?? []).some((item) => item.id === asset.id) ? (current.assets ?? []).map((item) => item.id === asset.id ? asset : item) : [...(current.assets ?? []), asset] }));
    setNotice("事实资产已保存");
    window.setTimeout(() => setNotice(""), 1800);
  }

  function deleteAsset(assetId: string) {
    setProject((current) => ({
      ...current,
      resume: undefined,
      jobAnalysis: undefined,
      assets: (current.assets ?? []).filter((item) => item.id !== assetId),
    }));
    setNotice("事实资产已删除");
    window.setTimeout(() => setNotice(""), 1800);
  }

  function resetProject() {
    if (!window.confirm("返回首页并清空当前浏览器中的项目数据？此操作无法撤销。")) return;
    window.localStorage.removeItem(PROJECT_STORAGE_KEY);
    setSavedProject(null);
    setProject(createSampleProject());
    setAiSettings({ apiKey: "", model: "deepseek-v4-flash" });
    setScreen("start");
    setActiveStep(0);
  }

  if (screen === "start") {
    return <StartScreen savedProject={savedProject} onStart={startProject} />;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">G</span>
          <div>
            <strong>GroundedCV</strong>
            <small>可信简历实验室</small>
          </div>
        </div>

        <div className="case-label">当前项目</div>
        <button className="case-card" type="button">
          <span className="case-icon">{project.job.company?.slice(0, 1) || "简"}</span>
          <span>
            <strong>{project.job.title || "尚未填写目标岗位"}</strong>
            <small>{project.mode === "example" ? "匿名示例" : project.sourceName} · {project.candidateName}</small>
          </span>
          <span>•</span>
        </button>

        <nav className="step-nav" aria-label="产品流程">
          {STEPS.map((step, index) => (
            <button
              type="button"
              className={activeStep === index ? "step active" : "step"}
              key={step[0]}
              onClick={() => setActiveStep(index)}
            >
              <span className="step-number">{step[0]}</span>
              <span><strong>{step[1]}</strong><small>{step[2]}</small></span>
              {index === 0 && <span className="step-count">{confirmed}/{facts.length}</span>}
            </button>
          ))}
        </nav>

        <div className="privacy-note">
          <span>◉</span>
          <p><strong>项目保存在当前浏览器</strong><br />原文件不会进入简历数据库</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumb">求职项目 <span>/</span> {project.job.title || "待填写岗位"} <span>/</span> {STEPS[activeStep][1]}</div>
          <div className="top-actions">
            <button type="button" className={aiSettings.apiKey ? "api-ready" : "ghost-button"} onClick={() => setApiSettingsOpen(true)}>{aiSettings.apiKey ? "AI 已连接" : "AI 设置"}</button>
            <button type="button" className="ghost-button" onClick={() => setScreen("start")}>返回首页</button>
            <button type="button" className="ghost-button danger-text" onClick={resetProject}>清空项目</button>
            <button type="button" className="avatar" aria-label="当前候选人">{project.candidateName.slice(0, 1)}</button>
          </div>
        </header>

        {activeStep === 0 ? (
          <FactLibrary
            experiences={experiences}
            selectedExperience={selectedExperience}
            setSelectedExperience={setSelectedExperience}
            currentExperience={currentExperience}
            confirmed={confirmed}
            pending={pending}
            total={facts.length}
            updateFact={updateFact}
            upsertExperience={upsertExperience}
            deleteExperience={deleteExperience}
            assets={assets}
            upsertAsset={upsertAsset}
            deleteAsset={deleteAsset}
            aiSettings={aiSettings}
            onNext={() => setActiveStep(1)}
          />
        ) : activeStep === 1 ? (
          <JobAnalysis
            job={project.job}
            experiences={project.experiences}
            assets={assets}
            aiSettings={aiSettings}
            analysis={project.jobAnalysis}
            updateJob={(job) => setProject((current) => ({ ...current, job, jobAnalysis: undefined, resume: undefined }))}
            saveAnalysis={(jobAnalysis) => setProject((current) => ({ ...current, jobAnalysis }))}
            onNext={() => setActiveStep(2)}
          />
        ) : activeStep === 2 ? (
          <ResumeStudio
            project={project}
            aiSettings={aiSettings}
            onGenerate={() => {
              const nextResume = generateGroundedResume(project);
              setProject((current) => ({ ...current, resume: nextResume }));
              setNotice(nextResume.claims.length ? "已根据最新确认事实生成简历" : "请先确认至少一条事实，再生成简历");
              window.setTimeout(() => setNotice(""), 2400);
            }}
            onAiGenerate={(claims) => {
              const baseline = generateGroundedResume(project);
              const nextResume = { ...baseline, generatedAt: new Date().toISOString(), claims, includedExperienceCount: new Set(claims.map((claim) => claim.experienceId)).size };
              setProject((current) => ({ ...current, resume: nextResume }));
              setNotice("已按岗位 JD 完成事实约束改写");
              window.setTimeout(() => setNotice(""), 2400);
            }}
            onNext={() => setActiveStep(3)}
          />
        ) : activeStep === 3 ? (
          <RiskCenter risks={liveRisks} onSelectRisk={setSelectedRiskId} onNext={() => setActiveStep(4)} />
        ) : activeStep === 4 ? (
          <InterviewTest
            key={selectedRisk?.id ?? "no-risk"}
            risks={liveRisks}
            risk={selectedRisk}
            response={project.resume?.interviewResponses?.find((item) => item.claimId === selectedRisk?.claim.id)}
            completedClaimIds={(project.resume?.interviewResponses ?? []).filter((item) => item.completedAt).map((item) => item.claimId)}
            onSave={saveInterviewResponse}
            onSelectRisk={setSelectedRiskId}
            onNext={() => setActiveStep(5)}
          />
        ) : activeStep === 5 ? (
          <ReverseEdit risks={liveRisks} onApplyAll={applyClaimRevisions} onNext={() => setActiveStep(6)} />
        ) : activeStep === 6 ? (
          <FinalReport project={project} risks={liveRisks} />
        ) : (
          <StagePlaceholder activeStep={activeStep} onBack={() => setActiveStep(Math.max(0, activeStep - 1))} />
        )}
      </section>
      {apiSettingsOpen && <AiSettingsDialog settings={aiSettings} onClose={() => setApiSettingsOpen(false)} onSave={setAiSettings} />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}

const SEMANTIC_MATCHERS = [
  { pattern: /需求调研|用户研究|需求分析|用户需求/, terms: ["访谈", "调研", "评价", "评论", "用户画像", "需求池", "公开内容", "分析"], expression: "开展需求调研并整理高频问题", followUp: "你如何收集、筛选并归类这些用户反馈？" },
  { pattern: /竞品|趋势|行业动态/, terms: ["竞品", "行业", "趋势", "公开内容", "平台", "案例", "分析"], expression: "基于公开信息开展案例与内容分析", followUp: "你是否形成过竞品对比维度或趋势结论？" },
  { pattern: /产品方案|功能设计|原型|产品设计/, terms: ["原型", "功能模块", "产品模式", "设计", "方案", "需求池"], expression: "基于需求完成产品方案或功能模块设计", followUp: "你的方案如何从需求进一步落到流程、原型或模块？" },
  { pattern: /业务流程|流程梳理|流程优化/, terms: ["用户旅程", "流程", "需求池", "优先级", "梳理"], expression: "梳理用户旅程与需求优先级", followUp: "该流程是用户侧还是内部业务侧？是否有前后对比证据？" },
  { pattern: /AI提效|AI工具|人工智能/, terms: ["AI", "LLM", "Agent", "ChatGPT", "Gemini", "Codex", "概念验证"], expression: "探索生成式 AI 工具在相关场景中的辅助方式", followUp: "你实际验证过哪个 AI 场景，输入、输出和效果分别是什么？" },
  { pattern: /需求文档|PRD|文档撰写|报告/, terms: ["报告", "需求池", "评审", "用户旅程", "文档"], expression: "整理需求分析材料并沉淀为项目交付物", followUp: "是否有可展示的 PRD、分析报告或评审材料？" },
  { pattern: /协调|协作|研发|跨部门/, terms: ["协调", "评审", "团队", "政府", "专家", "业务单位"], expression: "协调多方角色完成需求评审与方案讨论", followUp: "你在协作中负责的具体接口、节奏或产出是什么？" },
  { pattern: /用户反馈|数据|迭代|优化|测试/, terms: ["评价", "反馈", "测试", "验证", "优化", "热力图"], expression: "收集公开反馈并参与概念或功能验证", followUp: "反馈如何影响后续的方案调整？是否有版本记录？" },
  { pattern: /LLM|Prompt|Agent|Skill/, terms: ["LLM", "Agent", "ChatGPT", "Gemini", "Codex", "研究方向"], expression: "关注 LLM 与 Agent 相关研究方向，并使用生成式 AI 工具辅助概念验证", followUp: "你对相关概念的理解是否能结合一个具体项目说明？" },
  { pattern: /Vibe Coding|Codex|Claude|AI编程|Demo/, terms: ["Codex", "Python", "原型", "Demo", "AI"], expression: "具备 Python 基础并完成过可演示原型", followUp: "是否实际使用过 AI 编程工具完成可运行 Demo？若有，请补充链接或代码。" },
];

function deriveRequirements(job: JobTarget, experiences: Array<Experience | FactAsset>) {
  if (!job.description.trim()) return [];
  const allFacts = experiences.flatMap((experience) => experience.facts);
  const requirementTexts = job.description
    .split(/[\n；;。]/)
    .flatMap((part) => part.length > 45 ? part.split(/[，,]/) : [part])
    .map((part) => part.replace(/^\s*\d+[.、）)]?\s*/, "").trim())
    .filter((part) => part.length >= 5)
    .filter((part, index, items) => items.indexOf(part) === index)
    .slice(0, 12);

  return requirementTexts.map((text, index) => {
    const matcher = SEMANTIC_MATCHERS.find((item) => item.pattern.test(text));
    const terms = matcher?.terms ?? [];
    const fallbackTerms = text
      .replace(/[、，,：:（）()]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 3)
      .slice(0, 4);
    const matchTerms = terms.length ? terms : fallbackTerms;
    const matchedFacts = allFacts.filter(
      (fact) =>
        fact.status !== "rejected" &&
        matchTerms.some((term) => fact.text.toLowerCase().includes(term.toLowerCase())),
    );
    const confirmedMatches = matchedFacts.filter((fact) => fact.status === "confirmed");
    const directMatch = confirmedMatches.some((fact) => text.split(/[、，,：:（）()]/).some((piece) => piece.length >= 3 && fact.text.includes(piece)));
    const level =
      confirmedMatches.length >= 1 && directMatch
        ? "covered"
        : confirmedMatches.length >= 1 && matcher
          ? "transferable"
        : matchedFacts.length >= 1
          ? "partial"
          : "missing";
    return {
      id: `JD${String(index + 1).padStart(2, "0")}`,
      text,
      type: index < 6 ? "核心任务" : "能力要求",
      level,
      facts: matchedFacts.length ? matchedFacts.slice(0, 3).map((fact) => fact.id).join(" · ") : "暂无事实",
      reason:
        level === "covered"
          ? "已找到与岗位要求直接对应的确认事实，可作为核心证据。"
          : level === "transferable"
            ? "存在方法或能力相近的确认事实，但业务场景不同，建议使用保守表达。"
            : level === "partial"
              ? "存在相关材料，但尚未完成事实确认或缺少关键证据。"
              : "当前事实库没有可用证据，不会强行写入简历。",
      safeExpression: level === "missing" ? "" : matcher?.expression ?? "基于确认事实进行保守表达",
      followUp: level === "partial" || level === "transferable" ? matcher?.followUp ?? "你能补充这项能力对应的具体行动或产出吗？" : "",
    };
  });
}

function JobAnalysis({
  job,
  experiences,
  assets,
  aiSettings,
  analysis,
  updateJob,
  saveAnalysis,
  onNext,
}: {
  job: JobTarget;
  experiences: Experience[];
  assets: FactAsset[];
  aiSettings: AiSettings;
  analysis?: SemanticJobRequirement[];
  updateJob: (job: JobTarget) => void;
  saveAnalysis: (analysis: SemanticJobRequirement[]) => void;
  onNext: () => void;
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState("");
  const records = useMemo(() => [...experiences, ...assets], [experiences, assets]);
  const ruleRequirements = useMemo(() => deriveRequirements(job, records), [job, records]);
  const requirements = analysis?.length ? analysis.map((item) => ({ ...item, facts: item.factIds.length ? item.factIds.join(" · ") : "暂无事实" })) : ruleRequirements;
  const covered = requirements.filter((item) => item.level === "covered").length;
  const transferable = requirements.filter((item) => item.level === "transferable").length;
  const partial = requirements.filter((item) => item.level === "partial").length;
  const missing = requirements.filter((item) => item.level === "missing").length;
  const canContinue = Boolean(job.company.trim() && job.title.trim() && job.description.trim());

  function continueToResume() {
    if (!canContinue) {
      window.alert("请先填写公司、岗位名称和岗位 JD。");
      return;
    }
    onNext();
  }

  async function analyzeSemantically() {
    if (!canContinue) {
      setAiError("请先填写公司、岗位名称和完整 JD。");
      return;
    }
    setAnalyzing(true);
    setAiError("");
    try {
      const next = await analyzeJobFitWithAi(aiSettings, job, records);
      if (!next.length) throw new Error("AI 没有返回可用的岗位能力单元，请重试。");
      saveAnalysis(next);
    } catch (reason) {
      setAiError(reason instanceof Error ? reason.message : "AI 语义匹配失败，请重试。");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">STEP 02 · JOB FIT, EXPLAINED</span>
          <h1>岗位需要什么，你的事实能证明什么</h1>
          <p>不提供虚假的“87 分匹配度”。每项要求都会显示覆盖状态、支持事实和判断理由。</p>
        </div>
        <div className="resume-heading-actions"><button className="ghost-button" type="button" onClick={analyzeSemantically} disabled={analyzing}>{analyzing ? "AI 正在语义匹配…" : analysis?.length ? "重新 AI 语义匹配" : "AI 语义匹配"}</button><button className="primary-button" type="button" onClick={continueToResume}>生成岗位化简历 <span>→</span></button></div>
      </div>

      <section className="job-entry-card">
        <div className="job-entry-heading">
          <div><span className="card-category">目标岗位</span><h2>粘贴你准备申请的岗位信息</h2></div>
          <span className={canContinue ? "input-state ready" : "input-state"}>{canContinue ? "信息已填写" : "等待填写"}</span>
        </div>
        <div className="job-fields">
          <label>公司名称<input value={job.company} onChange={(event) => updateJob({ ...job, company: event.target.value })} placeholder="例如：上海得物信息集团有限公司" /></label>
          <label>岗位名称<input value={job.title} onChange={(event) => updateJob({ ...job, title: event.target.value })} placeholder="例如：AI 产品经理实习生" /></label>
          <label className="job-description">岗位 JD<textarea value={job.description} onChange={(event) => updateJob({ ...job, description: event.target.value })} placeholder="粘贴岗位职责和任职要求。系统会拆解岗位任务，并与已经确认的事实进行匹配。" /></label>
        </div>
      </section>

      {aiError && <p className="modal-error ai-inline-error" role="alert">{aiError}</p>}

      {requirements.length > 0 ? <>
      <div className="job-summary">
        <div className="job-company"><span className="company-mark">{job.company.slice(0, 1)}</span><div><span>{job.company}</span><h2>{job.title}</h2><p>{requirements.slice(0, 5).map((item) => item.text.slice(0, 10)).join(" · ")}</p></div></div>
        <div className="coverage-donut" style={{ "--coverage": `${((covered + transferable * 0.75 + partial * 0.5) / requirements.length) * 100}%` } as React.CSSProperties}>
          <div><strong>{covered + transferable + partial}</strong><span>项有事实响应</span></div>
        </div>
      </div>

      <div className="coverage-legend">
        <span><i className="dot covered" />{covered} 项已覆盖</span>
        <span><i className="dot transferable" />{transferable} 项可迁移</span>
        <span><i className="dot partial" />{partial} 项部分覆盖</span>
        <span><i className="dot missing" />{missing} 项未覆盖</span>
        <span><i className="dot unknown" />{analysis?.length ? "AI 语义分析，仍受确认事实约束" : "当前为规则初筛；可点击 AI 语义匹配"}</span>
      </div>

      <div className="requirements-table">
        <div className="requirements-head"><span>岗位要求</span><span>覆盖状态</span><span>对应事实</span><span>判断依据</span></div>
        {requirements.map((item) => (
          <article className="requirement-row" key={item.id}>
            <div><code>{item.id}</code><strong>{item.text}</strong><small>{item.type}</small></div>
            <span className={`coverage ${item.level}`}>{coverageLabel[item.level]}</span>
            <span className={item.level === "missing" ? "fact-links muted" : "fact-links"}>{item.facts}</span>
            <p>{item.reason}{"safeExpression" in item && item.safeExpression ? ` 安全表达：${item.safeExpression}` : ""}{"followUp" in item && item.followUp ? ` 待补充：${item.followUp}` : ""}</p>
          </article>
        ))}
      </div>

      <div className="missing-callout"><span>!</span><div><strong>未覆盖不等于必须“补齐”</strong><p>当前事实库没有支持材料的要求不会被强行写入简历。你可以返回事实库补充真实经历，但系统不会替你编造。</p></div></div>
      </> : <div className="job-empty-state"><span>JD</span><h2>岗位要求将在这里拆解</h2><p>填写上方三项内容后，系统会显示每条要求对应的事实、覆盖状态和判断理由。</p></div>}
    </div>
  );
}

function ResumeStudio({
  project,
  aiSettings,
  onGenerate,
  onAiGenerate,
  onNext,
}: {
  project: GroundedProject;
  aiSettings: AiSettings;
  onGenerate: () => void;
  onAiGenerate: (claims: ResumeClaim[]) => void;
  onNext: () => void;
}) {
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState("");
  const resume = project.resume;
  const activeClaim = resume?.claims.find((claim) => claim.id === selectedClaim) ?? resume?.claims[0];
  const sourceFacts = [...project.experiences, ...(project.assets ?? [])].flatMap((record) => record.facts);
  const sections: ResumeClaim["section"][] = ["工作经历", "项目经历", "教育与研究", "技能", "奖项/证书", "作品与链接", "其他经历"];
  const canInspect = Boolean(resume?.claims.length);

  async function generateWithAi() {
    setGenerating(true);
    setAiError("");
    try {
      const claims = await rewriteResumeWithAi(aiSettings, project);
      if (!claims.length) throw new Error("模型没有生成可由确认事实支持的简历表述，请重试或检查事实。\n");
      onAiGenerate(claims);
    } catch (reason) {
      setAiError(reason instanceof Error ? reason.message : "AI 生成失败，请重试。");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="page resume-page">
      <div className="page-heading">
        <div><span className="eyebrow">STEP 03 · GROUNDED WRITING</span><h1>整份简历，每句话都有来处</h1><p>只使用已确认事实。新增、编辑或更改事实状态后，必须重新生成，旧版本不会被悄悄沿用。</p></div>
        <div className="resume-heading-actions">
          <button className="ghost-button" type="button" onClick={onGenerate}>{resume ? "按最新事实重新生成" : "先生成事实草稿"}</button>
          <button className="primary-button" type="button" onClick={generateWithAi} disabled={generating}>{generating ? "AI 正在按 JD 改写…" : "AI 按岗位改写"}</button>
          <button className="primary-button" type="button" onClick={onNext} disabled={!canInspect}>开始 Claim 检测 <span>→</span></button>
        </div>
      </div>
      {aiError && <p className="modal-error ai-inline-error" role="alert">{aiError}</p>}
      {!resume ? <div className="resume-empty"><span>03</span><h2>尚未生成岗位化简历</h2><p>先生成事实草稿，或填写 AI 设置后让系统按岗位 JD 压缩、重组和改写。所有最终句子仍必须绑定确认事实。</p></div> : resume.claims.length === 0 ? <div className="resume-empty"><span>!</span><h2>还没有可写入简历的确认事实</h2><p>返回事实库，至少确认一条你真实做过的行动、工具、结果或数字，再重新生成。</p></div> : <div className="resume-workspace">
        <div className="resume-paper">
          <header className="resume-header"><div><h2>{resume.candidateName}</h2><p>{resume.targetTitle}</p></div><span>{project.job.company || "目标公司待填写"}<br />已确认 {resume.confirmedFactCount} 条事实 · 纳入 {resume.includedExperienceCount} 段经历</span></header>
          <section><h3>可信表达说明</h3><p>以下经历根据目标岗位相关性排序；每条均对应事实库中的确认事实，未确认、拒绝或无依据内容不会写入。</p></section>
          {sections.map((section) => {
            const sectionClaims = resume.claims.filter((claim) => claim.section === section);
            if (!sectionClaims.length) return null;
            const experienceIds = [...new Set(sectionClaims.map((claim) => claim.experienceId))];
            return <section key={section}><h3>{section}</h3>{experienceIds.map((experienceId) => {
              const claims = sectionClaims.filter((claim) => claim.experienceId === experienceId);
              const entry = claims[0];
              return <div className="resume-entry" key={experienceId}><div><strong>{entry.experienceTitle}</strong><time>{entry.experienceMeta}</time></div><small>{section}</small>{claims.map((claim) => <ClaimLine key={claim.id} claim={claim} active={activeClaim?.id === claim.id} onClick={() => setSelectedClaim(claim.id)} />)}</div>;
            })}</section>;
          })}
        </div>
        <aside className="claim-source">
          {activeClaim && <><span className={`risk-flag ${activeClaim.risk}`}>{activeClaim.risk === "low" ? "低风险" : "需要核查"}</span>
            <code>{activeClaim.id}</code>
            <h2>这句话为什么能写？</h2>
            <blockquote>{activeClaim.text}</blockquote>
            <h3>事实来源</h3>
            <div className="source-tags">{activeClaim.facts.map((factId) => <span key={factId}>{factId}</span>)}</div>
            <div className="source-explain"><strong>原始事实</strong><p>{sourceFacts.filter((fact) => activeClaim.facts.includes(fact.id)).map((fact) => fact.text).join("；")}</p></div>
            <h3>响应的 JD 要求</h3>
            <div className="source-tags jd-tags">{activeClaim.jd.length ? activeClaim.jd.map((jd) => <span key={jd}>{jd}</span>) : <span>暂无直接关键词匹配</span>}</div>
            <div className="source-explain"><strong>表达边界</strong><p>{activeClaim.risk === "medium" ? "含有数字、结果、上线或责任强度词，下一步会优先检查证据和因果关系。" : "当前表述没有引入原事实之外的新数字、工具或项目状态。"}</p></div>
          </>}
        </aside>
      </div>}
    </div>
  );
}

function ClaimLine({ claim, active, onClick }: { claim: ResumeClaim; active: boolean; onClick: () => void }) {
  return <button type="button" className={active ? "claim-line active" : "claim-line"} onClick={onClick}><i className={`claim-dot ${claim.risk}`} /><span>{claim.text}</span><b>{claim.id}</b></button>;
}

function RiskCenter({ risks, onSelectRisk, onNext }: { risks: LiveRisk[]; onSelectRisk: (riskId: string) => void; onNext: () => void }) {
  const [selected, setSelected] = useState("");
  const risk = risks.find((item) => item.id === selected) ?? risks[0];
  if (!risk) return <EmptyStage title="先生成当前项目的简历" copy="Claim 检测会读取你刚刚生成的简历，而不是展示固定示例。" />;
  const counts = { high: risks.filter((item) => item.severity === "high").length, medium: risks.filter((item) => item.severity === "medium").length, low: risks.filter((item) => item.severity === "low").length };
  return (
    <div className="page">
      <div className="page-heading">
        <div><span className="eyebrow">STEP 04 · CLAIM INSPECTOR</span><h1>不是语法检查，而是事实边界检查</h1><p>系统比较生成 Claim 与事实库，识别新增数字、责任升级、技能注入、状态改变和因果夸大。</p></div>
        <button className="primary-button" type="button" onClick={onNext}>进入面试压力测试 <span>→</span></button>
      </div>
      <div className="risk-summary">
        <div><span className="risk-number high">{counts.high}</span><p><strong>高风险</strong>建议追问后处理</p></div>
        <div><span className="risk-number medium">{counts.medium}</span><p><strong>中风险</strong>需要补充或弱化</p></div>
        <div><span className="risk-number low">{counts.low}</span><p><strong>低风险</strong>确认事实即可保留</p></div>
        <div className="scan-note"><span>✓</span><p><strong>已检查 {risks.length} 条当前 Claim</strong>结果来自当前项目的事实来源与表述对照</p></div>
      </div>
      <div className="risk-layout">
        <div className="risk-list">
          {risks.map((item) => (
            <button type="button" key={item.id} className={selected === item.id ? "risk-card active" : "risk-card"} onClick={() => setSelected(item.id)}>
              <span className={`severity ${item.severity}`}>{item.severity === "high" ? "高" : item.severity === "medium" ? "中" : "低"}</span>
              <div><span>{item.type} · {item.claim.id}</span><strong>“{item.phrase}”</strong><small>{item.reason}</small></div><b>→</b>
            </button>
          ))}
        </div>
        <aside className="risk-detail">
          <div className="risk-detail-head"><span className={`severity ${risk.severity}`}>{risk.severity === "high" ? "高风险" : risk.severity === "medium" ? "中风险" : "低风险"}</span><code>{risk.id}</code></div>
          <h2>{risk.type}</h2>
          <div className="compare-box"><small>当前简历表述</small><p>{risk.claim.text}</p><mark>{risk.phrase}</mark></div>
          <h3>检查理由</h3><p className="detail-copy">{risk.reason}</p>
          <h3>系统建议</h3><div className="suggestion-box">{risk.suggestion}</div>
          <div className="decision-buttons"><button type="button" onClick={() => { onSelectRisk(risk.id); onNext(); }}>处理这条风险</button><button type="button" className="recommended" onClick={() => { onSelectRisk(risk.id); onNext(); }}>进入追问 →</button></div>
        </aside>
      </div>
    </div>
  );
}

function InterviewTest({ risks, risk: target, response, completedClaimIds, onSave, onSelectRisk, onNext }: { risks: LiveRisk[]; risk?: LiveRisk; response?: InterviewResponse; completedClaimIds: string[]; onSave: (response: InterviewResponse) => void; onSelectRisk: (riskId: string) => void; onNext: () => void }) {
  if (!target) return <EmptyStage title="先生成当前项目的简历" copy="面试追问会围绕当前 Claim 的风险点生成。" />;
  const completed = new Set(completedClaimIds);
  const pendingRisks = risks.filter((risk) => !completed.has(risk.claim.id));
  const allComplete = pendingRisks.length === 0;
  const challengedExpression = target.phrase === "确认事实" || target.phrase === "结果" ? "这条简历表述" : `“${target.phrase}”`;
  const questions = [
    { level: "L1", title: "事实确认", question: `“${target.phrase}”在这段经历中具体指什么？请说明你亲自完成的行动。`, hint: "验证事实范围，避免把团队过程归因于个人。" },
    { level: "L2", title: "方法验证", question: `你使用了什么方法或产物来支撑“${target.claim.text}”？`, hint: "验证行动、方法与产出能否形成完整证据链。" },
    { level: "L3", title: "结论挑战", question: `针对${challengedExpression}，它与个人工作之间有什么直接证据？哪些部分应改为团队或项目结果？`, hint: "挑战过强因果，判断是否需要弱化。" },
  ];
  const [level, setLevel] = useState(0);
  const [answers, setAnswers] = useState(() => response?.answers ?? ["", "", ""]);
  const [evaluated, setEvaluated] = useState(Boolean(response?.completedAt));
  const question = questions[level];
  function saveAnswer() {
    const nextAnswers = answers.map((answer) => answer.trim());
    onSave({ claimId: target.claim.id, riskId: target.id, answers: nextAnswers, completedAt: level === 2 ? new Date().toISOString() : undefined });
    if (level < 2) setLevel(level + 1);
    else setEvaluated(true);
  }
  function moveToNextRisk() {
    const next = risks.find((risk) => risk.claim.id !== target.claim.id && !completed.has(risk.claim.id));
    if (next) onSelectRisk(next.id);
    else onNext();
  }
  return (
    <div className="page">
      <div className="page-heading">
        <div><span className="eyebrow">STEP 05 · INTERVIEW PRESSURE TEST</span><h1>先完成全部追问，再统一决定怎么修改</h1><p>每条 Claim 都有独立的事实、方法和结论三层追问；完成所有待审 Claim 后，才进入批量反向修改。</p></div>
        <button className="primary-button" type="button" disabled={!allComplete} onClick={onNext}>{allComplete ? "进入统一反向修改 →" : `还需完成 ${pendingRisks.length} 条追问`}</button>
      </div>
      <div className="interview-layout">
        <aside className="question-rail">
          <span className="card-category">风险追问队列 · 已完成 {completed.size}/{risks.length}</span>
          <h2>{target.claim.id} · {target.type}</h2>
          <blockquote>“{target.claim.text}”</blockquote>
          <div className="risk-queue">
            {risks.map((risk) => <button key={risk.id} type="button" onClick={() => onSelectRisk(risk.id)} className={risk.id === target.id ? "active" : ""}><span>{completed.has(risk.claim.id) ? "✓" : risk.severity === "high" ? "高" : risk.severity === "medium" ? "中" : "低"}</span><div><strong>{risk.claim.id} · {risk.type}</strong><small>{completed.has(risk.claim.id) ? "已完成三层追问" : "待追问"}</small></div></button>)}
          </div>
          <div className="level-rail">
            {questions.map((item, index) => <button type="button" key={item.level} onClick={() => setLevel(index)} className={level === index ? "level active" : index < level || evaluated ? "level done" : "level"}><span>{index < level || evaluated ? "✓" : item.level}</span><div><strong>{item.title}</strong><small>{answers[index] ? "已回答" : "待回答"}</small></div></button>)}
          </div>
        </aside>
        <section className="question-stage">
          {!evaluated ? <>
            <section className="interview-trace-card" aria-label="本轮追问来源">
              <div className="interview-trace-head"><span>本轮追问来源</span><code>{target.id}</code><b>{target.type}</b></div>
              <div className="interview-trace-grid">
                <div><small>正在追问的简历原句</small><p>{target.claim.text}</p></div>
                <div><small>本轮风险点</small><mark>{target.phrase}</mark><p>{target.reason}</p></div>
              </div>
              <div className="interview-fact-sources"><small>关联事实来源</small>{target.sourceFacts.length ? <ul>{target.sourceFacts.map((fact) => <li key={fact.id}><code>{fact.id}</code><span>{fact.text}</span><em>{fact.source}</em></li>)}</ul> : <p>该简历原句尚未绑定事实；这是本轮追问的风险来源。</p>}</div>
            </section>
            <div className="question-meta"><span>{question.level}</span><p><strong>{question.title}</strong>问题 {level + 1} / 3</p></div>
            <h2>{question.question}</h2>
            <div className="question-hint"><span>为何追问</span>{question.hint}</div>
            <label htmlFor="interview-answer">你的回答</label>
            <textarea id="interview-answer" value={answers[level]} onChange={(event) => setAnswers((items) => items.map((value, index) => index === level ? event.target.value : value))} placeholder="请像真实面试一样回答。建议包含：你的具体行动、使用的方法、参与边界和能够验证的结果。" />
            <div className="answer-actions"><button type="button" className="ghost-button" disabled={level === 0} onClick={() => setLevel(level - 1)}>← 上一问</button><button type="button" className="primary-button" onClick={saveAnswer}>{level === 2 ? "完成压力测试" : "保存并继续 →"}</button></div>
          </> : <div className="evaluation">
            <span className="evaluation-score">58</span><small>/ 100 可辩护性</small>
            <h2>请用回答决定是否保留当前表述</h2>
            <p>系统会保留你的回答；若无法说明个人行动、方法和结果边界，下一步建议采用事实来源中的较弱表述。</p>
            <div><span>✓ 保留</span><strong>{target.claim.text}</strong></div>
            <div><span>↓ 建议</span><strong>{target.suggestion}</strong></div>
            <button type="button" className="primary-button" onClick={moveToNextRisk}>{pendingRisks.some((risk) => risk.claim.id !== target.claim.id) ? "继续下一条 Claim →" : "进入统一反向修改 →"}</button>
          </div>}
        </section>
      </div>
    </div>
  );
}

function ReverseEdit({ risks, onApplyAll, onNext }: { risks: LiveRisk[]; onApplyAll: (decisions: Array<{ risk: LiveRisk; action: ClaimRevision["action"] }>) => void; onNext: () => void }) {
  if (!risks.length) return <EmptyStage title="先生成当前项目的简历" copy="反向修改会使用当前风险检测结果。" />;
  const [choices, setChoices] = useState<Record<string, ClaimRevision["action"]>>(() => Object.fromEntries(risks.map((risk) => [risk.id, risk.severity === "low" ? "keep" : "weaken"])));
  const processed = risks.filter((risk) => choices[risk.id]).length;
  function applyAll() {
    onApplyAll(risks.map((risk) => ({ risk, action: choices[risk.id] ?? "keep" })));
    onNext();
  }
  return (
    <div className="page">
      <div className="page-heading">
        <div><span className="eyebrow">STEP 06 · BATCH REVERSE REVISION</span><h1>逐条决定，统一回写到最终简历</h1><p>这里保留所有 Claim 的处理决定。确认后会一次性生成最终简历，而不是只修改当前一条。</p></div>
        <button className="primary-button" type="button" onClick={applyAll}>确认 {processed} 条处理并生成最终简历 →</button>
      </div>
      <div className="batch-revision-list">
        {risks.map((risk) => {
          const choice = choices[risk.id] ?? "keep";
          return <article className="batch-revision-card" key={risk.id}>
            <div className="batch-revision-head"><span className={`severity ${risk.severity}`}>{risk.severity === "high" ? "高风险" : risk.severity === "medium" ? "中风险" : "低风险"}</span><code>{risk.claim.id} · {risk.id}</code><strong>{risk.type}</strong></div>
            <p className="batch-before">{risk.claim.text}</p>
            <div className="batch-choices">
              <button type="button" className={choice === "keep" ? "active risky" : ""} onClick={() => setChoices((current) => ({ ...current, [risk.id]: "keep" }))}><strong>保留原文</strong><small>保留当前表达</small></button>
              <button type="button" className={choice === "weaken" ? "active recommended" : ""} onClick={() => setChoices((current) => ({ ...current, [risk.id]: "weaken" }))}><strong>回到事实边界</strong><small>{risk.suggestion}</small></button>
              <button type="button" className={`delete-choice ${choice === "delete" ? "active" : ""}`} onClick={() => setChoices((current) => ({ ...current, [risk.id]: "delete" }))}><strong>不写入最终简历</strong><small>删除此 Claim</small></button>
            </div>
          </article>;
        })}
      </div>
    </div>
  );
}

function FinalReport({ project, risks }: { project: GroundedProject; risks: LiveRisk[] }) {
  const [copied, setCopied] = useState(false);
  const revisions = project.resume?.revisions ?? [];
  const interviews = project.resume?.interviewResponses ?? [];
  const finalClaims = project.resume?.claims ?? [];
  const sectionOrder: ResumeClaim["section"][] = ["工作经历", "项目经历", "教育与研究", "技能", "奖项/证书", "作品与链接", "其他经历"];
  const finalSections = sectionOrder.map((section) => ({
    section,
    entries: Array.from(new Map(finalClaims.filter((claim) => claim.section === section).map((claim) => [claim.experienceId, {
      title: claim.experienceTitle,
      meta: claim.experienceMeta,
      claims: finalClaims.filter((item) => item.section === section && item.experienceId === claim.experienceId),
    }])).values()),
  })).filter((item) => item.entries.length);
  const traceability = project.resume?.claims.length
    ? Math.round((project.resume.claims.filter((claim) => claim.facts.length > 0).length / project.resume.claims.length) * 100)
    : 0;
  function copySummary() {
    const content = [
      `${project.candidateName}｜${project.resume?.targetTitle ?? project.job.title}`,
      project.job.company ? `目标公司：${project.job.company}` : "",
      ...finalSections.flatMap(({ section, entries }) => [
        `\n${section}`,
        ...entries.flatMap((entry) => [`${entry.title}${entry.meta ? `｜${entry.meta}` : ""}`, ...entry.claims.map((claim) => `- ${claim.text}`)]),
      ]),
    ].filter(Boolean).join("\n");
    navigator.clipboard?.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div className="page report-page">
      <div className="report-hero"><span className="eyebrow">STEP 07 · READY TO APPLY</span><h1>这份简历，可以投递，也可以解释</h1><p>{project.resume?.confirmedFactCount ?? 0} 条确认事实支撑 {project.resume?.claims.length ?? 0} 条当前 Claim；请在投递前处理仍存在的高风险表述。</p><div><button type="button" className="primary-button" onClick={copySummary}>{copied ? "已复制完整简历" : "复制完整简历 Markdown"}</button><button type="button" className="ghost-button" onClick={() => document.getElementById("final-application-resume")?.scrollIntoView({ behavior: "smooth" })}>查看完整投递版 ↓</button><button type="button" className="ghost-button" onClick={() => window.print()}>打印 / 导出 PDF</button></div></div>
      <div className="report-metrics"><div><strong>{project.resume?.claims.length ?? 0}</strong><span>当前 Claim</span></div><div><strong>{traceability}%</strong><span>事实可追溯率</span></div><div><strong>{risks.filter((risk) => risk.severity === "high").length}</strong><span>待处理高风险</span></div><div><strong>{interviews.length}</strong><span>已完成追问</span></div></div>
      <section className="final-resume-preview" id="final-application-resume">
        <div className="final-resume-head"><div><span className="card-category">FINAL RESUME · 已应用本轮修改</span><h2>完整投递版简历</h2><p>以下是应用保留、弱化、删除决定后的全部内容；可直接复制或导出。</p><h2 className="candidate-name">{project.candidateName}</h2><p>{project.resume?.targetTitle ?? project.job.title}{project.job.company ? ` · ${project.job.company}` : ""}</p></div><span>{finalClaims.length} 条最终 Claim</span></div>
        {finalSections.length ? finalSections.map(({ section, entries }) => <section className="final-resume-section" key={section}><h3>{section}</h3>{entries.map((entry) => <div className="final-resume-entry" key={`${section}-${entry.title}`}><div className="final-entry-head"><strong>{entry.title}</strong>{entry.meta && <small>{entry.meta}</small>}</div>{entry.claims.map((claim) => <p key={claim.id}><i />{claim.text}<code>{claim.id}</code></p>)}</div>)}</section>) : <p className="detail-copy">所有 Claim 均被删除。请返回“反向修改”保留至少一条可确认的经历表述。</p>}
      </section>
      <div className="report-grid">
        <section className="report-section"><span className="card-category">修改记录</span><h2>本次项目实际做了什么改变</h2>{revisions.length ? revisions.map((revision) => <div className="change-row" key={revision.id}><span>{revision.action === "weaken" ? "弱化" : revision.action === "delete" ? "未写入" : "保留"}</span><p>{revision.action === "weaken" && <><del>{revision.beforeText}</del><br /><ins>{revision.afterText}</ins></>}{revision.action === "delete" && <del>{revision.beforeText}</del>}{revision.action === "keep" && revision.beforeText}</p></div>) : <p className="detail-copy">尚未处理任何风险 Claim。返回“反向修改”后，选择保留、弱化或删除。</p>}</section>
        <section className="report-section"><span className="card-category">面试准备</span><h2>已记录的连续追问</h2>{interviews.length ? <ol>{interviews.map((response) => <li key={response.claimId}><strong>{response.claimId}</strong>：已保存 {response.answers.filter(Boolean).length}/3 条回答，可返回“面试追问”继续补充。</li>)}</ol> : <p className="detail-copy">尚未完成面试追问。高风险 Claim 建议先回答三层问题，再决定是否采用。</p>}<div className="final-note"><strong>产品原则</strong><p>匹配岗位不是把未做过的事情写进去，而是从真实经历中找到最相关、最能自证的表达。</p></div></section>
      </div>
    </div>
  );
}

function EmptyStage({ title, copy }: { title: string; copy: string }) {
  return <div className="page"><div className="resume-empty"><span>!</span><h2>{title}</h2><p>{copy}</p></div></div>;
}

function FactLibrary({
  experiences,
  selectedExperience,
  setSelectedExperience,
  currentExperience,
  confirmed,
  pending,
  total,
  updateFact,
  upsertExperience,
  deleteExperience,
  assets,
  upsertAsset,
  deleteAsset,
  aiSettings,
  onNext,
}: {
  experiences: Experience[];
  selectedExperience: string;
  setSelectedExperience: (id: string) => void;
  currentExperience: Experience;
  confirmed: number;
  pending: number;
  total: number;
  updateFact: (factId: string, status: FactStatus) => void;
  upsertExperience: (experience: Experience) => void;
  deleteExperience: (experienceId: string) => void;
  assets: FactAsset[];
  upsertAsset: (asset: FactAsset) => void;
  deleteAsset: (assetId: string) => void;
  aiSettings: AiSettings;
  onNext: () => void;
}) {
  const [editing, setEditing] = useState<Experience | "new" | null>(null);
  const progress = total ? Math.round((confirmed / total) * 100) : 0;

  function requestDelete() {
    if (experiences.length <= 1) {
      window.alert("至少需要保留一张经历卡。你可以编辑当前经历，而不是删除。");
      return;
    }
    if (window.confirm(`确定删除“${currentExperience.title}”吗？`)) {
      deleteExperience(currentExperience.id);
    }
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">STEP 01 · EVIDENCE FIRST</span>
          <h1>先确认事实，再让 AI 写简历</h1>
          <p>原简历不是绝对真相。请逐条确认角色、行动、数字和结果，后续每句话都将从这里寻找来源。</p>
        </div>
        <button className="primary-button" type="button" onClick={onNext}>确认并分析岗位 <span>→</span></button>
      </div>

      <div className="metric-strip">
        <div><span className="metric-value">{experiences.length}</span><span>段经历</span></div>
        <div><span className="metric-value">{total}</span><span>条原子事实</span></div>
        <div><span className="metric-value green">{confirmed}</span><span>条已确认</span></div>
        <div><span className="metric-value amber">{pending}</span><span>条待确认</span></div>
        <div className="progress-metric">
          <span><strong>事实完整度</strong><b>{progress}%</b></span>
          <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
        </div>
      </div>

      <div className="content-grid">
        <aside className="experience-list">
          <div className="section-title"><span>经历卡</span><button type="button" aria-label="添加经历" onClick={() => setEditing("new")}>＋</button></div>
          {experiences.map((experience) => {
            const complete = experience.facts.filter((fact) => fact.status === "confirmed").length;
            return (
              <button
                type="button"
                className={selectedExperience === experience.id ? "experience-card selected" : "experience-card"}
                key={experience.id}
                onClick={() => setSelectedExperience(experience.id)}
              >
                <span className="card-category">{experience.category}</span>
                <strong>{experience.title}</strong>
                <small>{experience.meta}</small>
                <span className="mini-progress"><i style={{ width: `${(complete / experience.facts.length) * 100}%` }} /></span>
                <span className="card-foot">{complete}/{experience.facts.length} 已确认 <b>→</b></span>
              </button>
            );
          })}
        </aside>

        <div className="fact-panel">
          <div className="fact-panel-head">
            <div><span className="card-category">{currentExperience.id}</span><h2>{currentExperience.title}</h2><p>{currentExperience.meta}</p></div>
            <div className="fact-panel-actions">
              <button type="button" className="ghost-button" onClick={() => setEditing(currentExperience)}>编辑经历</button>
              <button type="button" className="ghost-button danger-text" onClick={requestDelete}>删除</button>
            </div>
          </div>

          <div className="fact-help"><strong>为什么要逐条确认？</strong><span>数字、责任、工具和结果需要分别确认，避免 AI 把模糊描述当成确定事实。</span></div>

          <div className="fact-table-head"><span>原子事实</span><span>来源</span><span>状态与操作</span></div>
          <div className="fact-rows">
            {currentExperience.facts.map((fact) => (
              <article className="fact-row" key={fact.id}>
                <div className="fact-copy">
                  <div><code>{fact.id}</code><span className="fact-type">{fact.type}</span></div>
                  <p>{fact.text}</p>
                </div>
                <div className="source-cell"><span>⌁</span>{fact.source}</div>
                <div className="fact-actions">
                  <span className={`status ${fact.status}`}>{statusLabel[fact.status]}</span>
                  <div>
                    <button type="button" className={fact.status === "confirmed" ? "action selected" : "action"} onClick={() => updateFact(fact.id, "confirmed")}>✓ 符合事实</button>
                    <button type="button" className={fact.status === "uncertain" ? "action selected warning" : "action"} onClick={() => updateFact(fact.id, "uncertain")}>? 不确定</button>
                    <button type="button" className={fact.status === "rejected" ? "action selected danger" : "action"} onClick={() => updateFact(fact.id, "rejected")}>× 不采用</button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="guardrail">
            <div><span className="shield">!</span><strong>本段经历的禁止推断</strong></div>
            <ul>{currentExperience.forbidden.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
      </div>
      <AssetLibrary assets={assets} updateFact={updateFact} upsertAsset={upsertAsset} deleteAsset={deleteAsset} />
      {editing && (
        <ExperienceEditor
          experience={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(experience) => {
            upsertExperience(experience);
            setEditing(null);
          }}
          aiSettings={aiSettings}
        />
      )}
    </div>
  );
}

function AssetLibrary({
  assets,
  updateFact,
  upsertAsset,
  deleteAsset,
}: {
  assets: FactAsset[];
  updateFact: (factId: string, status: FactStatus) => void;
  upsertAsset: (asset: FactAsset) => void;
  deleteAsset: (assetId: string) => void;
}) {
  const [editing, setEditing] = useState<FactAsset | "new" | null>(null);
  return <section className="asset-library">
    <div className="asset-library-head">
      <div><span className="eyebrow">FACT ASSET LIBRARY</span><h2>其他事实资产</h2><p>技能、教育与研究、奖项证书、作品与链接会参与 JD 匹配，并分别进入简历的对应栏目，不会被混入“其他经历”。</p></div>
      <button type="button" className="ghost-button" onClick={() => setEditing("new")}>＋ 添加事实资产</button>
    </div>
    <div className="asset-grid">
      {assets.map((asset) => <article className="asset-card" key={asset.id}>
        <div className="asset-card-head"><div><span className="card-category">{asset.category}</span><h3>{asset.title}</h3><p>{asset.meta}</p></div><div><button type="button" className="text-button" onClick={() => setEditing(asset)}>编辑</button><button type="button" className="text-button danger-text" onClick={() => { if (window.confirm(`确定删除“${asset.title}”吗？`)) deleteAsset(asset.id); }}>删除</button></div></div>
        <div className="asset-facts">{asset.facts.map((fact) => <div className="asset-fact" key={fact.id}><div><code>{fact.id}</code><span className={`status ${fact.status}`}>{statusLabel[fact.status]}</span><p>{fact.text}</p></div><div className="asset-actions"><button type="button" className={fact.status === "confirmed" ? "action selected" : "action"} onClick={() => updateFact(fact.id, "confirmed")}>✓ 确认</button><button type="button" className={fact.status === "uncertain" ? "action selected warning" : "action"} onClick={() => updateFact(fact.id, "uncertain")}>? 不确定</button><button type="button" className={fact.status === "rejected" ? "action selected danger" : "action"} onClick={() => updateFact(fact.id, "rejected")}>× 不采用</button></div></div>)}</div>
      </article>)}
    </div>
    {!assets.length && <div className="asset-empty"><strong>还没有其他事实资产</strong><p>添加你确认过的技能、教育研究、奖项证书或作品链接；它们不会被当作项目经历，也不会自动升级为工作成果。</p></div>}
    {editing && <AssetEditor asset={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSave={(asset) => { upsertAsset(asset); setEditing(null); }} />}
  </section>;
}

function AssetEditor({ asset, onClose, onSave }: { asset: FactAsset | null; onClose: () => void; onSave: (asset: FactAsset) => void }) {
  const [category, setCategory] = useState<FactAsset["category"]>(asset?.category ?? "技能卡");
  const [title, setTitle] = useState(asset?.title ?? "");
  const [meta, setMeta] = useState(asset?.meta ?? "");
  const [factsText, setFactsText] = useState(asset?.facts.map((fact) => fact.text).join("\n") ?? "");
  const [forbiddenText, setForbiddenText] = useState(asset?.forbidden.join("\n") ?? "不得夸大技能等级、奖项影响力或作品上线状态");
  const [error, setError] = useState("");
  function save() {
    const lines = factsText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!title.trim() || !lines.length) { setError("请填写资产名称，并至少添加一条可确认事实。"); return; }
    onSave({ id: asset?.id ?? `AST-${Date.now()}`, category, title: title.trim(), meta: meta.trim() || "用户手动添加", facts: lines.map((text, index) => {
      const previous = asset?.facts[index];
      return { id: previous?.id ?? `FA${Date.now().toString().slice(-6)}${index + 1}`, text, type: previous?.type ?? "待确认事实", status: previous?.text === text ? previous.status : "pending", source: previous?.text === text ? previous.source : `用户手动填写 · ${category}` };
    }), forbidden: forbiddenText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) });
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="experience-modal" role="dialog" aria-modal="true" aria-labelledby="asset-editor-title">
      <div className="modal-heading"><div><span className="card-category">{asset ? "编辑事实资产" : "添加事实资产"}</span><h2 id="asset-editor-title">{asset ? asset.title : "补充非经历类事实"}</h2></div><button type="button" onClick={onClose} aria-label="关闭">×</button></div>
      <p className="asset-editor-help">每行写一个真实、可核实的主张。它会参与岗位匹配，但只有确认后才会被写入简历。</p>
      <div className="modal-grid"><label>资产类型<select value={category} onChange={(event) => setCategory(event.target.value as FactAsset["category"])}><option>技能卡</option><option>教育与研究卡</option><option>获奖/证书卡</option><option>作品与链接卡</option></select></label><label>资产名称<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：LLM 与 Agent 研究方向" /></label><label className="full-field">背景、等级、时间或链接<input value={meta} onChange={(event) => setMeta(event.target.value)} placeholder="例如：硕士在读｜作品链接可公开查看" /></label><label className="full-field">真实事实（每行一条）<textarea value={factsText} onChange={(event) => setFactsText(event.target.value)} placeholder={"使用 Codex 辅助搭建 Web Demo\n研究方向涉及 LLM、Agent 与城市仿真"} /></label><label className="full-field">禁止推断（每行一条）<textarea className="short-textarea" value={forbiddenText} onChange={(event) => setForbiddenText(event.target.value)} /></label></div>
      {error && <p className="modal-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose}>取消</button><button type="button" className="primary-button" onClick={save}>保存事实资产</button></div>
    </section>
  </div>;
}

function ExperienceEditor({
  experience,
  onClose,
  onSave,
  aiSettings,
}: {
  experience: Experience | null;
  onClose: () => void;
  onSave: (experience: Experience) => void;
  aiSettings: AiSettings;
}) {
  const [category, setCategory] = useState(experience?.category ?? "项目经历");
  const [title, setTitle] = useState(experience?.title ?? "");
  const [meta, setMeta] = useState(experience?.meta ?? "");
  const [factsText, setFactsText] = useState(experience?.facts.map((fact) => fact.text).join("\n") ?? "");
  const [forbiddenText, setForbiddenText] = useState(experience?.forbidden.join("\n") ?? "不得新增没有事实支持的数字、技能、职责和结果");
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [aiFactTypes, setAiFactTypes] = useState<Record<string, string>>({});

  function save() {
    const factLines = factsText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!title.trim() || !factLines.length) {
      setError("请填写经历名称，并至少添加一条真实事实。");
      return;
    }
    const experienceId = experience?.id ?? `EXP-${Date.now()}`;
    onSave({
      id: experienceId,
      category: category.trim() || "项目经历",
      title: title.trim(),
      meta: meta.trim() || "用户手动添加",
      facts: factLines.map((text, index) => {
        const previous = experience?.facts[index];
        return {
          id: previous?.id ?? `F${Date.now().toString().slice(-5)}${index + 1}`,
          text,
          type: previous?.type ?? aiFactTypes[text] ?? "待确认事实",
          status: previous ? (previous.text === text ? previous.status : "pending") : "pending",
          source: previous?.text === text ? previous.source : `用户手动填写 · 第 ${index + 1} 条`,
        };
      }),
      forbidden: forbiddenText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    });
  }

  async function analyzeFacts() {
    if (factsText.trim().length < 12) {
      setError("请先粘贴至少一条完整经历，再使用 AI 拆解。");
      return;
    }
    setAnalyzing(true);
    setError("");
    try {
      const facts = await splitExperienceWithAi(aiSettings, factsText);
      setFactsText(facts.map((fact) => fact.text).join("\n"));
      setAiFactTypes(Object.fromEntries(facts.map((fact) => [fact.text, fact.type])));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AI 拆解失败，请重试。");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section className="experience-modal" role="dialog" aria-modal="true" aria-labelledby="experience-editor-title">
        <div className="modal-heading">
          <div><span className="card-category">{experience ? "编辑经历卡" : "添加经历卡"}</span><h2 id="experience-editor-title">{experience ? experience.title : "添加一段真实经历"}</h2></div>
          <button type="button" onClick={onClose} aria-label="关闭">×</button>
        </div>
        <div className="modal-grid">
          <label>经历类型<select value={category} onChange={(event) => setCategory(event.target.value)}><option>工作经历</option><option>实习经历</option><option>项目经历</option><option>校园经历</option><option>教育经历</option><option>其他经历</option></select></label>
          <label>经历名称<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：GroundedCV 可信简历实验室" /></label>
          <label className="full-field">角色、时间或机构<input value={meta} onChange={(event) => setMeta(event.target.value)} placeholder="例如：独立产品项目｜2026.07—至今" /></label>
          <label className="full-field">真实经历 / 原子事实<textarea value={factsText} onChange={(event) => setFactsText(event.target.value)} placeholder={"可先粘贴完整经历，再点下方 AI 拆解；或手动每行填写一条事实。\n调研公开招聘平台中的 AI 产品岗位需求\n使用 Codex 辅助完成可在线体验的 Web Demo\n项目尚未进行正式商业化上线"} /></label>
          <label className="full-field">禁止推断（每行一条）<textarea className="short-textarea" value={forbiddenText} onChange={(event) => setForbiddenText(event.target.value)} placeholder="例如：不得把可演示原型写成正式上线产品" /></label>
        </div>
        {error && <p className="modal-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={analyzeFacts} disabled={analyzing}>{analyzing ? "AI 拆解中…" : "AI 拆解为原子事实"}</button>
          <button type="button" className="ghost-button" onClick={onClose}>取消</button>
          <button type="button" className="primary-button" onClick={save}>保存经历卡</button>
        </div>
      </section>
    </div>
  );
}

function AiSettingsDialog({
  settings,
  onClose,
  onSave,
}: {
  settings: AiSettings;
  onClose: () => void;
  onSave: (settings: AiSettings) => void;
}) {
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [model, setModel] = useState<AiSettings["model"]>(settings.model);
  const [error, setError] = useState("");
  function save() {
    if (!apiKey.trim().startsWith("sk-")) {
      setError("请输入以 sk- 开头的 DeepSeek API Key，或暂不启用 AI。\n");
      return;
    }
    onSave({ apiKey: apiKey.trim(), model });
    onClose();
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="experience-modal api-settings-modal" role="dialog" aria-modal="true" aria-labelledby="ai-settings-title">
      <div className="modal-heading"><div><span className="card-category">DEEPSEEK · 本次会话</span><h2 id="ai-settings-title">AI 设置</h2></div><button type="button" onClick={onClose} aria-label="关闭">×</button></div>
      <div className="api-privacy-note"><strong>你的 Key 不会被保存。</strong><p>它只保留在当前打开的页面内，用于直接请求 DeepSeek；刷新、关闭页面或点击清空项目后即失效。AI 只会在你点击“AI 拆解”或“AI 按岗位改写”时收到相应文本。</p></div>
      <div className="modal-grid">
        <label className="full-field">DeepSeek API Key<input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-..." /></label>
        <label className="full-field">模型<select value={model} onChange={(event) => setModel(event.target.value as AiSettings["model"])}><option value="deepseek-v4-flash">deepseek-v4-flash（默认，成本较低）</option><option value="deepseek-v4-pro">deepseek-v4-pro（更强的复杂改写）</option></select></label>
      </div>
      {error && <p className="modal-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="ghost-button" onClick={() => { onSave({ apiKey: "", model }); onClose(); }}>暂不使用 AI</button><button type="button" className="primary-button" onClick={save}>保存到当前会话</button></div>
    </section>
  </div>;
}

function StagePlaceholder({ activeStep, onBack }: { activeStep: number; onBack: () => void }) {
  return (
    <div className="page placeholder-page">
      <span className="eyebrow">STEP {String(activeStep + 1).padStart(2, "0")}</span>
      <h1>{STEPS[activeStep][1]}</h1>
      <p>{STEPS[activeStep][2]}。页面结构已就位，交互和规则将在下一开发批次接入。</p>
      <div className="placeholder-card">
        <span>{STEPS[activeStep][0]}</span>
        <div><strong>本阶段设计已确认</strong><p>你可以通过左侧导航检查完整产品链路，不会丢失事实库中的确认结果。</p></div>
      </div>
      <button type="button" className="ghost-button" onClick={onBack}>← 返回上一步</button>
    </div>
  );
}
