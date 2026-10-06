# 0-SvcCode 与 0-Web_Code 目录详解

> 目的：下次接手任务时，能在 1 分钟内定位到要改的文件。
> 配套阅读：根目录 `CLAUDE.md`（全局地图），本文件是其两个大目录的展开版。
> 本文所有路径与结论均于 2026-09 实测扫描确认，**非推测**（个别标注「待确认」的除外）。

---

## 0. 三十秒速查：任务 → 去哪

| 我要做的事 | 前端目录 | 后端目录 |
|---|---|---|
| 生产管理 PMS（D11） | `0-Web_Code/mf-vue2/mfomsweb/mf-stdweb-pms` | `0-SvcCode/OMS/inks-service-pms-master` |
| 销售（D01） | `mf-vue2/mfomsweb/mf-stdweb-sale` | `OMS/inks-service-sale-master` |
| 采购（D03） | `mf-vue2/mfomsweb/mf-stdweb-buy` | `OMS/inks-service-buy-master` |
| 仓储（D04） | `mf-vue2/mfomsweb/mf-stdweb-store` | `OMS/inks-service-store-master` |
| 制造/加工（D05） | `mf-vue2/mfomsweb/mf-stdweb-manu` | `OMS/inks-service-manu-master` |
| 品质（D06） | `mf-vue2/mfomsweb/mf-stdweb-qms` | `OMS/inks-service-qms-master` |
| 财务（D07） | `mf-vue2/mfomsweb/mf-stdweb-fm` | `OMS/inks-service-fm-master` |
| 设备管理（D09） | `mf-vue2/mfomsweb/mf-stdweb-eam` | `OMS/inks-service-eam-master` |
| 客户关系（D10） | `mf-vue2/mfomsweb/mf-stdweb-crm` | `OMS/inks-service-crm-master` |
| 货品/物料（D91） | `mf-vue2/mfomsweb/mf-stdweb-goods` | `OMS/inks-service-goods-master` |
| 质量体系（D22） | `mf-vue2/mfomsweb/mf-stdweb-mqs` | `OMS/inks-service-mqs-master` |
| 通用工具/附件（D96） | `mf-vue2/mfomsweb/mf-stdweb-utils` | `OMS/inks-service-utils-master` |
| 系统管理/列设置（SYS） | `mf-vue2/mfomsweb/mf-stdweb-sys` | `OMS/inks-service-system-master` |
| OEM 客户定制（k1038 云打印） | `mf-vue2/mfoemweb/mf-cusweb-k1038-sale` | `svc-oem/inks-service-oem-k1038` |
| SA 平台 / 补丁分支 | `web2/ui-omsweb-*`、`mfpatchweb/mf-patchweb-*` | `SA/inks-service-sa-*`、`SA/inks-service-patch-*` |

---

## 1. 先懂编码体系，再看目录

整个仓库的目录名、文件名、接口路径、数据库表名都围绕**模块编码**组织。看懂编码，定位速度提升一个量级。

### 1.1 模块编码格式

```
D11M16B1
│   │  │└─ 序号（同一模块下的多个变体）
│   │  └── 类型字母：B/R/S/P/H/M/JOBB
│   └───── 模块序号（M + 两位数字）
└───────── 业务域码（见下表）

复杂变体：D05M01B1ML / D11M02B1FN / D03M06B1PRE / D04M08P3RT / D91M01B1VIR
          ↑ 在基础编码后追加功能后缀（ML 条码、PRE 预处理、VIR 虚拟、RT 实时等）
```

**域码对照表**（已通过各后端服务 controller 目录前缀反查确认）：

| 域码 | 业务域 | 后端服务 |
|---|---|---|
| `D01` | 销售 | sale |
| `D03` | 采购 | buy |
| `D04` | 仓储 | store |
| `D05` | 制造/加工 | manu |
| `D06` | 品质 | qms |
| `D07` | 财务 | fm |
| `D09` | 设备/安灯 | eam |
| `D10` | 客户关系 | crm |
| `D11` | 生产管理 PMS | pms |
| `D22` | 质量体系 | mqs |
| `D91` | 货品/物料 | goods |
| `D96` | 通用工具/附件/打印 | utils |
| `SYS` | 系统管理/权限/列设置 | system |
| `D25` | 待确认（仅见 `D25M01B1`） | — |

### 1.2 类型字母（实测高频）

