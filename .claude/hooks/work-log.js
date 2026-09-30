#!/usr/bin/env node
/**
 * 工作日志自动记录 hook
 * 位置：D:\0-caoshi\.claude\hooks\work-log.js
 * 注册：项目级 .claude/settings.json，同时挂在 UserPromptSubmit 与 Stop 两个事件上
 *
 * 为什么是两段式：
 *   Stop 事件是「每轮响应结束」触发（不是会话结束）。所以不从 transcript 取用户消息，
 *   改由 UserPromptSubmit 先暂存、Stop 再消费：
 *
 *     UserPromptSubmit → 暂存本次请求 + 当前 transcript 行号到 .state/<session_id>.json
 *     Stop             → 读暂存 → 追加一行到 工作日志.md → 删除暂存
 *
 *   取后即删，因此同一个请求只会落一行，天然去重；也不依赖 prompt_id 字段。
 *
 * 结果列（「结果」）不取回复首行：回复常以 `## 结论` 这类 markdown 标题开头，
 * 直接取首行只会记成标题本身。见 resultOf()——剥离行首标记与行内符号、
 * 跳过剥离后 ≤8 字的短标题，改取标题下的正文。
 * 列宽：任务 72 字、结果 60 字；超长由 clip() 就近在标点处断开（见该函数）。
 *   结果列从 120 收到 60，是因为加到七列后整表远超一屏，而「任务+结果」占行宽约 76%
 *   （实测 249/329 列），三个数值列加起来才 8%——缩数值列对总宽无济于事，只能压这里。
 *
 * 用量三列（耗时 / tokens / 费用）在 Stop 时回读 transcript 统计，三个坑：
 *   1. 同一 message.id 会因流式分块在 JSONL 里出现多行，且每行都带同一份 usage，
 *      按行累加会把用量放大数倍（实测 160 行 / 64 个真实消息），必须按 message.id 去重。
 *   2. 子代理（Task）的条目不在主 transcript 里（主文件 isSidechain 恒为 false），
 *      另存于 <session>/subagents/*.jsonl，需单独读、按时间归属当前轮。
 *   3. transcript 由 harness 异步落盘、可能滞后于内存会话，故末条存在轻微少计。
 *   单价表在 pricing.json；单价留 null 时「费用」列记 "-"，不影响其它两列。
 *
 * 约定：任何异常都静默 exit 0，绝不干扰主流程。
 */

const fs = require("fs");
const path = require("path");

const HOOK_DIR = __dirname;
const STATE_DIR = path.join(HOOK_DIR, ".state");
const PROJECT_ROOT = path.resolve(HOOK_DIR, "..", "..");
const LOG_FILE = path.join(PROJECT_ROOT, "工作日志.md");
const PRICING_FILE = path.join(HOOK_DIR, "pricing.json");

const COLS = ["时间", "任务", "涉及", "结果", "耗时", "tokens", "费用"];
const NCOL = COLS.length;
const TABLE_HEADER = `| ${COLS.join(" | ")} |\n|${"---|".repeat(NCOL)}\n`;
const MAX_AGE_MS = 6 * 3600 * 1000;

/* ---------- 工具 ---------- */

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch (e) {
    return "";
  }
}

const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** 千分位；表里出现过的数字都能原样解析回来，保证「合计」可重算 */
const nf = (n) => Math.round(n).toLocaleString("en-US");

