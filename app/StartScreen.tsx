"use client";

import { useRef, useState } from "react";
import { parseResumeFile } from "./file-parser";
import {
  createEmptyProject,
  createPersonalProject,
  createSampleProject,
  type GroundedProject,
} from "./product-model";

type StartScreenProps = {
  savedProject: GroundedProject | null;
  onStart: (project: GroundedProject) => void;
  onOpenApiSettings: () => void;
};

export default function StartScreen({ savedProject, onStart, onOpenApiSettings }: StartScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const parsed = await parseResumeFile(file);
      onStart(createPersonalProject(parsed.text, parsed.fileName));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "文件读取失败，请稍后重试。");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handlePaste() {
    const text = resumeText.trim();
    if (text.length < 30) {
      setError("请至少粘贴 30 个字的简历内容，或选择“手动创建”。");
      return;
    }
    onStart(createPersonalProject(text, "粘贴的简历文本"));
  }

  return (
    <main className="start-page">
      <header className="start-header">
        <a className="start-brand" href="#" aria-label="GroundedCV 首页">
          <span className="brand-mark">G</span>
          <span><strong>GroundedCV</strong><small>可信简历实验室</small></span>
        </a>
        <button className="start-api-button" type="button" onClick={onOpenApiSettings}>
          AI 设置 · 免费试用 / 自带 API
        </button>
      </header>

      <section className="start-hero">
        <span className="eyebrow">FACTS → RESUME → INTERVIEW</span>
        <h1>把每一句简历，变成<br />经得住追问的证据</h1>
        <p>
          导入你的真实经历，结合目标岗位生成完整简历；系统会检查夸大和无依据表述，
          再通过连续面试追问帮你决定保留、弱化或删除。
        </p>

        <div className="start-actions">
          <button className="primary-button start-primary" type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? "正在读取简历…" : "上传 PDF / DOCX"} <span>↑</span>
          </button>
          <button className="ghost-button start-secondary" type="button" onClick={() => setPasteOpen((open) => !open)}>
            粘贴简历文字
          </button>
          <input
            ref={inputRef}
            className="visually-hidden"
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </div>

        {error && <div className="start-error" role="alert">{error}</div>}

        {pasteOpen && (
          <div className="paste-panel">
            <label htmlFor="resume-paste">粘贴你的完整简历</label>
            <textarea
              id="resume-paste"
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              placeholder={"廉梦婷\n求职意向：AI 产品经理实习生\n\n教育经历\n……\n\n工作经历\n……"}
            />
            <div>
              <button className="ghost-button" type="button" onClick={() => onStart(createEmptyProject())}>手动创建</button>
              <button className="primary-button" type="button" onClick={handlePaste}>解析并建立事实库 →</button>
            </div>
          </div>
        )}

        <div className="start-shortcuts">
          <button type="button" onClick={() => onStart(createSampleProject())}>
            <span className="shortcut-icon">▶</span>
            <span><strong>先看匿名示例</strong><small>90 秒体验完整工作流</small></span>
            <b>→</b>
          </button>
          {savedProject && (
            <button type="button" onClick={() => onStart(savedProject)}>
              <span className="shortcut-icon saved">↻</span>
              <span><strong>继续上次项目</strong><small>{savedProject.sourceName}</small></span>
              <b>→</b>
            </button>
          )}
        </div>
      </section>

      <section className="start-flow" aria-label="产品工作流">
        {[
          ["01", "确认事实", "经历拆成可以逐条确认的证据"],
          ["02", "匹配岗位", "看清 JD 已覆盖与未覆盖要求"],
          ["03", "检查 Claim", "标出数字、职责和结果风险"],
          ["04", "经受追问", "回答后反向修正简历表达"],
        ].map((item) => (
          <article key={item[0]}>
            <span>{item[0]}</span>
            <strong>{item[1]}</strong>
            <p>{item[2]}</p>
          </article>
        ))}
      </section>

      <footer className="start-privacy">
        <strong>文件在当前浏览器中解析</strong>
        <span>简历、JD 和生成结果默认保存在当前设备，你可以随时清空。</span>
        <span>后续使用 AI 时，页面会再次说明哪些文字将发送至 DeepSeek。</span>
      </footer>
    </main>
  );
}