| 字母 | 含义 | 例 |
|---|---|---|
| `B` | 单据/表格式窗体（**最常见**） | `D11M16B1` 产品运营资料表格 |
| `R` | 报表 | `D11M02R1` |
| `S` | 设置/明细配置页 | `D11M14S1` 弹窗 |
| `P` | 打印相关 | `D05M01P3` |
| `H` | 混合/特殊页 | `D01M03H1` |
| `M` | 主数据维护 | `D96M25M1` |

> 编号规律无统一文档，**以目录内实际代码为准**；但"编码在所有层（前端目录 / 后端 Controller / 接口路径 / 数据库表）保持一致"是硬规律，这是最快的交叉定位手段。

### 1.3 用编码串起四层

以 `D11M16B1` 为例，四层同名：

```
前端  0-Web_Code/mf-vue2/mfomsweb/mf-stdweb-pms/src/views/modules/D11/D11M16B1/
后端  0-SvcCode/OMS/inks-service-pms-master/.../std/pms/controller/D11M16B1Controller.java
接口  POST /pms/D11M16B1/getPageList
表    Pms_ProductOperateDoc 之类（表名规则不统一，需看 domain/pojo）
```

**定位口诀：拿到一个模块编码，四层直接拼路径，不要用全局搜索。**

---

## 2. 0-SvcCode —— 全部后端 Java 源码

```
0-SvcCode/
├── OMS/           标准版微服务（主力，每子目录一个独立 Git 仓库）
├── svc-oem/       OEM 定制服务 + 各产品线聚合父 pom / Nacos 配置
├── SA/            SA 平台服务 + 补丁分支服务
└── Other/         非业务学习项目（mall、newbee-mall 等，可忽略）
```

### 2.1 `OMS/` —— 标准版（20 个仓库）

命名统一为 `inks-service-<领域>-master`，父/聚合 pom 为 `inks-cloud-master`。

**内部结构（以 pms 为例，其余同构）：**

```
inks-service-pms-master/
├── pom.xml                        # 聚合 pom
├── doc/                           # ★ 开发文档、原型图 html、建表 SQL 都在这里
├── inks-service-std-pms/          # 实际 Spring Boot 模块
│   ├── pom.xml
│   ├── deploy.yaml / dockerfile   # 部署
│   └── src/main/
│       ├── java/inks/service/std/pms/
│       │   ├── controller/        # 107 个，文件名 = 模块编码（D11M16B1Controller.java）
│       │   ├── service/ + impl/
│       │   ├── dao/  mapper/      # MyBatis
│       │   ├── domain/{pojo,dto,vo}/
│       │   ├── config/ utils/
│       │   └── InksServicePmsApplication.java
│       └── resources/
│           ├── application-{dev,prod}.yml
│           └── mapper/*.xml       # SQL
```

> 注意：`system` 服务的包路径是 `inks/system/` 而非 `inks/service/std/system/`，是特例。

**各服务领域速查**（详见 §0 速查表）：`auth` 认证鉴权、`eap` 企业应用集成、`wpt` 报工平台、`oem-k1039/k1041/wh` OEM 定制。

**`inks-service-utils-master` 特殊内容**：除标准模块外，顶层还有 9 个 `inksgrf-server-<hash>-tcpdevinksyuncom30123/` 目录 —— 这是**锐浪 Grid++Report 云打印服务**的运行目录（对应根目录 `oemGrfPrinter`）。排查云打印问题时两个地方都要看。

### 2.2 `svc-oem/` —— OEM 定制 + 产品线聚合

两类目录，**不要混淆**：

| 类型 | 命名 | 作用 |
|---|---|---|
| 聚合父 pom | `inks-platform-<产品线>-master` | 只管版本管理 + Nacos 配置，**无业务代码**。含 a01/crm/k1038/k1039/k1040/k1041/mqs/oms/pms/smes/sot/temp/ultra |
| 定制业务 | `inks-service-oem-<代号>` | 真正的客户定制代码。含 br/gm/k1038/wh |

- Spring Boot **2.7.18**（OMS 为 2.5.3，注意差异）。
- `k1038` = 云打印/锐浪报文主战场（`printWebBill`）。内部结构同样是 `inks-service-std-k1038/`。

### 2.3 `SA/` —— SA 平台与补丁

- `inks-sa-common-master`：公共库。
- `inks-service-sa-{cms,crm,edb,gen,oms,pms,reg,som,sot,uts,wms}`：SA 各领域服务。
- `inks-service-patch-{rs,sd,std,tree}`：**补丁/客制化分支服务**，对应前端 `mfpatchweb/mf-patchweb-*`。
- 全部 Spring Boot **2.5.3**。

---

