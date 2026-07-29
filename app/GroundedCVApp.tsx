"use client";

import { useMemo, useState } from "react";

type FactStatus = "pending" | "confirmed" | "uncertain" | "rejected";

type Fact = {
  id: string;
  text: string;
  type: string;
  status: FactStatus;
  source: string;
};

type Experience = {
  id: string;
  title: string;
  meta: string;
  category: string;
  facts: Fact[];
  forbidden: string[];
};

const STEPS = [
  ["01", "经历事实库", "确认 AI 能使用的事实"],
  ["02", "目标岗位", "拆解 JD 与事实覆盖"],
  ["03", "岗位化简历", "生成整份可追溯简历"],
  ["04", "Claim 风险", "发现夸大与无依据表述"],
  ["05", "面试追问", "验证每条 Claim 能否自证"],
  ["06", "反向修改", "弱化或删除不可信内容"],
  ["07", "最终报告", "导出可信投递版本"],
];

const INITIAL_EXPERIENCES: Experience[] = [
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
  const [activeStep, setActiveStep] = useState(0);
  const [experiences, setExperiences] = useState(INITIAL_EXPERIENCES);
  const [selectedExperience, setSelectedExperience] = useState("EXP-02");
  const [notice, setNotice] = useState("");

  const facts = useMemo(() => experiences.flatMap((item) => item.facts), [experiences]);
  const confirmed = facts.filter((fact) => fact.status === "confirmed").length;
  const pending = facts.filter((fact) => fact.status === "pending").length;
  const currentExperience = experiences.find((item) => item.id === selectedExperience) ?? experiences[0];

  function updateFact(factId: string, status: FactStatus) {
    setExperiences((items) =>
      items.map((experience) => ({
        ...experience,
        facts: experience.facts.map((fact) => (fact.id === factId ? { ...fact, status } : fact)),
      })),
    );
    setNotice(status === "confirmed" ? `${factId} 已加入可信事实库` : `${factId} 已标记为${statusLabel[status]}`);
    window.setTimeout(() => setNotice(""), 2200);
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

        <div className="case-label">当前案例</div>
        <button className="case-card" type="button">
          <span className="case-icon">得</span>
          <span><strong>得物 · AI 产品实习</strong><small>匿名示例 · 林舟</small></span>
          <span>⌄</span>
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
          <p><strong>仅保存在当前浏览器</strong><br />首版不会上传个人数据</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumb">求职项目 <span>/</span> 得物 AI 产品实习 <span>/</span> {STEPS[activeStep][1]}</div>
          <div className="top-actions"><button type="button" className="ghost-button">重新开始</button><button type="button" className="avatar">林</button></div>
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
            onNext={() => setActiveStep(1)}
          />
        ) : activeStep === 1 ? (
          <JobAnalysis onNext={() => setActiveStep(2)} />
        ) : activeStep === 2 ? (
          <ResumeStudio onNext={() => setActiveStep(3)} />
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

function JobAnalysis({ onNext }: { onNext: () => void }) {
  const covered = REQUIREMENTS.filter((item) => item.level === "covered").length;
  const partial = REQUIREMENTS.filter((item) => item.level === "partial").length;
  const missing = REQUIREMENTS.filter((item) => item.level === "missing").length;
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">STEP 02 · JOB FIT, EXPLAINED</span>
          <h1>岗位需要什么，你的事实能证明什么</h1>
          <p>不提供虚假的“87 分匹配度”。每项要求都会显示覆盖状态、支持事实和判断理由。</p>
        </div>
        <button className="primary-button" type="button" onClick={onNext}>生成岗位化简历 <span>→</span></button>
      </div>

      <div className="job-summary">
        <div className="job-company"><span className="company-mark">得</span><div><span>上海得物信息集团有限公司</span><h2>内部 AI 工具产品实习生</h2><p>需求研究 · AI 提效场景 · 产品方案 · 开发跟进 · 迭代优化</p></div></div>
        <div className="coverage-donut" style={{ "--coverage": `${((covered + partial * 0.5) / REQUIREMENTS.length) * 100}%` } as React.CSSProperties}>
          <div><strong>{covered + partial}</strong><span>项有事实响应</span></div>
        </div>
      </div>

      <div className="coverage-legend">
        <span><i className="dot covered" />{covered} 项已覆盖</span>
        <span><i className="dot partial" />{partial} 项部分覆盖</span>
        <span><i className="dot missing" />{missing} 项未覆盖</span>
        <span><i className="dot unknown" />1 项信息不足</span>
      </div>

      <div className="requirements-table">
        <div className="requirements-head"><span>岗位要求</span><span>覆盖状态</span><span>对应事实</span><span>判断依据</span></div>
        {REQUIREMENTS.map((item) => (
          <article className="requirement-row" key={item.id}>
            <div><code>{item.id}</code><strong>{item.text}</strong><small>{item.type}</small></div>
            <span className={`coverage ${item.level}`}>{coverageLabel[item.level]}</span>
            <span className={item.level === "missing" ? "fact-links muted" : "fact-links"}>{item.facts}</span>
            <p>{item.reason}</p>
          </article>
        ))}
      </div>

      <div className="missing-callout"><span>!</span><div><strong>未覆盖不等于必须“补齐”</strong><p>竞品分析、软件上线和 AI 编程 Demo 暂无事实支持，因此不会被强行写进简历。GroundedCV 完成后，才可作为新的独立项目事实。</p></div></div>
    </div>
  );
}

function ResumeStudio({ onNext }: { onNext: () => void }) {
  const [selectedClaim, setSelectedClaim] = useState("C03");
  const activeClaim = RESUME_CLAIMS.find((claim) => claim.id === selectedClaim) ?? RESUME_CLAIMS[0];
  return (
    <div className="page resume-page">
      <div className="page-heading">
        <div><span className="eyebrow">STEP 03 · GROUNDED WRITING</span><h1>整份简历，每句话都有来处</h1><p>经历已根据得物 JD 重新排序和表达，但事实边界保持不变。点击任意 Claim 查看依据。</p></div>
        <button className="primary-button" type="button" onClick={onNext}>开始 Claim 检测 <span>→</span></button>
      </div>
      <div className="resume-workspace">
        <div className="resume-paper">
          <header className="resume-header"><div><h2>林舟</h2><p>AI 产品经理实习生</p></div><span>某 C9 高校 · 硕士在读<br />上海 · 可连续实习 3 个月以上</span></header>
          <section><h3>个人概述</h3><p>具备 3 年跨角色需求研究与方案推进经验，关注 LLM 与 Agent 产品方向，能够将复杂场景转化为结构化需求、产品方案和可验证原型。</p></section>
          <section>
            <h3>工作经历</h3>
            <div className="resume-entry"><div><strong>某城市规划设计研究机构</strong><time>2021.07—2024.06</time></div><small>规划设计师</small>
              {RESUME_CLAIMS.filter((claim) => claim.section === "工作经历").map((claim) => <ClaimLine key={claim.id} claim={claim} active={selectedClaim === claim.id} onClick={() => setSelectedClaim(claim.id)} />)}
            </div>
          </section>
          <section>
            <h3>项目经历</h3>
            <div className="resume-entry"><div><strong>AI 未来办公场景概念项目</strong><time>2025.09—2025.12</time></div><small>产品设计成员</small>
              {RESUME_CLAIMS.filter((claim) => claim.section === "项目经历").map((claim) => <ClaimLine key={claim.id} claim={claim} active={selectedClaim === claim.id} onClick={() => setSelectedClaim(claim.id)} />)}
            </div>
          </section>
          <section><h3>教育与技能</h3><p>城乡规划硕士在读｜Python、SQL 基础｜ChatGPT、Gemini、Figma/墨刀｜研究方向涉及 LLM、Agent 与城市仿真</p></section>
        </div>
        <aside className="claim-source">
          <span className={`risk-flag ${activeClaim.risk}`}>{activeClaim.risk === "low" ? "低风险" : "需要核查"}</span>
          <code>{activeClaim.id}</code>
          <h2>这句话为什么能写？</h2>
          <blockquote>{activeClaim.text}</blockquote>
          <h3>事实来源</h3>
          <div className="source-tags">{activeClaim.facts.map((fact) => <span key={fact}>{fact}</span>)}</div>
          <h3>响应的 JD 要求</h3>
          <div className="source-tags jd-tags">{activeClaim.jd.map((jd) => <span key={jd}>{jd}</span>)}</div>
          <div className="source-explain"><strong>表达边界</strong><p>{activeClaim.risk === "medium" ? "包含数字或结果，需要在下一步核查证据与因果关系。" : "责任强度与事实卡一致，未新增工具、数字或项目状态。"}</p></div>
          <button type="button" className="ghost-button wide">编辑这条表述</button>
        </aside>
      </div>
    </div>
  );
}

function ClaimLine({ claim, active, onClick }: { claim: (typeof RESUME_CLAIMS)[number]; active: boolean; onClick: () => void }) {
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
  onNext: () => void;
}) {
  const progress = Math.round((confirmed / total) * 100);
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
          <div className="section-title"><span>经历卡</span><button type="button" aria-label="添加经历">＋</button></div>
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
            <button type="button" className="ghost-button">编辑经历</button>
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
