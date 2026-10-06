# D:\0-caoshi 工作区 Codex 配置

通用行为继承 `C:\Users\inks07\.codex\AGENTS.md`。本文件承担当前工作区的目录定位、技术栈、专项知识，以及跨工具通用的**行为与安全约束**（执行权限分级、数据库边界、修改前检查、证据管理、测试验证、兼容性保护）；路径以当前机器为准。

注意两套工具的实际加载差异：Codex 直接加载本文件；Claude Code 只自动加载根目录 `CLAUDE.md`，经其指引按需读取本文件。两边工具权限与 hook 各自独立（Codex 以运行环境为准，Claude 以 `.claude\settings.json` 为准），文档写了规则不等于两边会以相同方式执行，涉及 L3 高风险操作时按各自环境的实际授权逐项确认。

## 工作区定位

完整目录地图和模块对应关系见根目录 `CLAUDE.md`，需要定位代码时按需读取，不要为了查找一个文件遍历整个工作区。

常用位置：

| 内容 | 目录 |
|---|---|
| 标准版 Java 后端 | `0-SvcCode\OMS\inks-service-<模块>-master` |
| OEM 后端 | `0-SvcCode\svc-oem\inks-service-oem-<代号>` |
| Vue2 微应用 | `0-Web_Code\mf-vue2\` |
| Vue3 前端 | `0-Web_Code\web3\` |
| 老版单体 Vue2 | `0-Web_Code\web2\` |
| Flutter 桌面/移动端 | `0-Web_Code\flt\desk\` |
| 微前端聚合构建 | `0-Web_Code\mf-mg\` |
| 开发文档 | `文档\2025\`、`文档\2026\` |
| 客户现场 SQL | `DB\` |

## 执行权限分级

所有操作按风险分三档，避免高风险操作擅自执行，也避免只读操作反复询问：

| 级别 | 操作范围 | 规则 |
|---|---|---|
| L1 只读 | 查看代码、查日志、查 Git 历史、读取数据库 | 可自主执行 |
| L2 可逆修改 | 修改业务代码、增加测试、调整本地配置 | 按用户需求执行，遵守最小变更 |
| L3 高风险 | 写数据库、删除文件、修改公共接口、部署生产、提交推送 | 逐项确认，与授权范围一一对应 |

**授权不可传递**：用户授权修改代码，不等于授权修改数据库或部署生产环境；L3 各项分别判断是否已获授权，未明确授权的一律先询问。

**与命令白名单的映射**（Claude 侧落地在 `.claude\settings.json` 的 allow/ask/deny；Codex 侧按自身权限机制对应配置，两边保持同一分级口径）：

- L1 只读 → `allow` 自动执行：文件查看（ls/cat/head/tail/rg/find）、git 只读子命令（status/diff/log/show/branch/remote）、dbhub 只读查询（MCP 服务端只读模式）、`.claude\scripts\` 检查脚本。
- L2 可逆修改 → 按需放行：构建验证命令（`npm run build:prod` / `pnpm build:prod` / `mvn clean package -DskipTests`）、`git pull` / `git add`（可逆、不丢数据，2026-09-30 用户确认放行）；代码修改本身按用户需求执行。
- L3 高风险 → 一律确认（ask）或直接禁止（deny）：ask 覆盖 `git commit` / `git push`、`npm install` / `pnpm install`（改锁文件）、`rm` / `mv` 等删除移动、`docker` 部署、`curl` / `wget` / `ssh` 外部网络与远程连接、`node -e`（任意代码执行，2026-09-30 用户确认收紧）；deny 覆盖 `git reset --hard`、`git clean`、`git checkout --`、`git restore`、`git push --force`、对盘根目录的 `rm -rf`。

## 数据库安全边界

数据库操作**默认只读**。未经用户明确授权：

- 禁止执行 `INSERT` / `UPDATE` / `DELETE` 及一切 `DDL`（`ALTER` / `DROP` / `TRUNCATE` / 建表建索引）。
- 生产库任何写操作必须显式授权；执行前先展示完整 SQL 与影响范围（目标表、预计影响行数、过滤条件依据）。
- 批量写入前先给预览（同条件 `SELECT` 查出的待写数据样例）和回滚方案（反向 SQL 或备份方式），确认后再执行。
- 只读查询也控成本：大表加 `LIMIT`，避免无谓全表扫。

`DB\` 目录的客户现场 SQL 脚本同样遵守：脚本只生成或修改，不擅自代跑。

## 修改前检查

开始修改前必须：

1. 确认目标仓库、当前分支及工作区状态。
2. 检查未提交改动，禁止覆盖用户已有修改。
3. 按项目约定拉取最新代码；工作区不干净、存在冲突或拉取可能影响用户改动时，先停止并说明。
4. 查明实际调用链、数据来源和相关接口，不得凭文件名推断。
5. 命中专项知识时，先阅读对应知识文件。
6. 明确本次修改文件、预期行为和验收方式。
7. 修改范围超过 3 个文件或涉及公共接口时，先向用户展示修改清单和依赖关系。

第 1~3 条可交给脚本自动完成：`node .claude/scripts/pre-change-check.js <仓库路径>`，输出 PROCEED（可动手）/ PULL_FIRST（先拉取）/ NEED_CONFIRM（脏工作区等，先向用户说明）/ BLOCK（非仓库）。

## 证据与假设管理

1. 业务口径以实际代码、SQL、接口定义和经确认的业务规则为准。
2. 不确定的字段、方法、接口、依赖和配置先检索确认，禁止假设存在。
3. 显示异常、计算错误类问题，先追踪数据来源和计算过程，再下结论。
4. 汇报时区分已证实事实 / 推测原因 / 待验证假设，三类不混写。
5. 修复前记录问题原因及预期变化，修复后验证问题是否消失。
6. 证据不足时不通过改代码掩盖问题，先把证据缺口报给用户。

## 专项知识触发

命中下列场景时，先读取对应文件：

| 场景 | 文件 |
|---|---|
| ve-table、虚拟滚动 rowKey、列设置、枚举列下拉 | `.claude\knowledge\ve-table-and-list.md` |
| 附件上传、预览、下载、字段级单文件附件 | `.claude\knowledge\file-upload-preview.md` |
| 云打印、`printWebBill`、锐浪报表 | `.claude\knowledge\cloud-print.md` |
| E09 `formEdit.vue` 子表保存、`getParam` | `.claude\knowledge\vue2-form-save.md` |

知识可信度规则：

- 环境配置、构建命令、组件接口、数据库口径类知识易过期；与当前代码冲突时**以当前代码和已确认事实为准**，并向用户报告冲突。
- 不把旧知识当绝对规则照抄；标注为「标准样式」的写法也先核对当前项目版本是否仍适用。

## 自动化脚本

检查逻辑沉淀在 `.claude\scripts\`（node，无第三方依赖），两个工具调用**同一份实现**，避免检查规则各自漂移。脚本均为只读（verify-change 的构建除外，属 L2）：

| 脚本 | 用途 | 调用时机 |
|---|---|---|
| `pre-change-check.js <仓库> [--json]` | 仓库/分支/工作区/技术栈/知识命中检查，输出 PROCEED / PULL_FIRST / NEED_CONFIRM / BLOCK | 任何改代码任务动手前 |
| `verify-change.js <仓库> [--skip-build]` | 按锁文件自动选 npm/pnpm/maven 构建、记录退出码、列出变更范围 | 修改完成后 |
| `repo-map.js <关键词>` | 域码静态映射 + rg 实搜，定位前端微应用/后端服务/公共包，附 file:line 证据 | 跨仓库任务定位代码时 |
| `final-review.js <仓库>...` | 待交付清单、敏感信息、调试残留、变更范围复核（只出报告，无 git 写操作） | 提交/推送之前 |
| `.claude\templates\task-report.md` | 整单任务报告模板（拆分/结果/验证/交付状态） | 任务收尾汇总时 |

注意：仓库里存在历史遗留的 `nul` 保留名文件，脚本内的 rg 调用已排除；新写检索逻辑时优先复用 `lib.js`（技术栈识别、git 状态解析、域码映射、知识触发词都在里面），不要各自重写。

## 环境与构建约定

- Vue 2 项目使用 npm 和现有 `package-lock.json`。
- Vue 3 项目使用 pnpm 和现有 `pnpm-lock.yaml`。
- 不使用 yarn，不要跨技术栈安装包管理器或生成第二份锁文件。
- 后端 Spring Boot 项目使用 JDK 8 和 Maven；打印或单据相关后端改动必须重新编译部署后才会生效。

常用命令：

```bash
# Vue2
npm run dev
npm run build:prod

