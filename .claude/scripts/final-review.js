#!/usr/bin/env node
/**
 * final-review —— 交付前复核（repo-shipper 提交/推送前必跑）
 *
 * 用法：
 *   node .claude/scripts/final-review.js <仓库路径> [更多仓库...]
 *
 * 每仓库检查四项（对应 AGENTS.md 最终验收的「变更范围」+ 敏感信息项）：
 *   1. 未提交/未跟踪清单（哪些文件将进入交付）
 *   2. diff --stat 概览
 *   3. 新增行敏感信息扫描（password/secret/key/私钥块/URL 内嵌凭证/jdbc 带密码）
 *   4. 新增行调试残留扫描（console.log、debugger、System.out.print）
 *
 * 只读：只生成报告，绝不执行 add/commit/push——那是用户明确要求后
 * repo-shipper 的动作，且推送前还要按 CLAUDE.md §5 先 pull 并说明。
 */

const { isRepo, git } = require("./lib");
const fs = require("fs");
const path = require("path");

const SECRET_RES = [
  { name: "password 类", re: /(password|passwd|pwd)\s*[:=]/i },
  { name: "secret/api key", re: /(secret|api[-_]?key|access[-_]?key|appkey)\s*[:=]/i },
  { name: "私钥块", re: /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/ },
  { name: "URL 内嵌凭证", re: /\w+:\/\/[^/\s:@]+:[^/\s@]+@/ },
  { name: "jdbc 带密码", re: /jdbc:\w+:\/\/[^\s"']*password/i },
];
const DEBUG_RES = [
  { name: "console.log/debug", re: /\bconsole\.(log|debug)\(/ },
  { name: "debugger", re: /^\s*debugger\s*;?\s*$/ },
  { name: "System.out", re: /\bSystem\.out\.print/ },
];

/** 从 unified diff 取全部新增行（带所属文件）；+++ 文件头不算新增 */
function scanAddedLines(diffText) {
  const out = [];
  let file = "";
  for (const line of diffText.split("\n")) {
    if (line.startsWith("+++ b/")) file = line.slice(6);
    else if (line.startsWith("+") && !line.startsWith("+++")) out.push({ file, line: line.slice(1) });
  }
  return out;
}

function review(repo) {
  console.log(`\n===== ${repo} =====`);
  if (!isRepo(repo)) {
    console.log("  非 git 仓库，跳过");
    return;
  }
  const st = git(repo, ["status", "--porcelain=v1"]);
  const files = st ? st.split("\n").filter(Boolean) : [];
  if (!files.length) {
    console.log("  工作区干净，没有待交付改动");
    return;
  }
  console.log(`  待交付 ${files.length} 个文件:`);
  files.forEach((f) => console.log(`    ${f}`));

  const stat = git(repo, ["diff", "HEAD", "--stat"]);
  if (stat) console.log(`  diff 概览:\n${stat.split("\n").map((l) => `    ${l}`).join("\n")}`);

  const diff = git(repo, ["diff", "HEAD"]) || "";
  // 未跟踪文件不在 diff 里，单独读内容拼成伪新增行扫描；限 200KB 避免扫到构建产物
  const untracked = files.filter((f) => f.startsWith("??")).map((f) => f.slice(3).trim());
  let extra = "";
  for (const u of untracked) {
    const p = path.join(repo, u);
    try {
      const s = fs.statSync(p);
      if (s.isFile() && s.size < 200 * 1024) {
        extra += fs.readFileSync(p, "utf8").split("\n").map((l) => `+${l}`).join("\n") + "\n";
      }
    } catch { /* 目录或不可读，跳过 */ }
  }
  const added = scanAddedLines(diff + "\n" + extra);

  const report = (title, rules) => {
    const hits = [];
    for (const a of added) {
      for (const r of rules) {
        if (r.re.test(a.line)) hits.push(`    [${r.name}] ${a.file}: ${a.line.trim().slice(0, 90)}`);
      }
    }
    console.log(hits.length
      ? `  ${title}（${hits.length} 处，需人工确认是否保留）:\n${hits.join("\n")}`
      : `  ${title}: 未发现`);
  };
  report("敏感信息", SECRET_RES);
  report("调试残留", DEBUG_RES);
  console.log("  提醒: 本脚本只出报告；提交/推送需用户明确要求，且只 add 本次任务相关文件");
}

function main() {
  const repos = process.argv.slice(2).map((r) => path.resolve(r));
  if (!repos.length) {
    console.error("用法: node final-review.js <仓库路径> [更多仓库...]");
    process.exitCode = 1;
    return;
  }
  console.log("交付前复核（只读，不执行任何 git 写操作）");
  repos.forEach(review);
}

main();
