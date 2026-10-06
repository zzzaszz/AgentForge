# D:\0-caoshi 目录地图

本文件用于快速定位代码位置，避免每次重新遍历目录。**路径以本机实际为准**。

## 0. 先看这里：常见任务该去哪

| 要找什么 | 去哪 |
|---|---|
| 标准版后端接口/SQL（PMS、销售、制造、系统等） | `0-SvcCode\OMS\inks-service-<模块>-master` |
| OEM 客户定制后端 / 云打印报文 | `0-SvcCode\svc-oem\inks-service-oem-<代号>` |
| SA 平台后端、补丁服务 | `0-SvcCode\SA\` |
| 标准版 Vue2 微应用（如 PMS 的 D11M16B1） | `0-Web_Code\mf-vue2\mfomsweb\mf-stdweb-<模块>` |
| OEM 定制微应用（k1038/k1039/k1041） | `0-Web_Code\mf-vue2\mfoemweb\mf-cusweb-<代号>-<模块>` |
| 补丁版微应用 | `0-Web_Code\mf-vue2\mfpatchweb\mf-patchweb-<代号>` |
| 老版单体 Vue2 前端（ui-*） | `0-Web_Code\web2\ui-*` |
| Vue3 新版前端 | `0-Web_Code\web3\mf-*` |
| 公共 npm 包源码（列设置、webcomp 等） | `0-Web_Code\web2\inksnpm\inkscommon\` |
| Flutter 桌面/移动端 | `0-Web_Code\flt\desk\` |
| 微前端打包聚合（含 build/deploy/docker） | `0-Web_Code\mf-mg\mg-*`（git submodule，**子目录常为空，需 `node init.js` 拉取**） |
| 微前端 nginx 配置 | `0-Web_Code\mf-nginx\` |
| 云打印工具（锐浪 Grid++Report） | `oemGrfPrinter\`（.NET 8 服务）+ `0-other\0226- grfpool\`（报表模板池） |
| 开发文档、部署手册 | `文档\2025\`、`文档\2026\` |
| 客户现场 SQL 脚本 | `DB\` |

**更细的定位表**：需要完整域码表（D01/D03/D04/D05/D06/D07/D09/D10/D11/D22/D91/D96/SYS）、各 `mf-stdweb-*` 的 `src/views/modules/` 下实际有哪些域码目录、"前端微应用 ↔ 后端服务"对应图时，读本目录根下的 `目录详解-0-SvcCode与0-Web_Code.md`（18KB，**按需读，勿预加载**）。

**专项知识（按场景按需读，勿预加载）**：`.claude\knowledge\` 下按主题存放踩坑记录，命中场景再读对应文件：

| 场景触发 | 读哪个 |
|---|---|
| **做「单元格可编辑」的表格——标准样式在文档第 7 节，照抄即可**（ve-table 列表页、单元格内嵌下拉/时间选择、表格高度塌缩、列设置 SetColums） | `.claude\knowledge\ve-table-and-list.md` |
| 附件上传/预览/下载、字段级单文件反向关联附件 | `.claude\knowledge\file-upload-preview.md` |
| 云打印 printWebBill、锐浪 Grid++Report 报文、打印次数 | `.claude\knowledge\cloud-print.md` |
| 子表打印不出来 / 只有表头没有行 / 锐浪模板表名排查 | 先读 `.claude\knowledge\cloud-print.md` 的「坑④」，再看 `cloud-print-subreport-case.md`（E09M06B1 各版本对照） |
| E09 系列 formEdit.vue 保存子表、`getParam` | `.claude\knowledge\vue2-form-save.md` |
| **卡片右上角"角标"（状态斜角标）——"角标"默认指这套样式，先读再动手** | `.claude\knowledge\card-corner-badge.md` |
| **pad 端数量输入/虚拟数字键盘（numpad）——排列固定 4 列，三种现成实现照抄，先读再动手** | `.claude\knowledge\pad-numpad-keyboard.md` |
| **写后端"异步任务 + 前端轮询"接口、新增 Controller 接口或 mapper 方法——三段式标准样板照抄，四条编码规范先读再动手** | `.claude\knowledge\backend-async-polling.md` |
| **动手改代码之前**（尤其：同一问题被反复返工、改日期/时间显示、写"改数据后刷新 UI"的逻辑）——内含动手前检查清单 | `.claude\knowledge\lessons-and-pitfalls.md` |

---

## 1. 顶层目录

| 目录 | 说明 |
|---|---|
| `0-SvcCode` | **所有后端 Java 源码**（见 §2） |
| `0-Web_Code` | **所有前端源码**（见 §3） |
| `0-other` | 独立小项目：BizLens(AI 代码知识库问答)、xiantu-s1-archive(Nuxt3 修仙游戏)、404-forum、docs(Obsidian 主题)、0226- grfpool(锐浪报表模板) |
| `DB` | 客户现场 SQL 脚本与截图（生产成本、加工单投料/完工、业务员统计） |
| `文档` | `2025\` / `2026\` 开发文档、部署手册、原型 HTML、知识体系 md |
| `代码备份` | 空 |
| `oemGrfPrinter` | **云打印服务工具** .NET 8.0 WPF（exe + 锐浪 grdes6 dll + MQTTnet），另有安装包 `oemGrfPrinter_Setup_v9.0.0.0.exe` |
| `apache-maven-3.8.3` | Maven 及本地 `repository` |
| `verdaccio` | 内网 npm 私服发布脚本（`publish.mjs`、`publishLog.txt`） |
| `ideapojie` | IDEA 破解补丁 |
| `Clash.for.Windows-*` / `Dism++*` / `Typora_green` / `企业微信截图*.png` | 本机工具与杂项 |
| `1、基于Flutter3.x实战…` / `3、Flutter高级进阶实战…` | Flutter 教程视频（非业务代码） |

---

## 2. 0-SvcCode（后端）

### 2.1 `OMS\` — 标准版微服务，每个子目录一个独立 Git 仓库
`inks-service-*-master` 命名，父/聚合 pom 为 `inks-cloud-master`。

| 服务 | 领域 |
|---|---|
| `inks-cloud-master` | 父/聚合工程（版本管理、模块聚合） |
| `inks-service-system-master` | 系统管理、权限菜单、列设置（SYSMxx） |
| `inks-service-utils-master` | 通用工具：**附件 Uts_Attachment / D96M03B1**、文件上传预览、定时计划 |
| `inks-service-sale-master` | 销售（D01） |
| `inks-service-pms-master` | 生产管理 PMS（D11） |
| `inks-service-manu-master` | 制造/加工（D05） |
| `inks-service-buy-master` | 采购 |
| `inks-service-store-master` | 仓储 |
| `inks-service-goods-master` | 货品/物料 |
| `inks-service-qms-master` | 品质管理 |
| `inks-service-crm-master` | 客户关系 |
| `inks-service-eam-master` | 设备管理（安灯等） |
| `inks-service-fm-master` | 财务 |
| `inks-service-mqs-master` | 质量体系 |
| `inks-service-wpt-master` | 报工平台 |
| `inks-service-eap-master` | 企业应用集成 |
| `inks-service-auth-master` | 认证鉴权 |
| `inks-service-oem-k1039` / `-k1041` / `-wh` | OEM 定制（对应客户代号） |

### 2.2 `svc-oem\` — OEM 定制/平台聚合
- `inks-platform-<产品线>-master`：各产品线**聚合父 pom + Nacos 配置**（a01/crm/k1038/k1039/k1040/k1041/mqs/oms/pms/smes/sot/temp/ultra），Spring Boot 2.7.18。
- `inks-service-oem-<代号>`：定制业务代码。`k1038` 对应云打印/锐浪报文（printWebBill）。
- 客户代号：k1038 / k1039 / k1040 / k1041（另有 br、gm、wh）。

### 2.3 `SA\` — SA 平台
- `inks-sa-common-master`：公共库。
- `inks-service-sa-{cms,crm,edb,gen,oms,pms,reg,som,sot,uts,wms}`：SA 各领域服务。
- `inks-service-patch-{rs,sd,std,tree}`：**补丁/客制化分支服务**。
- 全部 Spring Boot 2.5.3。

### 2.4 `Other\` — 非业务/学习项目
`inks-service-test-master`、`mall-master`、`newbee-mall-master`、`platform-wxshop-1.0.0`。

---

## 3. 0-Web_Code（前端）

### 3.1 `mf-vue2\` — **主力 Vue2 微应用**（当前业务开发主战场）
按产品线分三个容器目录，其下每个 `mf-*` 目录是一个独立微应用：

| 容器 | 微应用 |
|---|---|
| `mfoemweb`（OEM 定制） | `mf-cusweb-k1038-sale`、`mf-cusweb-k1039-cost`、`mf-cusweb-k1041-cost`、`mf-oemweb-rs` |
| `mfomsweb`（标准版，**最常用**） | `mf-stdweb-` + buy / crm / eam / fm / goods / manu / mqs / **pms** / qms / **sale** / store / **sys** / **utils**；以及 `mf-indweb-fb/mu/pcb`、`mf-omsweb`、`mf-omsweb-me` |
| `mfpatchweb`（补丁） | `mf-patchweb-rs`、`mf-patchweb-sd`、`mf-patchweb-tree` |

**模块编码前缀**（页面路径里 `D11M16B1` 这种就是它）：
`mf-stdweb-sys`=SYS、`mf-stdweb-sale`=D01、`mf-stdweb-utils`=D96、`mf-stdweb-pms`=D11、`mf-stdweb-manu`=D05。

### 3.2 `mf-mg\` — 微前端**聚合打包仓库**（Git submodule）
`mg-stdweb-pms` / `mg-stdweb-crm` / `mg-stdweb-mqs` / `mg-stdweb-smes` / `mg-stdweb-ultra` / `mg-oemweb-k1038` / `mg-oemweb-k1039` / `mg-indweb-pcb`。
- 结构：`init.js`（按 GitLab 地址拉子模块）+ `build.js`（遍历子模块构建）+ `deploy\` + `docker\`。
- **子目录常为空目录**（submodule 未初始化），要看具体代码请去 §3.1 的 `mf-vue2`。

### 3.3 `web2\` — 老版单体 Vue2 前端
- `ui-omsweb-{fb,jdb,lb,me,mu,pcb}`、`ui-oneweb-{cms,crm,edb,oam,pms,reg,smes,som,uts,wms}`、`ui-oemweb-br`、`ui-plusweb-{admin,ems,sot}`、`ui-adminweb`：均为 `vue-admin-template`（Vue 2.6.10 + Element UI）。
- `inksnpm\`：**`@inksyun` npm 包源码仓库** —— `inkscommon\inksutils`(`@inksyun/utils`)、`inkscommon\inkswebcomp`(`@inksyun/webcomp`，含列设置 SetColums、单据状态栏等组件)、`inkscommon\inkswebform`。
- `oemweb\` / `plusweb\` / `0-wkspaceapp\`：PDA/H5、uniapp 移动端。
- `0-wkspace\`：**活跃工作区**（非临时目录）。内含两个独立 git 仓库 `ui-omsweb`（`git.inksdev.com/omsweb/ui-omsweb`）、`ui-oneweb-sot`（`git.inksdev.com/saweb/ui-oneweb-sot`），二者持续有新提交；另有成本/订单追溯原型 html 与 `成本追溯系统实现指南.md`。
- `docs\`：仅几张图片。

### 3.4 `web3\` — Vue3 新版
`mf-omsweb` / `mf-omsweb-master` / `ui-omsweb-fw`（vue3-element-template，Vue 3.5.13）、`mf-omspad`、`mf-stdpad-manu`、`mf-stdpad-qms`、`mf-stdweb-wpt`（Vue 3.5.16）、`knowweb`、`inksoneflutter-wpt`。

### 3.5 `flt\` — Flutter
`desk\`：`flt-platdesk-oms`（MES 桌面客户端，Win/Web/Android/iOS）、`flt-partdesk-{goods,qms,sale}`、`flt-plusdesk-core`、`flt-plusapp-core`、`flt-platapp-wrs`（审批移动端）。
`web\`：空。

### 3.6 其他
- `LED\ui-oneand-led`：Android（Gradle/Kotlin）项目。
- `mf-nginx\`：微前端 nginx 部署配置（`deploy\`、`docker\`）。

---

## 4. 环境与构建命令

### 4.1 本机环境（2026-09 实测）
| 工具 | 版本/位置 |
|---|---|
| Node | v18.20.8（Volta 管理，`C:\Users\inks07\AppData\Local\Volta`） |
| npm | 9.9.4（**Vue2 项目专用**） |
| pnpm | 10.28.2（**Vue3 项目专用**） |
| JDK | **1.8.0_301**（PATH 默认，`D:\jdk1.8`） |
| Maven | 3.8.3，`D:\0-caoshi\apache-maven-3.8.3`（已在 PATH） |
| Git | 2.49.0.windows.1 |
| .NET | 已装（`C:\Program Files\dotnet`，oemGrfPrinter 为 .NET 8） |
| Flutter | `D:\flutter`（已在 PATH） |
| Python | 3.13（`AppData\Local\Programs\Python\Python313`） |

### 4.2 前端构建

**包管理器规则（强制，按技术栈区分，不要混用）：**

| 技术栈 | 目录 | 包管理器 | 锁文件 |
|---|---|---|---|
| Vue 3 | `0-Web_Code\web3\**` | **pnpm** | `pnpm-lock.yaml` |
| Vue 2 | `0-Web_Code\mf-vue2\**`、`0-Web_Code\web2\**` | **npm** | `package-lock.json` |
| 聚合脚本 | `0-Web_Code\mf-mg\**` | npm | 仅 `node init.js` / `node build.js`，不装前端依赖 |

- **统一不使用 yarn**。
- **不要跨装**：在 Vue2 项目跑 `pnpm install`、或在 Vue3 项目跑 `npm install` 会生成第二份锁文件，依赖树与同事/CI 不一致。判断归属先看现有锁文件。
- 已知越界（2026-09-16 实测，改动这些项目时注意别沿用错误锁文件）：
  - 应在 `web3\` 却多出 `package-lock.json`：`mf-stdweb-wpt`。
  - 应在 `mf-vue2\` 却多出 `pnpm-lock.yaml`：`mf-stdweb-eam`、`mf-stdweb-manu`、`mf-stdweb-sale`。

```bash
# Vue2 微应用（webpack4 / vue-cli-service），如 mf-stdweb-pms —— 用 npm
cd 0-Web_Code/mf-vue2/mfomsweb/mf-stdweb-pms
npm run dev          # 本地起服务
npm run build:prod   # 生产构建