/** 毫秒 → 42秒 / 3分12秒 / 1时05分 */
function fmtDur(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}分${pad(s % 60)}秒`;
  return `${Math.floor(m / 60)}时${pad(m % 60)}分`;
}

/** fmtDur 的逆运算，用于从已有行重算当天合计 */
function parseDur(t) {
  const s = untag(t);
  let ms = 0;
  let m;
  if ((m = s.match(/(\d+)时/))) ms += Number(m[1]) * 3600000;
  if ((m = s.match(/(\d+)分/))) ms += Number(m[1]) * 60000;
  if ((m = s.match(/(\d+)秒/))) ms += Number(m[1]) * 1000;
  return ms;
}

/** "48,230" → 48230；"-" → null */
function parseNum(t) {
  const s = untag(t).trim();
  if (!s || s === "-") return null;
  const v = parseFloat(s.replace(/,/g, ""));
  return isFinite(v) ? v : null;
}

function fmtCost(cost, cur) {
  if (cost == null) return "-";
  return cur + (cost > 0 && cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2));
}

/** "¥1.2345" → 1.2345；"-" → null */
function parseCost(t) {
  const s = untag(t).trim();
  if (!s || s === "-") return null;
  const v = parseFloat(s.replace(/[^\d.]/g, ""));
  return isFinite(v) ? v : null;
}

/**
 * 压平空白；超长时不在字中间硬切，而是就近找标点断开，读起来像一句概括：
 *   句末标点（。！？；.!?;）→ 直接截到句末，不加省略号（已是完整句）
 *   逗号/顿号/冒号        → 截到该处并加省略号
 *   两者都太靠前（不足上限一半）或找不到 → 退回硬截 + 省略号
 */
function clip(s, n) {
  const t = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;

  const head = t.slice(0, n);
  const half = Math.floor(n / 2);
  const lastOf = (chars) => Math.max(...chars.map((c) => head.lastIndexOf(c)));

  // 不认英文句点：「CLAUDE.md」「15,950」「work-log.js」里的 . 会把标识符切开
  const sent = lastOf(["。", "！", "？", "；", "!", "?", ";"]);
  if (sent >= half) return head.slice(0, sent + 1);

  const comma = lastOf(["，", "、", "：", ",", ":"]);
  if (comma >= half) return head.slice(0, comma + 1) + "…";

  return head + "…";
}

/** 作为 markdown 表格单元格：转义竖线 */
function cell(s, n) {
  return clip(s, n).replace(/\|/g, "\\|");
}

/** 数值列/档位标记用小字：七列并排本就挤，这几个再占满字号会把行撑爆 */
const sub = (s) => `<sub>${s}</sub>`;

/**
 * 剥掉内联 HTML 标签后解析数值。
 * 只用于读，不用改写回文件的内容——appendRow 会把 parseRows 的结果原样写回，
 * 若在那里剥标签，之后每次追加都会把已有行的 <sub> 抹掉。
 */
const untag = (s) => String(s == null ? "" : s).replace(/<[^>]*>/g, "");

/** 取对象里第一个非空字符串字段 */
function pick(obj, keys) {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v;
    if (v && typeof v === "object" && typeof v.text === "string" && v.text.trim()) return v.text;
  }
  return "";
}

function userMessageOf(d) {
  return pick(d, ["prompt", "user_prompt", "userPrompt", "message", "text", "content"]);
}

/**
 * 从回复文本里挑一行有实义的内容，作为「结果」列。
 * 不能直接取首行——回复常以 `## 结论` 这类 markdown 标题开头，
 * 记进去只有标题没有结论。规则：
 *   1. 跳过空行、`---` 分隔线；
 *   2. 剥离行首 markdown 标记（# / > / - / 1. ）与行内 ** ` 符号；
 *   3. 剥离后仍是短标题（≤8 字，如「结论」「小结」）的，跳过看下一行；
 *   4. 全篇只有短标题时，退回第一个标题文本。
 */