## 3. 0-Web_Code —— 全部前端源码

```
0-Web_Code/
├── mf-vue2/     ★ Vue2 微应用（当前业务开发主战场）
├── web2/        老版单体 Vue2 + @inksyun npm 包源码 + PDA/H5
├── web3/        Vue3 新版
├── flt/         Flutter 桌面/移动端
├── mf-mg/       微前端聚合打包（Git submodule，子目录常为空）
├── mf-nginx/    微前端 nginx 部署配置
└── LED/         Android（Gradle/Kotlin）
```

### 3.1 `mf-vue2/` —— 主战场

按产品线分三个容器，其下每个 `mf-*` 是**独立微应用（独立 Git 仓库）**：

| 容器 | 微应用 |
|---|---|
| `mfomsweb/`（标准版，**最常用**） | `mf-stdweb-` + buy/crm/eam/fm/goods/manu/mqs/**pms**/qms/**sale**/store/**sys**/**utils**；另 `mf-indweb-{fb,mu,pcb}`、`mf-omsweb`、`mf-omsweb-me` |
| `mfoemweb/`（OEM 定制） | `mf-cusweb-k1038-sale`、`mf-cusweb-k1039-cost`、`mf-cusweb-k1041-cost`、`mf-oemweb-rs` |
| `mfpatchweb/`（补丁） | `mf-patchweb-rs`、`-sd`、`-tree` |

**微应用内部结构（以 mf-stdweb-pms 实测）：**

```
mf-stdweb-pms/
├── vue.config.js  babel.config.js  postcss.config.js
├── package.json          # name 统一是 "vue-admin-template"
├── public/  build/  deploy/  docker/  dist/  doc/
├── node_modules/         # 已安装，可直接跑
└── src/
    ├── main.js  micro.js  public-path.js   # micro.js = 微前端接入
    ├── permission.js  settings.js  router/  store/
    ├── api/  utils/  directives/  icons/  styles/  components/
    ├── homelayout/  layout/
    └── views/
        ├── manage/       # 平台内置页（dashboard/calendar/backlog/project/message）
        └── modules/      # ★ 业务页面，按域码分目录
            ├── D11/      # PMS：53 个模块，D11M01B1 … 
            ├── Sa/       # SA 平台公共页（SaAttachment/SaUser/SaConfig…）
            └── …         # 各微应用不同，见下
```

**各微应用 `src/views/modules/` 下的域码目录（实测）：**

| 微应用 | **主域码** | modules 下全部域码 |
|---|---|---|
| `mf-stdweb-pms` | `D11` | D11、Sa |
| `mf-stdweb-sale` | `D01` | D01 D04 D05 D07 D91 D96 SYS |
| `mf-stdweb-buy` | `D03` | D01 D03 D05 D07 D91 D96 SYS |
| `mf-stdweb-store` | `D04` | D01 D03 D04 D05 D07 D91 D96 SYS |
| `mf-stdweb-manu` | `D05` | D01 D03 D04 D05 D07 **D25** D91 D96 SYS |
| `mf-stdweb-qms` | `D06` | D01 D03 D04 D05 D06 D07 D91 D96 SYS |
| `mf-stdweb-fm` | `D07` | D01 D03 D07 D96 SYS |
| `mf-stdweb-eam` | `D09` | D05 D09 SYS |
| `mf-stdweb-crm` | `D10` | D10、Sa |
| `mf-stdweb-goods` | `D91` | D01 D03 D04 D05 D91 D96 SYS |
| `mf-stdweb-mqs` | `D22` | D22 SYS |
| `mf-stdweb-utils` | `D96` | D01 D04 D96 SYS |
| `mf-stdweb-sys` | `SYS` | D01 D03 D04 D05 D06 D91 D96 SYS |
| `mf-cusweb-k1038-sale` | `E09` | D01 D03 D04 D05 D07 D09 D91 D96 E09 SYS |

> **重要**：域码目录会**跨微应用重复出现**（如 `D01` 在 manu/sale/sys/qms/utils 里都有）。因为微前端会把各微应用的页面合并进同一菜单体系。**找某个编码的页面时，先按主域去对应微应用找，找不到再全局搜。**

**模块目录内部**：每个 `D11M16B1/` 通常含 `index.vue`（列表）+ `components/`（tableList.vue、formEdit.vue、listHeader.vue）+ 单据类的 `components/editItem.vue`。

### 3.2 `web2/` —— 老版单体 + npm 包源码

