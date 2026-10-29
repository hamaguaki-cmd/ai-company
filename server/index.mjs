// NEON-RESEARCH DIV. — office server
// Serves the office screen and runs the AI staff (project skills) through the Claude Agent SDK.
// Live progress reaches the browser over Server-Sent Events:
//   - state/activity.jsonl lines written by each skill (bin/log.sh)
//   - tool calls observed in the SDK message stream
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "@anthropic-ai/claude-agent-sdk";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.AI_COMPANY_MODEL || "claude-opus-5-5";
const MAX_BUDGET_USD = Number(process.env.AI_COMPANY_MAX_BUDGET_USD || 5);
const LOG = path.join(ROOT, "state", "activity.jsonl");
const RESEARCH = path.join(ROOT, "research");

// Tools the staff may use without asking. Everything else is denied (permissionMode: dontAsk),
// so a run never stalls waiting for an approval nobody can give.
const ALLOWED_TOOLS = [
  "Skill", "Agent", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch",
  "Bash(bash bin/log.sh:*)", "Bash(mkdir:*)", "Bash(ls:*)", "Bash(cp:*)",
];

/* ---------- SSE ---------- */
const clients = new Set();
function broadcast(ev) {
  const line = `data: ${JSON.stringify({ at: new Date().toISOString(), ...ev })}\n\n`;
  for (const res of clients) res.write(line);
}

/* ---------- activity log tail ---------- */
fs.mkdirSync(path.dirname(LOG), { recursive: true });
if (!fs.existsSync(LOG)) fs.writeFileSync(LOG, "");
let offset = fs.statSync(LOG).size;
let partial = "";
function readNewActivity() {
  const size = fs.statSync(LOG).size;
  if (size < offset) offset = 0;
  if (size === offset) return;
  const fd = fs.openSync(LOG, "r");
  const buf = Buffer.alloc(size - offset);
  fs.readSync(fd, buf, 0, buf.length, offset);
  fs.closeSync(fd);
  offset = size;
  const lines = (partial + buf.toString("utf8")).split("\n");
  partial = lines.pop();
  for (const l of lines) {
    if (!l.trim()) continue;
    try {
      const ev = JSON.parse(l);
      if (job && ev.status === "working") job.currentAgent = ev.agent;
      broadcast({ type: "activity", ...ev });
    } catch { /* ignore malformed lines */ }
  }
}
fs.watchFile(LOG, { interval: 400 }, readNewActivity);

