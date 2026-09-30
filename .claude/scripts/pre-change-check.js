#!/usr/bin/env node
/**
 * pre-change-check —— 修改前检查（AGENTS.md「修改前检查」第 1~3 条的自动化）
 *
 * 用法：
 *   node .claude/scripts/pre-change-check.js <仓库路径> [--json]
 *   仓库路径缺省时用当前目录。
 *
 * 输出四种结论，对应四种动作：
 *   PROCEED      工作区干净、有上游且同步 → 可以直接动手改
 *   PULL_FIRST   工作区干净但落后上游 → 先 git pull 再改（符合「先拉取再修改」）
 *   NEED_CONFIRM 有未提交改动 / 本地领先 / 无上游 → 停下来向用户说明，等决定
 *   BLOCK        不是 git 仓库 / 状态读取失败 → 禁止动手
 *
 * 纯只读：不做 pull、不改任何文件。NEED_CONFIRM 时也不代做 stash/重置——
 * 那是 AGENTS.md Git 规则里明确要先问用户的动作。
 */

const path = require("path");
const { isRepo, repoStatus, detectStack, matchKnowledge } = require("./lib");

function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  const repo = path.resolve(argv.find((a) => !a.startsWith("--")) || process.cwd());

  const result = {
    repo, conclusion: "BLOCK", branch: null, upstream: null, ahead: 0, behind: 0,
    dirtyFiles: [], stack: null, knowledgeHints: [], reason: "",
  };

  if (!isRepo(repo)) {
    result.reason = "目录下没有 .git，不是独立仓库（本工作区各子项目各自独立 Git，需 cd 进具体仓库）";
    return done(result, json);
  }
  const st = repoStatus(repo);
  if (!st) {
    result.reason = "git status 执行失败（权限不足或仓库损坏）";
    return done(result, json);
  }
  Object.assign(result, {
    branch: st.branch, upstream: st.upstream, ahead: st.ahead, behind: st.behind,
    dirtyFiles: st.files.map((f) => `${f.xy} ${f.path}`),
  });
  result.stack = detectStack(repo);
  // 知识触发：仓库路径 + 本次将触碰的脏文件路径，一起过触发词
  result.knowledgeHints = matchKnowledge(repo + "\n" + st.files.map((f) => f.path).join("\n"));

  if (st.files.length > 0) {
    result.conclusion = "NEED_CONFIRM";
    result.reason = `工作区有 ${st.files.length} 个未提交改动，直接 pull 可能冲突或覆盖；先向用户说明，不擅自 stash/重置`;
  } else if (st.ahead > 0) {
    result.conclusion = "NEED_CONFIRM";
    result.reason = `本地领先上游 ${st.ahead} 个提交，pull 可能产生合并；先向用户说明`;
  } else if (!st.upstream) {
    result.conclusion = "NEED_CONFIRM";
    result.reason = "当前分支没有上游，无法安全拉取；先确认分支是否正确";
  } else if (st.behind > 0) {
    result.conclusion = "PULL_FIRST";
    result.reason = `落后上游 ${st.behind} 个提交且工作区干净 → 先 git pull 再修改`;
  } else {
    result.conclusion = "PROCEED";
    result.reason = "工作区干净且与上游同步 → 可以动手";
  }
  done(result, json);
}

function done(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const lines = [
    `仓库: ${result.repo}`,
    `结论: ${result.conclusion} —— ${result.reason}`,
    result.branch
      ? `分支: ${result.branch}${result.upstream ? `（上游 ${result.upstream}，ahead ${result.ahead} / behind ${result.behind}）` : "（无上游）"}`
      : null,
    result.dirtyFiles.length
      ? `未提交改动 ${result.dirtyFiles.length} 个:\n  ${result.dirtyFiles.join("\n  ")}`
      : null,
    result.stack && result.stack.stack !== "unknown"
      ? `技术栈: ${result.stack.stack}（验证命令 ${result.stack.build}）`
      : null,
    result.knowledgeHints.length
      ? `命中专项知识（动手前先读）:\n${result.knowledgeHints.map((k) => `  .claude/knowledge/${k.file} —— ${k.why}`).join("\n")}`
      : null,
  ].filter(Boolean);
  console.log(lines.join("\n"));
}

main();