| 子目录 | 说明 |
|---|---|
| `inksnpm/inkscommon/` | **`@inksyun` npm 包源码**：`inksutils`(`@inksyun/utils`)、`inkswebcomp`(`@inksyun/webcomp`，**含全局组件 `SetColums` 列设置**、单据状态栏)、`inkswebform` |
| `0-wkspace/` | ⚠️ 名为 wkspace 但**不是临时目录**。含活跃仓库 `ui-omsweb`、`ui-oneweb-sot`，及成本/订单追溯原型 html |
| `ui-omsweb-{fb,jdb,lb,me,mu,pcb}` | 老版 OMS 单体前端（vue-admin-template） |
| `ui-oneweb-{cms,crm,edb,oam,pms,reg,smes,som,uts,wms}` | SA 体系老前端 |
| `ui-plusweb-{admin,ems,sot}`、`ui-adminweb` | plus/admin 体系 |
| `ui-oemweb-br` | OEM 老前端 |
| `oemweb/`、`plusweb/` | PDA / H5 / uniapp 移动端 |
| `inksoneuniapp-wms` | uniapp WMS |
| `docs/` | 仅几张图片 |

> 改 `@inksyun/*` 包行为时，源码在 `inksnpm/inkscommon/`，但**运行时读的是 node_modules** —— 本地调试需要 link 或改后重新发布（`verdaccio/publish.mjs`）。

### 3.3 `web3/` —— Vue3 新版

`mf-omsweb`、`mf-omsweb-master`、`ui-omsweb-fw`（vue3-element-template，Vue 3.5.13）、`mf-omspad`、`mf-stdpad-manu`、`mf-stdpad-qms`、`mf-stdweb-wpt`（Vue 3.5.16）、`knowweb`、`inksoneflutter-wpt`。

### 3.4 `flt/` —— Flutter

`desk/`：`flt-platdesk-oms`（MES 桌面客户端，Win/Web/Android/iOS）、`flt-partdesk-{goods,qms,sale}`、`flt-plusdesk-core`、`flt-plusapp-core`、`flt-platapp-wrs`（审批移动端）。`web/` 为空。

### 3.5 `mf-mg/` 与 `mf-nginx/`

- `mf-mg/mg-*`：**微前端聚合打包仓库（Git submodule）**，含 `init.js`（拉子模块）+ `build.js`（遍历构建）+ `deploy/` + `docker/`。**子目录常为空目录**，要看代码去 §3.1，别在这找。
- `mf-nginx/`：nginx 配置（`deploy/`、`docker/`、`双入口方案说明.md`）。

---

## 4. 前后端对应关系图

```
  前端微应用                     域码        后端微服务
  ──────────────────────────────────────────────────────
  mf-stdweb-pms      ────────  D11  ──────  inks-service-pms-master
  mf-stdweb-sale     ────────  D01  ──────  inks-service-sale-master
  mf-stdweb-buy      ────────  D03  ──────  inks-service-buy-master
  mf-stdweb-store    ────────  D04  ──────  inks-service-store-master
  mf-stdweb-manu     ────────  D05  ──────  inks-service-manu-master
  mf-stdweb-qms      ────────  D06  ──────  inks-service-qms-master
  mf-stdweb-fm       ────────  D07  ──────  inks-service-fm-master
  mf-stdweb-eam      ────────  D09  ──────  inks-service-eam-master
  mf-stdweb-crm      ────────  D10  ──────  inks-service-crm-master
  mf-stdweb-goods    ────────  D91  ──────  inks-service-goods-master
  mf-stdweb-mqs      ────────  D22  ──────  inks-service-mqs-master
  mf-stdweb-utils    ────────  D96  ──────  inks-service-utils-master
  mf-stdweb-sys      ────────  SYS  ──────  inks-service-system-master
  mf-cusweb-k1038-*  ────────  E09  ──────  inks-service-oem-k1038
  mf-patchweb-*      ────────   —   ──────  SA/inks-service-patch-*
```

**接口路径 = `<微服务名>/<模块编码>/<方法>`**，例：`POST /pms/D11M16B1/getPageList`、`POST /utils/D96M03B1/getPageList`。拿到接口路径即可反推前后端位置。

---

## 5. 环境与构建

> 版本信息转录自根 `CLAUDE.md`（其标注为 2026-09 实测），本次未逐项复验。