/* ---------- cases ---------- */
function listReports() {
  if (!fs.existsSync(RESEARCH)) return [];
  return fs.readdirSync(RESEARCH, { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(RESEARCH, d.name, "report.html")))
    .map(d => ({ slug: d.name, mtime: fs.statSync(path.join(RESEARCH, d.name, "report.html")).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
}

/* ---------- job runner ---------- */
let job = null;

// Friendly, code-free descriptions for the office screen. Returns null for steps not worth showing.
const SKILL_STAFF = {
  "yt-trend-scout": "マシュマロ", "yt-competitor-analyst": "いちご", "yt-audience-profiler": "ぶどう",
  "yt-theme-planner": "にんじん", "yt-script-writer": "のりまき", "yt-thumbnail-designer": "マカロン",
  "yt-report-designer": "えだまめ",
};
function describeTool(block) {
  const i = block.input || {};
  switch (block.name) {
    case "WebSearch": return `「${i.query ?? ""}」を検索中`;
    case "WebFetch": return "記事を読んでいます";
    case "Skill": { const who = SKILL_STAFF[i.skill ?? i.command]; return who ? `${who}に仕事をお願い` : null; }
    case "Agent": return "チームに仕事をお願い";
    case "Write": case "Edit": return "資料をまとめています";
    case "Read": return "資料を確認しています";
    default: return null;
  }
}

async function runJob({ genre, target, extra }) {
  const abort = new AbortController();
  job = { genre, target, extra, startedAt: Date.now(), abort, currentAgent: "うに" };
  const before = new Map(listReports().map(r => [r.slug, r.mtime]));
  broadcast({ type: "job", status: "started", genre, target, extra });

  const prompt = [
    "yt-research-director スキル（指令室長うに）を使って、YouTubeテーマリサーチを最後まで実行してください。",
    `ジャンル：${genre}`,
    `ターゲット：${target || "指定なし（うにが決めて仮置きと明記する）"}`,
    `追加条件：${extra || "なし"}`,
    "ユーザーへの確認は不要です。report.html の納品まで止まらずに進めてください。",
    "各工程の開始と完了で、必ず bash bin/log.sh を実行してください（オフィス画面に表示されます）。",
  ].join("\n");

  try {
    for await (const msg of query({
      prompt,
      options: {
        cwd: ROOT,
        model: MODEL,
        settingSources: ["project"],
        skills: "all",
        permissionMode: "dontAsk",
        allowedTools: ALLOWED_TOOLS,
        maxBudgetUsd: MAX_BUDGET_USD,
        abortController: abort,
      },
    })) {
      if (msg.type === "assistant") {
        for (const block of msg.message.content) {
          const detail = block.type === "tool_use" ? describeTool(block) : null;
          if (detail) broadcast({ type: "tool", agent: job.currentAgent, detail });
        }
      } else if (msg.type === "result") {
        broadcast({
          type: "result",
          ok: msg.subtype === "success",
          subtype: msg.subtype,
          costUsd: msg.total_cost_usd,
          turns: msg.num_turns,
          summary: msg.subtype === "success" ? msg.result : undefined,
        });
      }
    }
  } catch (err) {
    broadcast({ type: "job", status: "error", error: String(err?.message || err) });
  }

  const fresh = listReports().find(r => before.get(r.slug) !== r.mtime);
  broadcast({
    type: "job",
    status: "finished",
    report: fresh ? `/research/${fresh.slug}/report.html` : null,
    seconds: Math.round((Date.now() - job.startedAt) / 1000),
  });
  job = null;
}

/* ---------- HTTP ---------- */
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".md": "text/markdown; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };

// Office/report pages are authored as Artifact fragments (no <html>/<body>); wrap them for the browser.
function sendPage(res, file) {
  const body = fs.readFileSync(file, "utf8");
  const html = body.trimStart().toLowerCase().startsWith("<!doctype") ? body
    : `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body style="margin:0">${body}</body></html>`;
  res.writeHead(200, { "content-type": TYPES[".html"] });
  res.end(html);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", c => { data += c; if (data.length > 1e5) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch (e) { reject(e); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = decodeURIComponent(url.pathname);

  if (p === "/api/status") {
    res.writeHead(200, { "content-type": TYPES[".json"] });
    return res.end(JSON.stringify({
      live: true, model: MODEL, running: !!job, genre: job?.genre ?? null,
      reports: listReports().map(r => `/research/${r.slug}/report.html`),
    }));
  }
  if (p === "/api/events") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    res.write(": connected\n\n");
    clients.add(res);
    const ping = setInterval(() => res.write(": ping\n\n"), 20000);
    req.on("close", () => { clearInterval(ping); clients.delete(res); });
    return;
  }
  if (p === "/api/dispatch" && req.method === "POST") {
    if (job) { res.writeHead(409, { "content-type": TYPES[".json"] }); return res.end(JSON.stringify({ error: `「${job.genre}」の案件を実行中です。完了までお待ちください。` })); }
    let body;
    try { body = await readJson(req); } catch { res.writeHead(400); return res.end("bad json"); }
    const genre = String(body.genre || "").trim().slice(0, 100);
    if (!genre) { res.writeHead(400, { "content-type": TYPES[".json"] }); return res.end(JSON.stringify({ error: "ジャンルを入力してください。" })); }
    runJob({ genre, target: String(body.target || "").trim().slice(0, 200), extra: String(body.extra || "").trim().slice(0, 500) });
    res.writeHead(202, { "content-type": TYPES[".json"] });
    return res.end(JSON.stringify({ accepted: true }));
  }
  if (p === "/api/cancel" && req.method === "POST") {
    job?.abort.abort();
    res.writeHead(200); return res.end("ok");
  }

  // static: office at /, reports under /research/
  const file = p === "/" ? path.join(ROOT, "office", "index.html") : path.join(ROOT, p);
  if (!file.startsWith(ROOT + path.sep) || !/^\/(office|research)\//.test(p === "/" ? "/office/" : p) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end("not found");
  }
  if (file.endsWith(".html")) return sendPage(res, file);
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`NEON-RESEARCH office: http://localhost:${PORT}  (model: ${MODEL}, budget: $${MAX_BUDGET_USD}/case)`);
});