function resultOf(text) {
  if (!text) return "-";
  let fallback = "";

  for (const raw of String(text).split("\n")) {
    let t = raw.trim();
    if (!t) continue;
    if (/^[-=_*]{3,}$/.test(t)) continue; // 分隔线

    const isHeading = /^#{1,6}\s+/.test(t);
    t = t
      .replace(/^#{1,6}\s+/, "")
      .replace(/^[>*+-]\s+/, "")
      .replace(/^\d+[.)]\s+/, "")
      .replace(/\*\*/g, "")
      .replace(/`/g, "")
      .trim();
    if (!t) continue;

    if (isHeading && t.length <= 8) {
      if (!fallback) fallback = t;
      continue;
    }
    return t;
  }
  return fallback || "-";
}

/** 工作目录相对项目根；即在根目录时返回 "-" */
function scopeOf(cwd) {
  if (!cwd) return "-";
  try {
    const rel = path.relative(PROJECT_ROOT, cwd);
    if (!rel || rel === "." || rel.startsWith("..")) return "-";
    return rel.replace(/\\/g, "/");
  } catch (e) {
    return "-";
  }
}

function statePath(sessionId) {
  const safe = String(sessionId || "unknown").replace(/[^A-Za-z0-9_-]/g, "_");
  return path.join(STATE_DIR, `${safe}.json`);
}

/* ---------- 用量统计（回读 transcript） ---------- */

function loadPricing() {
  try {
    const p = JSON.parse(fs.readFileSync(PRICING_FILE, "utf8"));
    return p && typeof p === "object" ? p : {};
  } catch (e) {
    return {};
  }
}

const DEFAULT_PEAK_HOURS = { utcOffsetHours: 8, weekdays: [1, 2, 3, 4, 5], ranges: [[9, 12], [14, 18]] };

/** 模型名可能是旧名/别名，逐个比对 aliases */
function findModel(model, pricing) {
  const models = pricing.models || {};
  if (models[model]) return models[model];
  for (const k of Object.keys(models)) {
    const a = models[k] && models[k].aliases;
    if (Array.isArray(a) && a.indexOf(model) >= 0) return models[k];
  }
  return null;
}

/**
 * 是否处于高峰时段：北京时间周一至周五 9:00-12:00、14:00-18:00。
 * transcript 的时间戳是 UTC，先整体偏移再读 UTC 字段，得到的就是北京时间。
 * 区间左闭右开，12:00 整算空闲。
 */
function isPeak(date, cfg) {
  const off = typeof cfg.utcOffsetHours === "number" ? cfg.utcOffsetHours : DEFAULT_PEAK_HOURS.utcOffsetHours;
  const days = Array.isArray(cfg.weekdays) ? cfg.weekdays : DEFAULT_PEAK_HOURS.weekdays;
  const ranges = Array.isArray(cfg.ranges) ? cfg.ranges : DEFAULT_PEAK_HOURS.ranges;

  const d = new Date(date.getTime() + off * 3600 * 1000);
  if (days.indexOf(d.getUTCDay()) < 0) return false;
  const h = d.getUTCHours() + d.getUTCMinutes() / 60;
  return ranges.some((r) => Array.isArray(r) && h >= r[0] && h < r[1]);
}

/** 单价可写数字（视为高峰价，空闲自动折半）或 {peak, off} */
function priceOf(spec, peak) {
  if (typeof spec === "number") return peak ? spec : spec / 2;
  if (!spec || typeof spec !== "object") return null;
  if (peak) return typeof spec.peak === "number" ? spec.peak : null;
  if (typeof spec.off === "number") return spec.off;
  return typeof spec.peak === "number" ? spec.peak / 2 : null;
}

/**
 * 按模型算这一条 message 的花费；单价缺失返回 null。
 * 注意 cache_creation 是「写入缓存」，按未命中价计；cache_read 才是命中价。
 */
function costOf(model, u, pricing, when) {
  const m = findModel(model, pricing);
  if (!m) return null;

  const peak = isPeak(when, pricing.peakHours || {});
  const pHit = priceOf(m.inputHit, peak);
  const pMiss = priceOf(m.inputMiss, peak);
  const pOut = priceOf(m.output, peak);
  if (pHit == null || pMiss == null || pOut == null) return null;

  return (u.cr * pHit + (u.in + u.cw) * pMiss + u.out * pOut) / 1e6;
}

/**
 * 本轮走的档位标记，跟在「时间」列后面。
 * 一轮可能横跨高峰与空闲（如 11:50 跑到 12:10），此时两档都标，
 * 因为计价本来就是逐条按档算的，只标一个会与「费用」列对不上。
 */
function bandOf(peak, off) {
  if (peak && off) return "峰谷";
  if (peak) return "峰";
  if (off) return "谷";
  return "";
}

function readLines(file) {
  try {
    return fs.readFileSync(file, "utf8").split("\n");
  } catch (e) {
    return null;
  }
}

/**
 * 扫一个 transcript 文件，把 keep(line, i) 命中的 assistant 条目用量累进 agg。
 * 按 message.id 去重（见文件头说明 1）；无 id 的条目退回用行 uuid 当键。
 */
function scanFile(lines, keep, seen, agg, pricing, fallback) {
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (ln.indexOf('"assistant"') < 0 || ln.indexOf('"usage"') < 0) continue;
    if (!keep(i, ln)) continue;

    let e;
    try {
      e = JSON.parse(ln);
    } catch (err) {
      continue;
    }
    if (!e || e.type !== "assistant") continue;

    const msg = e.message || {};
    const u = msg.usage;
    if (!u) continue;

    const key = msg.id || e.uuid;
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    agg.count++;

    const one = {
      in: u.input_tokens || 0,
      cw: u.cache_creation_input_tokens || 0,
      cr: u.cache_read_input_tokens || 0,
      out: u.output_tokens || 0,
    };
    agg.in += one.in;
    agg.cw += one.cw;
    agg.cr += one.cr;
    agg.out += one.out;

    // 逐条按该条自己的时间判高峰/空闲：跨时段的长轮次不会被整轮一刀切
    const t = Date.parse(e.timestamp);
    const when = isFinite(t) ? new Date(t) : fallback;
    if (isPeak(when, pricing.peakHours || {})) agg.peak++;
    else agg.off++;

    const c = costOf(msg.model, one, pricing, when);
    if (c == null) agg.unpriced++;
    else agg.cost += c;
  }
}

/**
 * 汇总本轮用量。
 * 主 transcript 按 UserPromptSubmit 记下的行号切分（精确）；行号越界说明 transcript
 * 被重写/压缩过，退回按时间过滤。子代理文件独立、无行号基准，一律按时间归属。
 * 返回 null 表示一个文件都没读到（此时三列里 tokens/费用 记 "-"）。
 */
function sumTurn(st, pricing) {
  const tp = st.tp || "";
  const sinceIso = new Date(st.ts).toISOString();
  const fallback = new Date(st.ts); // 条目没有 timestamp 时，退回用本轮提交时刻判档
  const seen = new Set();
  const agg = { in: 0, cw: 0, cr: 0, out: 0, cost: 0, unpriced: 0, count: 0, peak: 0, off: 0 };
  let readAny = false;

  const byTime = (i, ln) => {
    const m = ln.match(/"timestamp":"([^"]+)"/);
    return !!m && m[1] >= sinceIso;
  };

  if (tp) {
    const lines = readLines(tp);
    if (lines) {
      readAny = true;
      const off = Number(st.off) || 0;
      const useOffset = off > 0 && off <= lines.length;
      scanFile(lines, useOffset ? (i) => i >= off : byTime, seen, agg, pricing, fallback);
    }
  }

  // 子代理：<session>/subagents/*.jsonl
  if (tp) {
    const dir = path.join(tp.replace(/\.jsonl$/i, ""), "subagents");
    let files = [];
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    } catch (e) {
      files = [];
    }
    for (const f of files) {
      const lines = readLines(path.join(dir, f));
      if (!lines) continue;
      readAny = true;
      scanFile(lines, byTime, seen, agg, pricing, fallback);
    }
  }

  // 一条都没命中说明本轮归属失败：宁可记 "-"，也不要记成 0（看着像真的没花钱）
  if (!readAny || agg.count === 0) return null;
  return {
    total: agg.in + agg.cw + agg.cr + agg.out,
    cost: agg.unpriced > 0 ? null : agg.cost,
    peak: agg.peak,
    off: agg.off,
  };
}

/* ---------- 读写日志 ---------- */

/** 按未转义的竖线切单元格（cell() 会把内容里的 | 转成 \|） */
function splitCells(line) {
  const t = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return t.split(/(?<!\\)\|/).map((c) => c.trim());
}

/** 补齐/截断到 NCOL 列；老格式（4 列）的历史行补 "-" */
function normalizeCells(cells) {
  const c = cells.slice(0, NCOL);
  while (c.length < NCOL) c.push("-");
  return c;
}

const fmtRow = (cells) => `| ${cells.join(" | ")} |`;

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

/** 取当天小节里已有的数据行（跳过表头与分隔行） */
function parseRows(section) {
  const out = [];
  for (const raw of section.split("\n")) {
    const t = raw.trim();
    if (!t.startsWith("|")) continue;
    const cells = splitCells(t);
    if (!cells.length || cells[0] === COLS[0] || isSeparatorRow(cells)) continue;
    out.push(normalizeCells(cells));
  }
  return out;
}

/** 每天表格末尾的小字合计，由表内各行重算，改行/删行后不会失真 */
function totalLine(rows, currency) {
  let ms = 0;
  let tok = 0;
  let cost = 0;
  let nTok = 0;
  let nCost = 0;

  for (const r of rows) {
    ms += parseDur(r[4]);
    const t = parseNum(r[5]);
    if (t != null) {
      tok += t;
      nTok++;
    }
    const c = parseCost(r[6]);
    if (c != null) {
      cost += c;
      nCost++;
    }
  }

  const parts = [`合计 ${rows.length} 条`, `耗时 ${fmtDur(ms)}`];
  if (nTok) parts.push(`tokens ${nf(tok)}`);
  if (nCost) {
    // 有行记 "-"（单价没填、或早于本次改造）时点明未计入的行数，免得总额看着像全量
    const missing = rows.length - nCost;
    parts.push(`费用 ${fmtCost(cost, currency)}${missing ? `（${missing} 行未计入）` : ""}`);
  }
  return `<sub>${parts.join(" · ")}</sub>`;
}

function appendRow(dateStr, cells, currency) {
  let content = "";
  try {
    content = fs.readFileSync(LOG_FILE, "utf8");
  } catch (e) {
    content = "";
  }
  if (!content.trim()) content = "# 工作日志\n\n";

  const marker = `## ${dateStr}`;
  const trimmed = content.replace(/\s*$/, "");
  const idx = trimmed.lastIndexOf(marker);

  let head;
  let rows;
  if (idx >= 0) {
    // 当天小节已存在（始终位于文件末尾）：原样取回已有行，重写整节
    head = trimmed.slice(0, idx).replace(/\s*$/, "") + "\n\n";
    rows = parseRows(trimmed.slice(idx));
  } else {
    head = trimmed + "\n\n";
    rows = [];
  }
  rows.push(normalizeCells(cells));

  const block =
    `${marker}\n\n${TABLE_HEADER}` +
    rows.map(fmtRow).join("\n") +
    `\n\n${totalLine(rows, currency)}\n`;

  fs.writeFileSync(LOG_FILE, head + block, "utf8");
}

/* ---------- 事件处理 ---------- */

function onUserPromptSubmit(d) {
  const msg = userMessageOf(d);
  if (!msg.trim()) return;

  // 跳过斜杠命令、本地命令回显等 harness 注入的伪用户消息
  const first = msg.trim()[0];
  if (first === "<") return;

  const tp = d.transcript_path || d.transcriptPath || "";
  let off = 0;
  if (tp) {
    // 记下当前 transcript 已有几行，Stop 时只统计这之后追加的条目。
    // 结尾那个空串不算行：split("\n") 会给以换行结尾的文件多带一个 ""，
    // 直接取 length 会把起点记到下一行，导致 Stop 时漏掉本轮第一条消息。
    const lines = readLines(tp);
    if (lines) off = lines.length - (lines[lines.length - 1] === "" ? 1 : 0);
  }

  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(
    statePath(d.session_id),
    JSON.stringify({ prompt: msg, cwd: d.cwd || "", ts: Date.now(), tp, off }),
    "utf8"
  );
}

function onStop(d) {
  const sp = statePath(d.session_id);
  let st = null;
  try {
    st = JSON.parse(fs.readFileSync(sp, "utf8"));
  } catch (e) {
    return; // 无暂存：可能是 /clear 等场景，直接跳过
  }

  // 清理异常残留：超过 6 小时的暂存视为过期
  if (!st || !st.ts || Date.now() - st.ts > MAX_AGE_MS) {
    try { fs.unlinkSync(sp); } catch (e) {}
    return;
  }

  const now = new Date();
  const resultLine = resultOf(pick(d, ["last_assistant_message"]));

  const pricing = loadPricing();
  const currency = typeof pricing.currency === "string" && pricing.currency ? pricing.currency : "¥";

  let usage = null;
  try {
    if (!st.tp) st.tp = d.transcript_path || d.transcriptPath || "";
    usage = sumTurn(st, pricing);
  } catch (e) {
    usage = null;
  }

  const band = usage ? bandOf(usage.peak, usage.off) : "";

  const cells = [
    fmtTime(now) + (band ? " " + sub(band) : ""),
    cell(st.prompt, 72),
    cell(scopeOf(st.cwd || d.cwd), 24),
    cell(resultLine, 60),
    sub(fmtDur(now.getTime() - st.ts)),
    sub(usage ? nf(usage.total) : "-"),
    sub(fmtCost(usage ? usage.cost : null, currency)),
  ];

  try {
    appendRow(fmtDate(now), cells, currency);
  } finally {
    try { fs.unlinkSync(sp); } catch (e) {}
  }
}

/* ---------- 入口 ---------- */

try {
  const raw = readStdin();
  const d = raw ? JSON.parse(raw) : {};
  const event = d.hook_event_name || "";

  if (event === "UserPromptSubmit") {
    onUserPromptSubmit(d);
  } else if (event === "Stop") {
    onStop(d);
  }
} catch (e) {
  // 静默：hook 失败不能影响会话
}

process.exit(0);
