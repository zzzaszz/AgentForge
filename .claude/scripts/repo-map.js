#!/usr/bin/env node
/**
 * repo-map —— 仓库依赖识别（CLAUDE.md 静态目录地图的动态版）
 *
 * 用法：
 *   node .claude/scripts/repo-map.js <关键词>   例：D11M16B1 / 负荷率 / SYSM06B1
 *
 * 两步定位，静态映射与实际代码互为印证（AGENTS.md：以实际配置和代码为据）：
 *   1. 关键词里提取域码（D01/D05/D11/D96/SYS）→ 查 lib.js 确定性映射，
 *      给出候选前端微应用与后端服务；
 *   2. 用 ripgrep 在候选目录（无域码则全 0-Web_Code / 0-SvcCode）实搜关键词，
 *      按仓库聚合给出 file:line 证据。
 *
 * rg 不可用时退化为 git grep（仅候选仓库场景）；全库搜索必须 rg，否则提示安装。
 */

const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { ROOT, DOMAIN_MAP, git } = require("./lib");

function hasRg() {
  return !spawnSync("rg", ["--version"], { encoding: "utf8" }).error;
}

/** rg 搜内容：-n 带行号、-m 2 每文件最多 2 条（定位足够）；exit 1 = 无命中，不是错误 */
function rgSearch(pattern, dirs) {
  try {
    const out = execFileSync("rg", ["-n", "-i", "-m", "2", pattern, ...dirs], {
      encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
    });
    return out.trim().split("\n").filter(Boolean);
  } catch (e) {
    if (e.status === 1) return [];
    throw e;
  }
}

/** 拆 rg 输出行 `路径:行号:内容`；路径用非贪婪避免盘符冒号误切 */
function parseHit(line) {
  const m = line.match(/^(.+?):(\d+):(.*)$/);
  return m ? { file: m[1], line: +m[2], text: m[3].trim() } : null;
}

function main() {
  const kw = process.argv[2];
  if (!kw) {
    console.error("用法: node repo-map.js <关键词>   例：D11M16B1 / 负荷率 / SYSM06B1");
    process.exitCode = 1;
    return;
  }

  // 1. 域码 → 静态候选
  const dm = kw.toUpperCase().match(/(D\d{2}|SYS)/);
  const cands = [];
  if (dm && DOMAIN_MAP[dm[1]]) {
    const m = DOMAIN_MAP[dm[1]];
    const fe = path.join(ROOT, "0-Web_Code", "mf-vue2", "mfomsweb", m.fe);
    const be = path.join(ROOT, "0-SvcCode", "OMS", m.be);
    if (fs.existsSync(fe)) cands.push({ role: "前端微应用", dir: fe });
    if (fs.existsSync(be)) cands.push({ role: "后端服务", dir: be });
  }

  console.log(`关键词: ${kw}`);
  if (cands.length) {
    console.log("静态映射候选（域码 " + dm[1] + "）:");
    cands.forEach((c) => console.log(`  [${c.role}] ${c.dir}`));
  } else {
    console.log("静态映射候选: 无（域码不在确定性映射表，以下靠实搜兜底）");
  }

  // 2. 实搜证据
  if (!hasRg()) {
    console.log("ripgrep 不可用");
    if (cands.length) {
      console.log("退化为 git grep（仅候选仓库）:");
      for (const c of cands) {
        const hits = git(c.dir, ["grep", "-n", "-i", "-I", kw]);
        if (hits) {
          console.log(`  ${path.basename(c.dir)}:`);
          hits.split("\n").slice(0, 20).forEach((l) => console.log(`    ${l.slice(0, 140)}`));
        }
      }
    } else {
      console.log("无候选目录且无 rg，全库搜索请先安装 ripgrep");
    }
    return;
  }

  const searchDirs = cands.length
    ? cands.map((c) => c.dir)
    : [path.join(ROOT, "0-Web_Code"), path.join(ROOT, "0-SvcCode")];
  console.log(`实搜范围: ${searchDirs.length} 个目录（尊重根 .ignore，node_modules/target/dist 已排除）`);
  let hits;
  try {
    hits = rgSearch(kw, searchDirs);
  } catch {
    hits = [];
  }

  if (!hits.length) {
    console.log("实搜: 无命中（若关键词是接口路径，注意前端可能拼接 URL，换片段再搜）");
    return;
  }
  const byRepo = {};
  for (const h of hits) {
    const p = parseHit(h);
    if (!p) continue;
    const rel = path.relative(ROOT, p.file);
    const repoKey = rel.split(path.sep).slice(0, 3).join(path.sep);
    (byRepo[repoKey] = byRepo[repoKey] || []).push(p);
  }
  console.log("实搜命中（按仓库聚合）:");
  for (const [repoKey, items] of Object.entries(byRepo)) {
    console.log(`  ${repoKey}`);
    items.slice(0, 10).forEach((p) =>
      console.log(`    ${path.relative(ROOT, p.file)}:${p.line}  →  ${p.text.slice(0, 100)}`));
    if (items.length > 10) console.log(`    ...（共 ${items.length} 条）`);
  }
}

main();