# Vue3
pnpm dev
pnpm build:prod

# Spring Boot
mvn clean package -DskipTests
```

## Git 与工作日志

根目录本身是 Git 仓库（remote `AgentForge.git`），各业务目录通常又是各自独立的仓库。执行 Git 操作前先确认目标仓库边界，只处理本次任务相关文件。

**修改前先拉取，拉取前先检查**（2026-09-30 用户确认）：

1. 先 `git status`、确认当前分支与上游，再看工作区是否干净。
2. 工作区干净且分支正确才 `git pull`；拉取后确认是否产生合并或冲突。
3. 工作区有未提交改动、或拉取可能冲突/覆盖用户正在进行的工作时，**先停止并向用户说明**（哪些文件脏、预计冲突点），等用户决定；不擅自 `stash`、重置、覆盖。
4. 拉到新内容（远端新提交、合并、冲突）必须先向用户说明再继续。

未经用户明确要求，绝不提交、绝不推送；提交信息风格与推送细则见 `CLAUDE.md` 第 5 节。

Claude 的 `.claude\hooks\work-log.js` 通过 Claude hook 自动记录 `工作日志.md`。Codex 不会自动执行 Claude hook；除非用户明确要求，不要把该 hook 当作 Codex 的运行时依赖，也不要主动修改它。

## 测试与验证要求

构建命令按技术栈执行（见下节），并遵守：

- 优先运行与本次改动直接相关的测试/验证，再做完整构建；无法运行测试时说明原因，并列出尚未验证的内容。
- 构建失败先区分本次修改引入的问题与原有环境问题；原有问题如实报告，不顺手大修。
- 不允许为通过构建而删除测试、关闭校验、降低编译约束，或修改无关文件掩盖错误。
- 交付前 `git diff` 自检：无调试代码、无无关格式化、无意外文件变更。

**任务完成标准**（构建成功 ≠ 业务正确）：

1. 修改前后差异已检查，diff 只含本次任务改动。
2. 需求对应行为已验证；关键业务计算有可复核依据（口径出处、验算过程）。
3. 接口改动已检查新旧调用方兼容性。
4. 无法完成的验证项明确报告，不把未执行的验证描述为已通过。

配套脚本：修改完成跑 `node .claude/scripts/verify-change.js <仓库路径>`（自动按技术栈构建、记录退出码、列出变更范围）；提交推送前跑 `node .claude/scripts/final-review.js <仓库路径>...`（敏感信息、调试残留、变更范围复核，只出报告不做 git 写操作）。

## 兼容性保护

标准版、OEM 定制版、补丁版多产品线并存，局部修改可能影响其他客户或模块：

1. 默认不修改公共 API、公共组件既有行为、数据库结构。
2. 修改公共代码（`inkscommon` 包、公共工具服务、父 pom）前，先检索主要调用方和继承方。
3. OEM、标准版、补丁版的同源文件存在差异时，不得直接复制覆盖，先确认差异是定制还是落后。
4. 新增字段、接口参数、返回值时评估旧调用方兼容性。
5. 修改数据库字段或业务计算规则时，明确迁移影响与历史数据影响。
6. 不升级依赖、不引入第三方库，除非用户明确授权。

## Claude 配置兼容说明

`.claude\settings.json` 中的命令白名单、拒绝规则、MCP 开关和生命周期 hook 仅适用于 Claude Code，不能直接作为 Codex 配置读取。本文件已迁移其中与代码协作相关的安全约束；Codex 的权限和工具行为以当前运行环境及本文件为准。

根目录的 `CLAUDE.md` 仍作为详细目录地图和历史项目说明保留。若两个文件对同一规则存在差异，以本文件和用户当前请求为准。

## DSH 配置兼容说明（2026-10-06 落地）

DSH（DeepSeek Harness）不复用 Claude / Codex 的任何配置文件，等价能力按下面三处落地，改 DSH 行为改这三处，不要改 `.claude\settings.json`：

| 能力 | Claude 侧 | DSH 侧 |
|---|---|---|
| 用户全局指令 | `C:\Users\inks07\.claude\CLAUDE.md` | `C:\Users\inks07\.dsh\AGENTS.md`（DSH 的用户级 AGENTS.md，自动加载） |
| 项目指令 | 根 `CLAUDE.md` | 同样是根 `AGENTS.md` / `CLAUDE.md`（DSH 两者都加载，内容重复时去重） |
| 权限 | `.claude\settings.json` 的 allow / ask / deny 逐命令白名单 | **无法逐命令照搬**：DSH 是「沙箱模式 + 审批策略」两旋钮组成的预设，配置在 `C:\Users\inks07\.dsh\profiles\desktop\cordis.patch.yml`，由客户端 Permissions 选择器切换 |
| MCP | `.mcp.json` | 同一个 profile 文件里的 `@deepseek-ai/dsh-mcp-client` 条目（已接入 dbhub） |
| 生命周期 hook | `.claude\hooks\work-log.js`（UserPromptSubmit / Stop） | **官方无等价 hook**，不自动写 `工作日志.md`；主 Agent 收尾时手工按既有格式追加 |
| 项目技能 / 脚本 | `.claude\scripts\` + `.claude\agents\` | `.dsh\skills\`（DSH 自动发现，`<name>/SKILL.md`），脚本仍共用 `.claude\scripts\` 一份实现 |

DSH 侧权限三档与本文「执行权限分级」对应：`只读（L1）` / `工作区写入（L2）` / `完全访问（L3）`。**预设只约束文件写入边界，不区分具体命令**，所以 L3 里的「写数据库、删除、推送」仍靠指令约束逐项确认，不能指望预设拦住。

## 工作日志与问题记录（跨工具手工维护）

DSH 没有 hook，`工作日志.md` 与 `测试问题记录.md` 改为收尾时手工补记，格式沿用既有约定，不要另起体例：

- `工作日志.md`：按天表格追加一行（时间 / 任务 / 涉及 / 结果 / 耗时 / tokens / 费用），当天表格下方保留一行小字合计。用量三列 Claude 侧由 hook 回读 transcript 统计，DSH 侧取不到时记 `-`，不要编数字。
- `测试问题记录.md`：新记录追加在「新记录追加到这里下方」之后，按日期倒序；每条含现象 / 复现 / 证据 / 代码定位 / 状态，状态取值见该文件表格。
