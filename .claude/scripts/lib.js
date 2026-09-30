/**
 * 自动化脚本共用工具库（.claude\scripts\lib.js）
 *
 * 被 pre-change-check / verify-change / repo-map / final-review 复用：
 * 检查逻辑只写这一份，Claude Code 与 Codex 都调用这些脚本，
 * 避免两套实现各自漂移（AGENTS.md「自动化脚本」一节的约定）。
 *
 * 约定：纯 node 内置模块、无第三方依赖；除 verify-change 的构建外全是只读操作；
 *       git 子命令失败返回 null 由调用方兜底——检查脚本不因单条命令失败而崩。
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

/** 工作区根目录（.claude\scripts 的上两级） */
const ROOT = path.resolve(__dirname, "..", "..");

/**
 * 域码 → 前端微应用 / 后端服务。
 * 只写 CLAUDE.md 里确认过的确定性映射；查不到的域码由 repo-map.js 走实搜兜底，
 * 不在这里臆测（D03/D06 等对应关系以《目录详解》与实际代码为准）。
 */
const DOMAIN_MAP = {
  D01: { fe: "mf-stdweb-sale", be: "inks-service-sale-master" },
  D05: { fe: "mf-stdweb-manu", be: "inks-service-manu-master" },
  D11: { fe: "mf-stdweb-pms", be: "inks-service-pms-master" },
  D96: { fe: "mf-stdweb-utils", be: "inks-service-utils-master" },
  SYS: { fe: "mf-stdweb-sys", be: "inks-service-system-master" },
};

/** 专项知识触发：路径/改动文件命中即提醒先读（与 CLAUDE.md §0 知识表保持同一口径） */
const KNOWLEDGE_HINTS = [
  { re: /ve-?table|SetColums/i, file: "ve-table-and-list.md", why: "单元格可编辑表格/列设置" },
  { re: /attachment|Uts_Attachment|uploadfile|preview/i, file: "file-upload-preview.md", why: "附件上传/预览" },
  { re: /printwebbill|grid\+\+|\.grf|锐浪|打印/i, file: "cloud-print.md", why: "云打印/锐浪报文" },
  { re: /formedit|getparam/i, file: "vue2-form-save.md", why: "formEdit 子表保存" },
  { re: /corner|badge|角标/i, file: "card-corner-badge.md", why: "卡片状态角标" },
  { re: /numpad|数字键盘/i, file: "pad-numpad-keyboard.md", why: "pad 端数量输入" },
  { re: /mapper\.xml|only_full_group_by|asynctask|轮询|polling/i, file: "backend-async-polling.md", why: "后端异步任务/新增接口" },
];

function isRepo(dir) {
  return fs.existsSync(path.join(dir, ".git"));
}

/** 执行 git 子命令；失败返回 null，由调用方兜底 */
function git(dir, args) {
  try {
    return execFileSync("git", args, { cwd: dir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
  } catch {
    return null;
  }
}

/**
 * 工作区状态。解析 git status --porcelain=v1 --branch：
 *   首行 `## master...origin/master [ahead 1, behind 2]` + 逐文件 `XY path`
 * 为什么不用 v2：v1 的分支行与文件行格式更短更好解析，rename 的 `old -> new` 一次切割即可。
 */
function repoStatus(dir) {
  const out = git(dir, ["status", "--porcelain=v1", "--branch"]);
  if (out === null) return null;
  const lines = out.split("\n");
  const head = lines[0] || "";
  const bm = head.match(/^## ([^.\s]+)(?:\.{3}(\S+))?(?:\s+\[(.+)\])?/);
  const branch = bm ? bm[1] : head.replace(/^##\s*/, "");
  const upstream = bm && bm[2] ? bm[2] : null;
  let ahead = 0, behind = 0;
  if (bm && bm[3]) {
    const a = bm[3].match(/ahead (\d+)/); if (a) ahead = +a[1];
    const b = bm[3].match(/behind (\d+)/); if (b) behind = +b[1];
  }
  const files = lines.slice(1).filter(Boolean).map((l) => {
    const xy = l.slice(0, 2);
    let p = l.slice(3);
    const arrow = p.indexOf(" -> ");
    if (arrow >= 0) p = p.slice(arrow + 4); // rename 取新路径
    return { xy, path: p };
  });
  return { branch, upstream, ahead, behind, files, clean: files.length === 0 };
}

/**
 * 技术栈识别：锁文件优先（CLAUDE.md §4.2 的强规则），pom.xml 次之。
 * 返回 unknown 时调用方应停下来问，而不是猜构建命令。
 */
function detectStack(dir) {
  if (fs.existsSync(path.join(dir, "package-lock.json")))
    return { stack: "vue2", pm: "npm", build: "npm run build:prod" };
  if (fs.existsSync(path.join(dir, "pnpm-lock.yaml")))
    return { stack: "vue3", pm: "pnpm", build: "pnpm build:prod" };
  if (fs.existsSync(path.join(dir, "pom.xml")))
    return { stack: "java", pm: "maven", build: "mvn clean package -DskipTests" };
  return { stack: "unknown", pm: null, build: null };
}

/** 按任意文本（路径、改动文件列表）匹配专项知识触发词，返回去重后的 [{file, why}] */
function matchKnowledge(text) {
  const hits = [];
  for (const h of KNOWLEDGE_HINTS) {
    if (h.re.test(text) && !hits.some((x) => x.file === h.file)) hits.push({ file: h.file, why: h.why });
  }
  return hits;
}

module.exports = { ROOT, DOMAIN_MAP, KNOWLEDGE_HINTS, isRepo, git, repoStatus, detectStack, matchKnowledge };
