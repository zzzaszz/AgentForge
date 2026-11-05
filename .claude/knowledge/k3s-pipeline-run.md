# k3s 流水线运行手册（KubeSphere packages & deploy to dev）

> 用途：用户说「帮我打包 XX」时，按本文直接执行，不用重新摸索。
> 目标集群：`http://192.168.99.61:30880`（KubeSphere 控制台；后端 ks-apiserver `v3.4.1`，前端静态资源 `v3.3.2`，Kubernetes `v1.26.5`）。
> 手册建立：2026-11-05，全部结论来自本机实测。

---

## 0. 铁律（用户 2026-11-05 明确确认）

**只允许运行流水线，其他任何集群写操作一律禁止。**

| | 内容 |
|---|---|
| 允许 | 登录换 token、列 DevOps 项目、列流水线、查流水线详情、**触发运行**、查运行状态、查构建结果、只读查部署结果（Deployment/Service/Pod） |
| 禁止 | 修改/删除流水线定义、改 Jenkinsfile 或 `deploy-*.yaml`、`kubectl apply/delete/patch`、删除 PipelineRun、改用户或权限、停止他人构建、改 ConfigMap/Secret、扩容缩容等一切其它写操作 |
| 唯一写操作 | 创建 `PipelineRun` 资源 —— 这是「运行流水线」在这套集群上的等价写法（见 §4），不算越界；但**只允许创建，不允许删除** |

- 凭据只从根目录 `k3s-流水线凭据.md` 读取；**禁止回显密码、禁止写进其它文件/脚本常量/持久化环境变量、禁止提交 Git**；token 只在单次运行内存里。
- 触发前必须先回报五项，得到确认再发：**项目 / 流水线真实名 / 分支 / 影响范围（是否走部署段、目标 namespace）/ 预计镜像 tag**。
- 跑流水线 = 打包 **+ 自动部署到 dev**。不得对用户说成"只是打个包"。

---

## 1. 环境事实

### DevOps 项目（workspace `inkstech`）

| 显示名（别名） | 实际 namespace | 流水线数 |
|---|---|---|
| devsvc（后端打包） | `devsvc4wgc2` | 117（`inks-*`、`svc-*`、`svc-sa-*`、`flt-*`） |
| mfdevweb（微前端） | `mfdevwebwsp7l` | 45（`mf-stdweb-*`、`mf-cusweb-*`、`mg-*`、`mf-patchweb-*`） |
| mfdevweb3（微前端vue3） | `mfdevweb3nh77g` | 17（`mf-omsweb`、`mf-omspad`、`mf-mesweb`、`mfp-*`、`mf-stdpad-*`） |
| devweb（web打包） | `devwebkpxq9` | 37（`ui-*` 老版 Vue2） |

全量清单（216 条，项目/namespace/流水线名三列）：根目录 `k3s-pipelines.csv`。
KubeSphere 会给 DevOps 项目名追加 5 位随机后缀（如 `devsvc` → `devsvc4wgc2`），**API 里必须用带后缀的全名**。

### 账号与权限

- 凭据文件里的账号是普通用户（实测身份 `inks003`），属于 workspace `inkstech`：**能列 DevOps 项目与其下流水线、能触发、能查**；但没有集群管理权限（`/api/v1/namespaces`、`users/admin` 等 403）。
- `/api/v1/nodes` 可读（能看到 `k8s6-master` 等 8 个节点）。
- Jenkins 直连 `http://192.168.99.61:30180` 不可用：带 KubeSphere token 也返回匿名（`whoAmI` 显示 `anonymous`），`/api/json` 403。**不要走 Jenkins 直连。**

---

## 2. 认证：明文密码不行，必须复刻前端加密

KubeSphere 3.4 的 `POST /login` 只认 `username` + `encrypt`（**没有 password 字段**）。明文密码会得到 `{"status":400,"reason":"Invalid Login Params"}`。

`encryptKey` 从控制台首页 HTML 的 `window.globals.config.encryptKey` 取（本集群值为 `kubesphere`）。加密算法（从 console bundle 逆向，函数签名 `encrypt(key, password)`）：

