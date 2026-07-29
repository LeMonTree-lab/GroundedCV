"use client";

import { useEffect, useMemo, useState } from "react";
import StartScreen from "./StartScreen";
import {
  PROJECT_STORAGE_KEY,
  createSampleProject,
  generateGroundedResume,
  type Experience,
  type FactStatus,
  type GroundedProject,
  type JobTarget,
  type ResumeClaim,
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

export default function GroundedCVApp() {
  const [project, setProject] = useState<GroundedProject>(() => createSampleProject());
  const [savedProject, setSavedProject] = useState<GroundedProject | null>(null);
  const [screen, setScreen] = useState<"start" | "workspace">("start");
  const [hydrated, setHydrated] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [selectedExperience, setSelectedExperience] = useState("EXP-02");
  const [notice, setNotice] = useState("");

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
  const facts = useMemo(() => experiences.flatMap((item) => item.facts), [experiences]);
  const confirmed = facts.filter((fact) => fact.status === "confirmed").length;
  const pending = facts.filter((fact) => fact.status === "pending").length;
  const currentExperience = (experiences.find((item) => item.id === selectedExperience) ?? experiences[0])!;

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

  function resetProject() {
    if (!window.confirm("返回首页并清空当前浏览器中的项目数据？此操作无法撤销。")) return;
    window.localStorage.removeItem(PROJECT_STORAGE_KEY);
    setSavedProject(null);
    setProject(createSampleProject());
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
            onNext={() => setActiveStep(1)}
          />
        ) : activeStep === 1 ? (
          <JobAnalysis
            job={project.job}
            experiences={project.experiences}
            updateJob={(job) => setProject((current) => ({ ...current, job, resume: undefined }))}
            onNext={() => setActiveStep(2)}
          />
        ) : activeStep === 2 ? (
          <ResumeStudio
            project={project}
            onGenerate={() => {
              const nextResume = generateGroundedResume(project);
              setProject((current) => ({ ...current, resume: nextResume }));
              setNotice(nextResume.claims.length ? "已根据最新确认事实生成简历" : "请先确认至少一条事实，再生成简历");
              window.setTimeout(() => setNotice(""), 2400);
            }}
            onNext={() => setActiveStep(3)}
          />
        ) : activeStep === 3 ? (
          <RiskCenter onNext={() => setActiveStep(4)} />
        ) : activeStep === 4 ? (
          <InterviewTest onNext={() => setActiveStep(5)} />
        ) : activeStep === 5 ? (
          <ReverseEdit onNext={() => setActiveStep(6)} />
        ) : activeStep === 6 ? (
          <FinalReport />
        ) : (
          <StagePlaceholder activeStep={activeStep} onBack={() => setActiveStep(Math.max(0, activeStep - 1))} />
        )}
      </section>
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}

function deriveRequirements(job: JobTarget, experiences: Experience[]) {
  if (!job.description.trim()) return [];
  const allFacts = experiences.flatMap((experience) => experience.facts);
  const requirementTexts = job.description
    .split(/[\n；;。]/)
    .flatMap((part) => part.length > 45 ? part.split(/[，,]/) : [part])
    .map((part) => part.replace(/^\s*\d+[.、）)]?\s*/, "").trim())
    .filter((part) => part.length >= 5)
    .filter((part, index, items) => items.indexOf(part) === index)
    .slice(0, 12);

  const keywords = [
    "需求调研", "竞品分析", "产品方案", "业务流程", "AI提效", "需求文档",
    "产品开发", "协调研发", "推动上线", "用户反馈", "使用数据", "迭代优化",
    "趋势分析", "LLM", "Prompt", "Agent", "Skill", "Codex", "Claude", "Vibe Coding",
  ];

  return requirementTexts.map((text, index) => {
    const terms = keywords.filter((keyword) => text.toLowerCase().includes(keyword.toLowerCase()));
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
    const level =
      confirmedMatches.length >= 1
        ? "covered"
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
          ? "已找到确认事实，后续将建立逐句来源"
          : level === "partial"
            ? "存在相关事实，但尚未完成用户确认"
            : "当前事实库没有直接证据，不会强行写入简历",
    };
  });
}

