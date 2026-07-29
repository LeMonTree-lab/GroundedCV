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
  assert.match(html, /先确认事实，再让 AI 写简历/);
  assert.match(html, /得物 · AI 产品实习/);
  assert.match(html, /经历事实库/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});

test("keeps the seven-stage product flow in the client app", async () => {
  const app = await readFile(new URL("../app/GroundedCVApp.tsx", import.meta.url), "utf8");
  for (const label of ["经历事实库", "目标岗位", "岗位化简历", "Claim 风险", "面试追问", "反向修改", "最终报告"]) {
    assert.match(app, new RegExp(label));
  }
  assert.match(app, /R01/);
  assert.match(app, /F102/);
  assert.match(app, /navigator\.clipboard/);
  assert.match(app, /window\.print/);
});