1. `t = base64(password)`（UTF-8）
2. 若 `t` 比 `key` 长，用 `t` 的前缀把 `key` 补齐到 `t` 的长度
3. 逐字符：`i = t.charCodeAt(o)`（越界取 64），`l = 补齐key.charCodeAt(o) + i`
4. 得到两个等长序列：`bits`（`l` 为偶数取 `"0"`，否则 `"1"`）、`chars`（`l / 2` 下取整当字符）
5. 返回 `base64(bits) + "@" + chars`

**成功返回 `302` + `Set-Cookie: token=<JWT>`**（不是 JSON）。后续所有请求必须用 `Authorization: Bearer <token>`；**用 `Cookie: token=` 会被当成 `system:anonymous` 返回 403**。

PowerShell 实现（本机验证可用，凭据从 md 读，不回显）：

```powershell
$f = Get-ChildItem "D:\0-caoshi\k3s-*.md" | Select-Object -First 1
$md = Get-Content $f.FullName -Raw -Encoding UTF8
function Val([string]$k){ if($md -match "(?m)^\s*$k\s*=\s*(.*?)\s*$"){ return $Matches[1] } return '' }
$base=(Val 'KS_URL').TrimEnd('/'); $u=Val 'KS_USER'; $p=Val 'KS_PASSWORD'

$t=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($p))
$e='kubesphere'; if($t.Length -gt $e.Length){ $e += $t.Substring(0, $t.Length - $e.Length) }
$sb=New-Object Text.StringBuilder; $ss=New-Object Text.StringBuilder
for($o=0;$o -lt $e.Length;$o++){
  $i = if($o -lt $t.Length){ [int]$t[$o] } else { 64 }
  $l = [int]$e[$o] + $i
  if($l % 2 -eq 0){ [void]$sb.Append('0') } else { [void]$sb.Append('1') }
  [void]$ss.Append([char]([int][Math]::Floor($l/2)))   # 必须 [char]([int]...) 双重转换
}
$enc=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($sb.ToString())) + "@" + $ss.ToString()

$r=Invoke-WebRequest -Uri "$base/login" -Method Post -ContentType 'application/x-www-form-urlencoded' `
  -Body "username=$([uri]::EscapeDataString($u))&encrypt=$([uri]::EscapeDataString($enc))" `
  -UseBasicParsing -TimeoutSec 20 -MaximumRedirection 0 -ErrorAction SilentlyContinue
$ck=($r.Headers['Set-Cookie'] -join ';'); if($ck -match 'token=([^;]+)'){ $tok=$Matches[1] } else { throw '登录失败' }
$h=@{Authorization="Bearer $tok"}
```

注意：`[char][Math]::Floor($l/2)` 会抛「无法将值转换为 System.Char」，必须先 `[int]`。

---

## 3. 实测可用的 API 路径

| 用途 | 方法与路径 | 结果 |
|---|---|---|
| 列 workspace | `GET /kapis/tenant.kubesphere.io/v1alpha2/workspaces` | 200，返回 `inkstech` |
| 列 DevOps 项目 | `GET /kapis/tenant.kubesphere.io/v1alpha2/workspaces/inkstech/devops` | 200，4 条 |
| 列流水线 | `GET /apis/devops.kubesphere.io/v1alpha3/namespaces/{ns}/pipelines` | 200 |
| 流水线详情 | `GET /apis/devops.kubesphere.io/v1alpha3/namespaces/{ns}/pipelines/{name}` | 200（含 `metadata.annotations["pipeline.devops.kubesphere.io/jenkinsfile"]`、`spec.pipeline.jenkinsfile`、参数） |
| 列运行记录 | `GET /apis/devops.kubesphere.io/v1alpha3/namespaces/{ns}/pipelineruns` | 200 |
| 单次运行详情 | `GET /apis/devops.kubesphere.io/v1alpha3/namespaces/{ns}/pipelineruns/{runName}` | 200 |
| **触发运行** | `POST /apis/devops.kubesphere.io/v1alpha3/namespaces/{ns}/pipelineruns` | **201**（见 §4） |
| 查 Deployment | `GET /apis/apps/v1/namespaces/{ns}/deployments/{name}` | 200（dev 在 `inksdev-mf`） |
| 查 Service | `GET /api/v1/namespaces/{ns}/services/{name}` | 200 |