function JobAnalysis({
  job,
  experiences,
  updateJob,
  onNext,
}: {
  job: JobTarget;
  experiences: Experience[];
  updateJob: (job: JobTarget) => void;
  onNext: () => void;
}) {
  const requirements = useMemo(() => deriveRequirements(job, experiences), [job, experiences]);
  const covered = requirements.filter((item) => item.level === "covered").length;
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

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">STEP 02 · JOB FIT, EXPLAINED</span>
          <h1>岗位需要什么，你的事实能证明什么</h1>
          <p>不提供虚假的“87 分匹配度”。每项要求都会显示覆盖状态、支持事实和判断理由。</p>
        </div>
        <button className="primary-button" type="button" onClick={continueToResume}>生成岗位化简历 <span>→</span></button>
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

      {requirements.length > 0 ? <>
      <div className="job-summary">
        <div className="job-company"><span className="company-mark">{job.company.slice(0, 1)}</span><div><span>{job.company}</span><h2>{job.title}</h2><p>{requirements.slice(0, 5).map((item) => item.text.slice(0, 10)).join(" · ")}</p></div></div>
        <div className="coverage-donut" style={{ "--coverage": `${((covered + partial * 0.5) / requirements.length) * 100}%` } as React.CSSProperties}>
          <div><strong>{covered + partial}</strong><span>项有事实响应</span></div>
        </div>
      </div>

      <div className="coverage-legend">
        <span><i className="dot covered" />{covered} 项已覆盖</span>
        <span><i className="dot partial" />{partial} 项部分覆盖</span>
        <span><i className="dot missing" />{missing} 项未覆盖</span>
        <span><i className="dot unknown" />规则初筛，AI 精析将在下一批接入</span>
      </div>

      <div className="requirements-table">
        <div className="requirements-head"><span>岗位要求</span><span>覆盖状态</span><span>对应事实</span><span>判断依据</span></div>
        {requirements.map((item) => (
          <article className="requirement-row" key={item.id}>
            <div><code>{item.id}</code><strong>{item.text}</strong><small>{item.type}</small></div>
            <span className={`coverage ${item.level}`}>{coverageLabel[item.level]}</span>
            <span className={item.level === "missing" ? "fact-links muted" : "fact-links"}>{item.facts}</span>
            <p>{item.reason}</p>
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
  onGenerate,
  onNext,
}: {
  project: GroundedProject;
  onGenerate: () => void;
  onNext: () => void;
}) {
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null);
  const resume = project.resume;
  const activeClaim = resume?.claims.find((claim) => claim.id === selectedClaim) ?? resume?.claims[0];
  const sourceFacts = project.experiences.flatMap((experience) => experience.facts);
  const sections: ResumeClaim["section"][] = ["工作经历", "项目经历", "其他经历"];
  const canInspect = Boolean(resume?.claims.length);

  return (
    <div className="page resume-page">
      <div className="page-heading">
        <div><span className="eyebrow">STEP 03 · GROUNDED WRITING</span><h1>整份简历，每句话都有来处</h1><p>只使用已确认事实。新增、编辑或更改事实状态后，必须重新生成，旧版本不会被悄悄沿用。</p></div>
        <div className="resume-heading-actions">
          <button className="ghost-button" type="button" onClick={onGenerate}>{resume ? "按最新事实重新生成" : "生成基于事实的简历"}</button>
          <button className="primary-button" type="button" onClick={onNext} disabled={!canInspect}>开始 Claim 检测 <span>→</span></button>
        </div>
      </div>
      {!resume ? <div className="resume-empty"><span>03</span><h2>尚未生成岗位化简历</h2><p>请先确认事实卡中的真实内容，再点击“生成基于事实的简历”。手动添加的经历默认视为你已确认；从原简历导入的内容需要逐条确认。</p></div> : resume.claims.length === 0 ? <div className="resume-empty"><span>!</span><h2>还没有可写入简历的确认事实</h2><p>返回事实库，至少确认一条你真实做过的行动、工具、结果或数字，再重新生成。</p></div> : <div className="resume-workspace">
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

function RiskCenter({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState("R01");
  const risk = RISKS.find((item) => item.id === selected) ?? RISKS[0];
  return (
    <div className="page">
      <div className="page-heading">
        <div><span className="eyebrow">STEP 04 · CLAIM INSPECTOR</span><h1>不是语法检查，而是事实边界检查</h1><p>系统比较生成 Claim 与事实库，识别新增数字、责任升级、技能注入、状态改变和因果夸大。</p></div>
        <button className="primary-button" type="button" onClick={onNext}>进入面试压力测试 <span>→</span></button>
      </div>
      <div className="risk-summary">
        <div><span className="risk-number high">1</span><p><strong>高风险</strong>建议追问后处理</p></div>
        <div><span className="risk-number medium">1</span><p><strong>中风险</strong>需要补充或弱化</p></div>
        <div><span className="risk-number low">1</span><p><strong>低风险</strong>确认事实即可保留</p></div>
        <div className="scan-note"><span>✓</span><p><strong>已检查 4 条 Claim</strong>未发现新增技能、项目状态改变或身份错位</p></div>
      </div>
      <div className="risk-layout">
        <div className="risk-list">
          {RISKS.map((item) => (
            <button type="button" key={item.id} className={selected === item.id ? "risk-card active" : "risk-card"} onClick={() => setSelected(item.id)}>
              <span className={`severity ${item.severity}`}>{item.severity === "high" ? "高" : item.severity === "medium" ? "中" : "低"}</span>
              <div><span>{item.type} · {item.claim}</span><strong>“{item.phrase}”</strong><small>{item.reason}</small></div><b>→</b>
            </button>
          ))}
        </div>
        <aside className="risk-detail">
          <div className="risk-detail-head"><span className={`severity ${risk.severity}`}>{risk.severity === "high" ? "高风险" : risk.severity === "medium" ? "中风险" : "低风险"}</span><code>{risk.id}</code></div>
          <h2>{risk.type}</h2>
          <div className="compare-box"><small>当前简历表述</small><p>{RESUME_CLAIMS.find((claim) => claim.id === risk.claim)?.text}</p><mark>{risk.phrase}</mark></div>
          <h3>检查理由</h3><p className="detail-copy">{risk.reason}</p>
          <h3>系统建议</h3><div className="suggestion-box">{risk.suggestion}</div>
          <div className="decision-buttons"><button type="button">保留原文</button><button type="button">补充事实</button><button type="button" className="recommended">进入追问 →</button></div>
        </aside>
      </div>
    </div>
  );
}

function InterviewTest({ onNext }: { onNext: () => void }) {
  const questions = [
    { level: "L1", title: "事实确认", question: "这 10+ 轮方案优化中，你本人具体参与了哪些轮次和哪些工作？", hint: "验证参与范围，避免把团队过程全部归因于个人。" },
    { level: "L2", title: "方法验证", question: "你如何收集评审意见、确定修改优先级，并推动不同角色达成一致？", hint: "验证方法细节是否足以支持“协调”和“推进”。" },
    { level: "L3", title: "结论挑战", question: "项目通过评审与个人工作的直接关系是什么？如果没有你的工作，结果一定会不同吗？", hint: "挑战因果结论，判断是否需要弱化“推动通过”。" },
  ];
  const [level, setLevel] = useState(0);
  const [answers, setAnswers] = useState(["", "", ""]);
  const [evaluated, setEvaluated] = useState(false);
  const question = questions[level];
  function saveAnswer() {
    if (level < 2) setLevel(level + 1);
    else setEvaluated(true);
  }
  return (
    <div className="page">
      <div className="page-heading">
        <div><span className="eyebrow">STEP 05 · INTERVIEW PRESSURE TEST</span><h1>如果面试官连续追问，你能答到第几层？</h1><p>针对高风险 Claim 进行事实、方法和结论三层追问。问题来自表述中的风险，而不是凭空预测。</p></div>
        <button className="primary-button" type="button" onClick={onNext}>查看反向修改 <span>→</span></button>
      </div>
      <div className="interview-layout">
        <aside className="question-rail">
          <span className="card-category">当前压力测试</span>
          <h2>C02 · 项目评审</h2>
          <blockquote>“跟进 10+ 轮方案优化并推动项目通过评审。”</blockquote>
          <div className="level-rail">
            {questions.map((item, index) => <button type="button" key={item.level} onClick={() => setLevel(index)} className={level === index ? "level active" : index < level || evaluated ? "level done" : "level"}><span>{index < level || evaluated ? "✓" : item.level}</span><div><strong>{item.title}</strong><small>{answers[index] ? "已回答" : "待回答"}</small></div></button>)}
          </div>
        </aside>
        <section className="question-stage">
          {!evaluated ? <>
            <div className="question-meta"><span>{question.level}</span><p><strong>{question.title}</strong>问题 {level + 1} / 3</p></div>
            <h2>{question.question}</h2>
            <div className="question-hint"><span>为何追问</span>{question.hint}</div>
            <label htmlFor="interview-answer">你的回答</label>
            <textarea id="interview-answer" value={answers[level]} onChange={(event) => setAnswers((items) => items.map((value, index) => index === level ? event.target.value : value))} placeholder="请像真实面试一样回答。建议包含：你的具体行动、使用的方法、参与边界和能够验证的结果。" />
            <div className="answer-actions"><button type="button" className="ghost-button" disabled={level === 0} onClick={() => setLevel(level - 1)}>← 上一问</button><button type="button" className="primary-button" onClick={saveAnswer}>{level === 2 ? "完成压力测试" : "保存并继续 →"}</button></div>
          </> : <div className="evaluation">
            <span className="evaluation-score">58</span><small>/ 100 可辩护性</small>
            <h2>事实和方法可以解释，因果结论不足</h2>
            <p>你的回答能够支持“参与多轮优化”和“协调评审意见”，但不能证明个人工作直接导致项目通过评审。</p>
            <div><span>✓ 保留</span><strong>参与 10+ 轮方案优化</strong></div>
            <div><span>↓ 弱化</span><strong>推动项目通过评审</strong></div>
            <button type="button" className="primary-button" onClick={onNext}>应用建议并查看修改 →</button>
          </div>}
        </section>
      </div>
    </div>
  );
}

function ReverseEdit({ onNext }: { onNext: () => void }) {
  const [choice, setChoice] = useState("weaken");
  return (
    <div className="page">
      <div className="page-heading">
        <div><span className="eyebrow">STEP 06 · REVERSE REVISION</span><h1>追问暴露的缺口，反向修改到简历里</h1><p>AI 提供不同强度的修改方案，但不会替你决定。选择后可以查看事实支持和信息损失。</p></div>
        <button className="primary-button" type="button" onClick={onNext}>确认修改并生成报告 <span>→</span></button>
      </div>
      <div className="revision-card">
        <div className="revision-before"><span>修改前 · 高风险</span><p>协调政府、专家与业务单位开展需求评审，跟进 10+ 轮方案优化并<strong>推动项目通过评审</strong>。</p></div>
        <div className="revision-arrow">↓</div>
        <div className="revision-options">
          <button type="button" onClick={() => setChoice("keep")} className={choice === "keep" ? "revision-option active risky" : "revision-option"}><span>方案 A</span><strong>保留原文</strong><p>信息完整，但“推动通过”仍缺少直接因果证据。</p><b>风险未解除</b></button>
          <button type="button" onClick={() => setChoice("weaken")} className={choice === "weaken" ? "revision-option active recommended" : "revision-option"}><span>方案 B · 推荐</span><strong>弱化因果关系</strong><p>协调多方开展需求评审，参与 10+ 轮方案优化，相关项目最终通过专家评审。</p><b>保留亮点，风险降低</b></button>
          <button type="button" onClick={() => setChoice("delete")} className={choice === "delete" ? "revision-option active" : "revision-option"}><span>方案 C</span><strong>删除结果</strong><p>协调多方开展需求评审，参与 10+ 轮方案优化。</p><b>最可信，但损失结果信息</b></button>
        </div>
        <div className="revision-result"><span>当前选择</span><p>{choice === "keep" ? "协调政府、专家与业务单位开展需求评审，跟进 10+ 轮方案优化并推动项目通过评审。" : choice === "delete" ? "协调政府、专家与业务单位开展需求评审，参与 10+ 轮方案优化。" : "协调政府、专家与业务单位开展需求评审，参与 10+ 轮方案优化，相关项目最终通过专家评审。"}</p><div><span>事实来源 F108 · F109 · F110</span><strong>{choice === "keep" ? "仍有 1 项高风险" : "风险已解除"}</strong></div></div>
      </div>
    </div>
  );
}

function FinalReport() {
  const [copied, setCopied] = useState(false);
  function copySummary() {
    navigator.clipboard?.writeText("GroundedCV 最终简历：已通过事实与面试压力检查。");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div className="page report-page">
      <div className="report-hero"><span className="eyebrow">STEP 07 · READY TO APPLY</span><h1>这份简历，可以投递，也可以解释</h1><p>12 条事实完成核查，4 条核心 Claim 均可追溯；1 条高风险表述已根据面试回答弱化。</p><div><button type="button" className="primary-button" onClick={copySummary}>{copied ? "已复制" : "复制 Markdown"}</button><button type="button" className="ghost-button" onClick={() => window.print()}>打印 / 导出 PDF</button></div></div>
      <div className="report-metrics"><div><strong>4</strong><span>最终采用 Claim</span></div><div><strong>100%</strong><span>事实可追溯率</span></div><div><strong>0</strong><span>未处理高风险</span></div><div><strong>58→82</strong><span>可辩护性提升</span></div></div>
      <div className="report-grid">
        <section className="report-section"><span className="card-category">修改记录</span><h2>系统做了什么改变</h2><div className="change-row"><span>弱化</span><p><del>推动项目通过评审</del><br /><ins>相关项目最终通过专家评审</ins></p></div><div className="change-row"><span>保留</span><p>参与 10+ 轮方案优化——回答能够支持具体参与范围和方法。</p></div><div className="change-row"><span>未写入</span><p>竞品分析、软件上线、Vibe Coding——当前事实库没有支持材料。</p></div></section>
        <section className="report-section"><span className="card-category">面试准备</span><h2>建议重点准备 3 个问题</h2><ol><li>如何把多方访谈结果整理成需求池并确定优先级？</li><li>AI 未来办公项目为什么选择公开评价，而不是真人访谈？</li><li>你对 Agent、Prompt 和 Skill 的理解分别是什么？</li></ol><div className="final-note"><strong>产品原则</strong><p>匹配岗位不是把未做过的事情写进去，而是从真实经历中找到最相关、最能自证的表达。</p></div></section>
      </div>
    </div>
  );
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
      {editing && (
        <ExperienceEditor
          experience={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(experience) => {
            upsertExperience(experience);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ExperienceEditor({
  experience,
  onClose,
  onSave,
}: {
  experience: Experience | null;
  onClose: () => void;
  onSave: (experience: Experience) => void;
}) {
  const [category, setCategory] = useState(experience?.category ?? "项目经历");
  const [title, setTitle] = useState(experience?.title ?? "");
  const [meta, setMeta] = useState(experience?.meta ?? "");
  const [factsText, setFactsText] = useState(experience?.facts.map((fact) => fact.text).join("\n") ?? "");
  const [forbiddenText, setForbiddenText] = useState(experience?.forbidden.join("\n") ?? "不得新增没有事实支持的数字、技能、职责和结果");
  const [error, setError] = useState("");

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
          type: previous?.type ?? "用户确认事实",
          status: previous ? (previous.text === text ? previous.status : "pending") : "confirmed",
          source: previous?.text === text ? previous.source : `用户手动填写 · 第 ${index + 1} 条`,
        };
      }),
      forbidden: forbiddenText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    });
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
          <label className="full-field">真实事实（每行一条）<textarea value={factsText} onChange={(event) => setFactsText(event.target.value)} placeholder={"调研公开招聘平台中的 AI 产品岗位需求\n使用 Codex 辅助完成可在线体验的 Web Demo\n项目尚未进行正式商业化上线"} /></label>
          <label className="full-field">禁止推断（每行一条）<textarea className="short-textarea" value={forbiddenText} onChange={(event) => setForbiddenText(event.target.value)} placeholder="例如：不得把可演示原型写成正式上线产品" /></label>
        </div>
        {error && <p className="modal-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>取消</button>
          <button type="button" className="primary-button" onClick={save}>保存经历卡</button>
        </div>
      </section>
    </div>
  );
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