| 工具 | 版本/位置 |
|---|---|
| Node | v18.20.8（Volta 管理） |
| npm | 9.9.4（**Vue2 专用**） |
| pnpm | 10.28.2（**Vue3 专用**） |
| JDK | 1.8.0_301（`D:\jdk1.8`） |
| Maven | 3.8.3（`D:\0-caoshi\apache-maven-3.8.3`，已在 PATH） |
| Flutter | `D:\flutter` |
| .NET | 已装（`oemGrfPrinter` 为 .NET 8） |

### 5.1 包管理器规则（强制）

| 技术栈 | 目录 | 包管理器 | 锁文件 |
|---|---|---|---|
| Vue 3 | `web3\**` | **pnpm** | `pnpm-lock.yaml` |
| Vue 2 | `mf-vue2\**`、`web2\**` | **npm** | `package-lock.json` |
| 聚合脚本 | `mf-mg\**` | npm | 仅跑 `node init.js` / `build.js` |

统一不用 yarn。**判断归属先看现有锁文件**，跨装会生成第二份锁文件导致依赖树与 CI 不一致。

已知越界（2026-09-16 实测）：

| 项目 | 应在 | 却多出 |
|---|---|---|
| `web3/mf-stdweb-wpt` | pnpm | `package-lock.json` |
| `mf-vue2/mfomsweb/mf-stdweb-eam` | npm | `pnpm-lock.yaml` |
| `mf-vue2/mfomsweb/mf-stdweb-manu` | npm | `pnpm-lock.yaml` |
| `mf-vue2/mfomsweb/mf-stdweb-sale` | npm | `pnpm-lock.yaml` |

### 5.2 构建命令

```bash
# Vue2 微应用（webpack4 / vue-cli-service）—— npm
cd 0-Web_Code/mf-vue2/mfomsweb/mf-stdweb-pms
npm run dev          # 本地起服务
npm run build:prod   # 生产构建

# Vue3 项目（Vite）—— pnpm
cd 0-Web_Code/web3/mf-omsweb
pnpm dev
pnpm build:prod

# 后端
cd 0-SvcCode/OMS/inks-service-pms-master
mvn clean package -DskipTests
```

- Node 17+ 若报 `digital envelope routines::unsupported`，加 `NODE_OPTIONS=--openssl-legacy-provider`（**npm scripts 已自带 `--max_old_space_size`，内存参数勿动**）。
- 微前端聚合：`mf-mg\mg-*` 先 `node init.js` 再 `node build.js`。

---

## 6. 高频陷阱（照抄踩过的坑）

1. **根目录 `D:\0-caoshi` 本身是一个 Git 仓库**（remote `AgentForge.git`，只跟踪 AI 配置与文档），各子项目各自独立 Git（内网 `git.inksdev.com`）。改业务代码须 `cd` 进具体仓库，根目录下的 `/review`、diff 类流程只对根仓库自身有效。
2. **`mf-mg\mg-*` 子目录常为空**（submodule 未初始化），别在那找业务代码。
3. **`web2\0-wkspace\` 不是临时目录**，内含活跃仓库，勿当垃圾清理。
4. **后端改动必须重新编译部署才生效**。排查问题时先确认跑的不是旧包——报文/接口与当前代码对不上，多半是这个问题。
5. **`inks-service-utils-master` 顶层 9 个 `inksgrf-server-*` 是打印服务运行目录**，容易误认为垃圾。
6. **域码目录跨微应用重复**，找页面前先判断该编码属于哪个主域。
7. **包管理器不要混用**：Vue3（`web3/**`）用 pnpm，Vue2（`mf-vue2/**`、`web2/**`）用 npm。判断归属先看现有锁文件，跨装会生成第二份锁文件。详见 §5.1。
8. `.ignore`（ripgrep 忽略规则）已配置忽略 `node_modules/`、`target/`、`dist/`、`.nuxt/`，**新增忽略项请改这个文件**。

---

## 7. 快速定位 Checklist

拿到一个需求，按这个顺序走：

1. 确定**模块编码**（需求单/原型图一般会写，如 `D11M16B1`）→ 没写就用功能名在 `0-Web_Code/mf-vue2/mfomsweb/mf-stdweb-*/src/views/modules/**` 下搜。
2. 按 §0 速查表找到**前端微应用 + 后端服务**。
3. 前端：`<微应用>/src/views/modules/<域码>/<模块编码>/index.vue`。
4. 后端：`<服务>/inks-service-std-<领域>/src/main/java/.../controller/<模块编码>Controller.java`。
5. 需要表结构/需求背景 → 看该后端仓库的 `doc/` 目录（开发文档 + 原型 html + 建表 SQL 都在）。

---

*本文档由实测扫描生成，如发现与现状不符，请直接修正本文件。*