**这些是死路，别再试**：

- `POST /kapis/devops.kubesphere.io/v1alpha3/namespaces/{ns}/pipelines/{name}/run` → 404 `Page Not Found`（控制台按钮背后的接口，本集群未注册；`OPTIONS` 返回 405 是假信号，不代表路由可用）。
- `/kapis/devops.kubesphere.io/v1alpha3/clusters/host/namespaces/...` → 403，报 `User "inks003" cannot get resource "clusters/namespaces"`。
- `/oauth/token`、`/oauth/authorize`、`GET /login` → 一律返回 `index.html`（nginx 只把 `/kapis`、`/apis`、`POST /login` 转给 ks-apiserver）。
- 30180 Jenkins 的任何接口（403 / 匿名）。

---

## 4. 触发一次打包（标准四步）

### 4.1 先看流水线详情，确认 stage / 参数 / 仓库 / 分支

取 `spec.pipeline.jenkinsfile`，用正则抽 `stage\('([^']+)'\)`、`url: '...'`、`branch: '...'`、`sh '...'`。参数从 `metadata.annotations["pipeline.devops.kubesphere.io/jenkins-metadata"]` 的 `parameters` 取（绝大多数只有 `TAG_NAME`，string，留空）。

### 4.2 先用 `?dryRun=All` 校验权限与结构（不会真的创建）

```powershell
$ns='mfdevweb3nh77g'; $n='mf-omspad'
$pp=Invoke-RestMethod -Uri "$base/apis/devops.kubesphere.io/v1alpha3/namespaces/$ns/pipelines/$n" -Headers $h -TimeoutSec 20
$sfx = -join ((97..122)+(48..57) | Get-Random -Count 5 | ForEach-Object { [char]$_ })
$rname = "$n-$sfx"
$bodyObj = @{
  apiVersion='devops.kubesphere.io/v1alpha3'
  kind='PipelineRun'
  metadata=@{ name=$rname; namespace=$ns
    labels=@{ 'devops.kubesphere.io/pipeline'=$n }
    annotations=@{ 'devops.kubesphere.io/creator'='inks003' } }
  spec=@{ parameters=@(@{ name='TAG_NAME'; value='' })
    pipelineRef=@{ kind='Pipeline'; name=$n; namespace=$ns }
    pipelineSpec=$pp.spec }          # 直接复用流水线的 spec
}
$body=$bodyObj | ConvertTo-Json -Depth 25 -Compress
# 校验：期望 201
Invoke-WebRequest -Uri "$base/apis/devops.kubesphere.io/v1alpha3/namespaces/$ns/pipelineruns?dryRun=All" `
  -Method POST -ContentType 'application/json' -Body $body -Headers $h -UseBasicParsing -TimeoutSec 30
```

### 4.3 正式创建（去掉 `?dryRun=All`）—— 这一步就是「开始打包」

```powershell
Invoke-WebRequest -Uri "$base/apis/devops.kubesphere.io/v1alpha3/namespaces/$ns/pipelineruns" `
  -Method POST -ContentType 'application/json' -Body $body -Headers $h -UseBasicParsing -TimeoutSec 40
```

创建成功后 **Jenkins 立刻接单**：`status.phase=Running`、`status.conditions` 依次出现 `Ready=Unknown/QUEUED` → `Ready=Unknown/RUNNING`，`metadata.annotations["devops.kubesphere.io/jenkins-pipelinerun-id"]` 就是 **Jenkins 构建号**（`$BUILD_NUMBER`）。

### 4.4 轮询与收尾

