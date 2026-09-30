#!/usr/bin/env node
/**
 * verify-change —— 修改后验证（AGENTS.md「测试与验证要求」的自动化）
 *
 * 用法：
 *   node .claude/scripts/verify-change.js <仓库路径> [--skip-build]
 *
 * 做三件事：
 *   1. 按锁文件/pom 选验证命令（vue2→npm run build:prod，vue3→pnpm build:prod，java→mvn clean package -DskipTests），
 *      包管理器不会混用——判定依据是仓库里实际存在的锁文件；
 *   2. 跑构建，记录退出码与耗时；完整输出写系统临时文件，终端只留尾部诊断；
 *   3. 列出最终变更范围（含未跟踪），供交付前 git diff 自检。
 *
 * 构建命令属于白名单允许的 L2 操作；本脚本不提交、不推送。
 * 老版 webpack 在 Node 17+ 报 digital envelope 时，按 CLAUDE.md §4.2 只提示补
 * NODE_OPTIONS=--openssl-legacy-provider——不自动加，加不加由 Agent/用户决定。
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { isRepo, repoStatus, detectStack } = require("./lib");

function main() {
  const argv = process.argv.slice(2);
  const skipBuild = argv.includes("--skip-build");
  const repo = path.resolve(argv.find((a) => !a.startsWith("--")) || process.cwd());

  if (!isRepo(repo)) return fail(`不是 git 仓库: ${repo}`);
  const st = repoStatus(repo);
  if (!st) return fail("git status 执行失败");
  const stack = detectStack(repo);

  console.log(`仓库: ${repo}`);
  console.log(`分支: ${st.branch}（脏文件 ${st.files.length}）`);
  console.log(`技术栈: ${stack.stack}`);

  // 1. 变更范围
  if (st.files.length) {
    console.log(`变更范围:\n  ${st.files.map((f) => `${f.xy} ${f.path}`).join("\n  ")}`);
  } else {
    console.log("变更范围: 工作区干净（没有可验证的改动）");
  }

  // 2. 构建
  if (skipBuild) {
    console.log("构建: --skip-build 跳过");
    return;
  }
  if (!stack.build) {
    console.log("构建: 无法识别技术栈（缺锁文件和 pom.xml），未执行——停下来确认项目类型，不要猜命令");
    return;
  }

  const cmd = stack.pm;                 // npm / pnpm / mvn 都在 PATH
  const args = stack.pm === "maven" ? ["clean", "package", "-DskipTests"]
    : stack.pm === "npm" ? ["run", "build:prod"]
    : ["build:prod"];

  console.log(`构建: ${cmd} ${args.join(" ")}（输出较多，完整日志写临时文件）`);
  const t0 = Date.now();
  const r = spawnSync(cmd, args, {
    cwd: repo, encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    shell: process.platform === "win32", // Windows 下 npm/pnpm 是 .cmd，需要 shell
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  const logFile = path.join(os.tmpdir(), `verify-change-${path.basename(repo)}.log`);
  try { fs.writeFileSync(logFile, out); } catch { /* 临时目录不可写不影响结论 */ }

  if (r.status === 0) {
    console.log(`构建结果: 通过（exit 0，耗时 ${secs}s）`);
    console.log(`完整日志: ${logFile}`);
  } else {
    const tail = out.trim().split("\n").slice(-40).join("\n");
    console.log(`构建结果: 失败（exit ${r.status === null ? "signal" : r.status}，耗时 ${secs}s）`);
    console.log(`完整日志: ${logFile}`);
    console.log(`--- 尾部输出 ---\n${tail}`);
    if (/digital envelope routines::unsupported/i.test(out)) {
      console.log("提示: Node 17+ 的 OpenSSL 3 问题，按 CLAUDE.md §4.2 加 NODE_OPTIONS=--openssl-legacy-provider 重跑");
    }
    console.log("注意: 构建失败先区分本次修改引入 vs 原有环境问题，如实报告；不删测试、不关校验来通过构建");
  }
}

function fail(msg) {
  console.error(msg);
  process.exitCode = 1;
}

main();