# Vue3 项目（Vite），如 web3/mf-omsweb —— 用 pnpm
cd 0-Web_Code/web3/mf-omsweb
pnpm dev
pnpm build:prod
```

- 老 Vue2 项目在 Node 17+ 若报 `digital envelope routines::unsupported`，加
  `NODE_OPTIONS=--openssl-legacy-provider`（npm scripts 里已带 `--max_old_space_size`，内存参数勿动）。
- 微前端聚合构建（`mf-mg\mg-*`）：先 `node init.js` 拉取 submodule，再 `node build.js` 打包。

### 4.3 后端构建
Spring Boot 项目统一用本机 maven + JDK 8：

```bash
cd 0-SvcCode/OMS/inks-service-pms-master
mvn clean package -DskipTests
```

- `OMS\` 与 `svc-oem\` 的 `inks-service-*` 为 Spring Boot 2.5.3 / 2.7.18。
- 打印/单据相关改动必须**重新编译部署**才生效，排查问题先确认跑的不是旧包。

---

## 5. 注意事项

- 根目录 `D:\0-caoshi` 本身**是一个 Git 仓库**（remote `AgentForge.git`，2026-10-06 实测仅 1 个提交 `初始化AI工作区配置`，跟踪的是 AI 配置与文档，不含业务代码），各子项目又各自独立 Git（内网 GitLab `git.inksdev.com` / `192.168.99.92`）；因此改业务代码仍须 `cd` 进具体仓库，根目录的 `/review`、diff 类流程只对根仓库自身（配置/文档）有效。
- 前端目录普遍含巨量 `node_modules`（已装约 34 处）。根目录 `.ignore` 已配置 ripgrep 忽略规则（`node_modules/`、`target/`、`dist/`、`.nuxt/` 等），**新增忽略项请改这个文件**。
- `.claude\settings.json` 已配置只读命令白名单；deny 硬禁止 `git reset --hard` / `git clean` / `git checkout --` / `git restore` / `git push --force` / `git push -f`，以及对盘根目录的 `rm -rf`。2026-09-30 起 `node -e` / `rm` / `git commit` / `git push` 已从 ask 列表移除，改由 auto 模式判断——**这不等于已获授权**：推送前仍须明确要求，规则见本文件下方「Git 提交/推送规则」。该文件另注册了工作日志 hook（见下条）。
- **修改代码前先拉取**（2026-09-30 用户确认）：每个涉及改代码的任务，动手前先在目标仓库检查 `git status` 与当前分支，工作区干净才 `git pull`；有未提交改动、冲突风险或拉取到新内容时，先向用户说明再继续（各子仓库独立 Git，需 `cd` 进对应仓库）。
- **通用行为与安全约束在根目录 `AGENTS.md`**（Claude 与 Codex 共用）：执行权限分级（L1 只读 / L2 可逆修改 / L3 高风险逐项确认）、数据库默认只读、修改前检查清单、证据与假设管理、测试与验证要求、多产品线兼容性保护，以及自动化脚本清单。改代码、查数据库前按需读取，本文件不重复正文。
- **自动化检查脚本在 `.claude\scripts\`**（node，已入命令白名单）：改代码前跑 `pre-change-check.js`，改完跑 `verify-change.js`，推送前跑 `final-review.js`，跨仓定位用 `repo-map.js`；公共逻辑在 `lib.js`，检查逻辑只有这一份，不要在对话里另写一套。
- **Git 提交/推送规则**（未经用户明确要求，绝不提交、绝不推送）：
  1. 只 `git add` 本次任务相关文件，不回滚用户已有改动。
  2. **提交信息风格**（2026-09-19 用户确认，各仓库通用）：
     - **无前缀**——不用 `fix:` / `feat:` 等 conventional 前缀，纯中文；
     - 常规格式为「文件名/模块 + 中文描述」，如 `SYSM06B1/SYSM01B7四处接口getLoginUser改为tid为空时才调用，Feign内部无token调用不再异常`；
     - 涉及**多个文件或多块业务逻辑**时：第一行为标题概述，换行后用 1、2、3、4 分条列出各项改动；
     - 跟随该仓库既有风格，历史提交均为纯中文无前缀。
  3. 用户要求推送时**先拉取、再推送**：先执行 `git pull`（或 `git fetch` 后确认差异）。
  4. **若拉取到新内容**（远端有新提交、或产生合并/冲突），**必须先向用户说明**——拉到了哪些提交、是否冲突、如何处理——确认后再 `git push`。
- **工作日志**：根目录 `工作日志.md` 自动记录每次工作（时间/任务/涉及/结果/耗时/tokens/费用，每天表格下方一行小字合计）。由 `.claude\hooks\work-log.js` 实现，挂在 `UserPromptSubmit` + `Stop` 两个事件上，两段式——前者暂存用户请求与 transcript 行号，后者消费并追加一行后删除暂存，因此**每个请求最多一行**。脚本用 node。注意 `Stop` 是每轮响应触发而非会话结束。
  - 用量三列靠 Stop 时回读 transcript 统计。**该 JSONL 格式为 internal、随版本变化，但此处是唯一数据源**，故解析逻辑集中在 `sumTurn()` / `scanFile()` 两个函数里；若某天这三列集体记 `-`，先怀疑 transcript 结构变了，看这两处而非全文件。已知必须处理的两点：同一 `message.id` 会拆成多行且每行带相同 `usage`（**必须去重**），子代理用量在 `<session>/subagents/*.jsonl` 而非主文件。
  - 费用单价表在 `.claude\hooks\pricing.json`（Flash / Pro 两个模型，含旧模型名别名）。**高峰/空闲分档**：高峰为北京时间周一至周五 9-12、14-18 点，空闲价 = 高峰价一半，配置里只写高峰价即自动折半；判档逐条按消息自身时间戳做，跨时段的长轮次不会被整轮一刀切。时段规则在 `peakHours` 段，改它不用动脚本。模型没配价则记 `-`。「时间」列带档位标记 `峰`/`谷`/`峰谷`（跨档），与费用列同源，二者永远一致。
  - **不要主动维护该文件**；要调格式或过滤规则改 `work-log.js`。
- `0-Web_Code\web2\0-wkspace\` 名为 wkspace 但**不是临时目录**，里面的 `ui-omsweb` / `ui-oneweb-sot` 是活跃仓库，勿当垃圾清理。
- `tmpclaude-*-cwd` 是 Claude Code 早期版本留在工作目录里的 38 字节路径标记文件，已清理；新出现可直接删。
