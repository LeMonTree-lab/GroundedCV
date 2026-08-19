import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GroundedCV Case Study｜可信 AI 简历生成工具",
  description: "GroundedCV：从真实事实资产出发，帮助转行与跨专业求职者生成可解释、可核对的岗位化简历。",
};

const DEMO_URL = "https://groundedcv-lab.lianmt-hit.workers.dev";
const GITHUB_URL = "https://github.com/LeMonTree-lab/GroundedCV";

export default function CaseStudyPage() {
  return <main className="case-study-page">
    <nav className="case-nav"><a href="/">GroundedCV</a><div><a href={DEMO_URL}>在线体验</a><a href={GITHUB_URL}>GitHub</a></div></nav>
    <section className="case-hero"><span>PRODUCT CASE STUDY · 2026.07—至今</span><h1>不是把经历写得更漂亮，<br />而是让它经得住追问。</h1><p>GroundedCV 是一款可信 AI 简历生成工具：从真实事实出发，帮助转行与跨专业求职者将既有经历安全地映射到目标岗位。</p><div><a className="case-primary" href={DEMO_URL}>体验在线 Demo →</a><a className="case-secondary" href={GITHUB_URL}>查看项目代码</a></div></section>
    <section className="case-facts"><article><b>01</b><strong>真实问题</strong><p>经历不对口时，用户不知道该怎么关联目标岗位。</p></article><article><b>02</b><strong>可信边界</strong><p>AI 改写容易把参与经历升级成个人成果。</p></article><article><b>03</b><strong>可交互产出</strong><p>完成从事实确认到投递草稿的完整闭环。</p></article></section>
    <section className="case-section"><span>01 · PROBLEM</span><h2>转行不是“补造经历”，而是找出真实的可迁移能力。</h2><p className="case-lead">我在整理同学求职材料时发现：跨专业求职者常有真实但“不像目标岗位”的经历；使用普通 AI 改写时，又容易出现责任、结果或项目状态被放大的问题。</p><div className="case-quote">“如何让 AI 帮我匹配岗位，又不把我没做过的事写进简历？”</div></section>
    <section className="case-section case-tint"><span>02 · PRODUCT MECHANISM</span><h2>把生成过程拆成可核对的六步。</h2><div className="case-flow">{["事实资产库", "JD 语义匹配", "岗位化生成", "Claim 校验", "连续追问", "可编辑投递草稿"].map((item, index) => <article key={item}><b>0{index + 1}</b><strong>{item}</strong><p>{["经历、技能、教育、奖项与作品统一为真实资产", "区分直接覆盖、可迁移、待补证与未覆盖", "只引用已确认事实生成表达", "检查数字、责任、结果与状态边界", "准备能说清个人作用、方法与证据的回答", "编辑、排序、复制或导出前重新核对"][index]}</p></article>)}</div></section>
    <section className="case-section"><span>03 · CASE TESTING & ITERATION</span><h2>使用 5 份同学简历进行内部案例测试，再迭代规则。</h2><p className="case-lead">测试由我代为导入与检查，不将其表述为用户访谈或可用性研究。案例测试帮助暴露产品流程中的四个实际问题。</p><div className="case-iterations"><article><b>导入不完整</b><p>经历卡缺失，或只识别项目/实习而忽略基础事实。</p><strong>→ 扩展工作、实习、项目、校园经历识别；将技能、教育、奖项、作品纳入统一事实资产库。</strong></article><article><b>确认负担高</b><p>每一条事实都要求确认，导致使用门槛过高。</p><strong>→ 来源清楚的直接事实自动收录；数字、责任范围、因果结果与模糊描述才需确认。</strong></article><article><b>Claim 选项过多</b><p>普通技能、教育信息也进入追问，影响聚焦。</p><strong>→ 仅保留高风险或工作/项目中的关键 Claim，控制在 5–10 条。</strong></article><article><b>弱化无实质变化</b><p>仅替换一个动词，仍保留过强结果承诺。</p><strong>→ 弱化必须回到原始事实，移除无依据的因果、责任或结果表述。</strong></article></div></section>
    <section className="case-section case-dark"><span>04 · MY CONTRIBUTION</span><h2>产品判断由我负责，Codex 用于协作开发。</h2><div className="case-contribution"><div><strong>我主导</strong><p>问题定义、产品机制、事实与 Claim 规则边界、交互流程、案例测试与迭代决策。</p></div><div><strong>Codex 协作</strong><p>使用 Codex 协作完成 React 前端、Cloudflare Worker、DeepSeek API 接入与在线部署。</p></div><div><strong>当前状态</strong><p>已完成可在线体验 Demo、岗位化简历草稿、Claim 校验、连续追问、反向修改与完整度提示。</p></div></div></section>
    <section className="case-section"><span>05 · WHAT TO EXPLORE</span><h2>下一步：验证“完整度与可编辑性”是否真正降低投递准备成本。</h2><p className="case-lead">下一轮将邀请求职者实际操作可编辑投递草稿，重点观察：是否能补全关键经历、是否理解未覆盖 JD、以及修改后是否仍能保持事实边界。</p><a className="case-primary" href={DEMO_URL}>打开 GroundedCV 在线体验 →</a></section>
    <footer className="case-footer">GroundedCV · 可信简历实验室 · <a href={GITHUB_URL}>GitHub</a></footer>
  </main>;
}