```powershell
$url="$base/apis/devops.kubesphere.io/v1alpha3/namespaces/$ns/pipelineruns/$rname"
do {
  $run=Invoke-RestMethod -Uri $url -Headers $h -TimeoutSec 20
  Start-Sleep -Seconds 15
} while ($run.status.phase -in @('Running','Queued',''))
"{0} start={1} end={2}" -f $run.status.phase, $run.status.startTime, $run.status.completionTime
# 部署结果（流水线跑完后 Deployment 镜像应变成新 tag）
$d=Invoke-RestMethod -Uri "$base/apis/apps/v1/namespaces/inksdev-mf/deployments/$n" -Headers $h -TimeoutSec 15
($d.spec.template.spec.containers | ForEach-Object { $_.image })
```

单次构建实测约 **4~5 分钟**（`mf-omspad` 参考：03:04:16 → 03:08:48）。用户说不用等就**不要阻塞等待**，回报 runName + 构建号即可。

---

## 5. 已知坑

1. **镜像 tag 规则不统一**：`mg-*`/`mf-stdweb-*`/`ui-*`/`svc-*` 用 `SNAPSHOT-$BUILD_NUMBER`；**`mf-omspad` 等 pad/vue3 应用用 `vue3-$BUILD_NUMBER`**。触发前先从 `deploy-dev.yaml` 或 jenkinsfile 的 `podman tag` 确认，别猜。
2. **最后一段是部署**：`envsubst < deploy/deploy-dev.yaml | kubectl apply -f -`，rollingUpdate `maxSurge/maxUnavailable 50%`，会滚动更新 `inksdev-mf` 下的 Pod。dev 环境有人联调时会中断几十秒。
3. **流水线拉的是远端 master**（`http://192.168.99.92/...`），本机工作区改动不进包；本地有未推的改动必须先推。
4. 编译段用的是 `npm install --registry=https://registry.npmjs.org`（不是 pnpm、不是国内镜像）；node 镜像 label `nodejs18`。
5. `mf-omspad` 部署产物：namespace `inksdev-mf`，Service NodePort **32402**（80→32402），`replicas 1`，容器环境变量 `SYSTEM_CODE=inksoms`、`DEPLOY_MODEL=standalone`。
6. 回滚办法：把 Deployment 镜像改回上一个 tag（例：`vue3-20`）。**这条只作为信息提供，实际回滚要用户另行授权**（改 Deployment = 写操作，且 `kubectl` 在本机不可用，没 kubeconfig）。

---

## 6. 推送完成后询问是否打包（规则）

任何 `git push` 成功后，**主动问一句是否需要打包**，不要自行触发。对应关系按仓库决定：

| 推送的仓库 | 负责打包的 DevOps 项目 | 流水线名 |
|---|---|---|
| `0-SvcCode/**/inks-service-*`、`svc-*` | devsvc（`devsvc4wgc2`） | 与目录名一致，如 `svc-pms`、`inks-oms` |
| `0-Web_Code/mf-vue2/**/mf-stdweb-*`、`mf-cusweb-*`、`mf-patchweb-*`、`mg-*` | mfdevweb（`mfdevwebwsp7l`） | 与目录名一致，如 `mf-stdweb-pms`、`mg-stdweb-pms` |
| `0-Web_Code/web3/**` | mfdevweb3（`mfdevweb3nh77g`） | 与目录名一致，如 `mf-omsweb`、`mf-omspad` |
| `0-Web_Code/web2/**`（`ui-*`） | devweb（`devwebkpxq9`） | 与目录名一致，如 `ui-omsweb` |

询问话术示例：「已推送到 master。需要我触发 `<项目>/<流水线>` 打包吗？会打包并自动发布到 dev（namespace `inksdev-mf`），确认后我发。」

若目录名与流水线名对不上，用 `k3s-pipelines.csv` 搜，或调 §3 的列流水线接口确认，**不要猜名字**。

---

## 7. 变更记录

- 2026-11-05 建立：完成登录认证逆向、4 个项目 216 条流水线落库、`mf-omspad` 触发链路实测（PipelineRun `mf-omspad-6fu02` / Jenkins #21）。
