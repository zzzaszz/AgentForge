# 文件上传 / 预览 / 下载

> 触发：写或改附件上传、图片/PDF/Excel/Word 预览、下载按钮、字段级单文件关联附件时读本文件。
> 来源：原 `~/.claude/CLAUDE.md` 第 11、13 条，2026-09-16 迁移。
> 关键：**两套存储不要混**——Minio 模块走 `/utils/File/proxy` + `sec=token`；`Uts_Attachment`/`Pms_DocFile` 桶走 `/utils/fas/proxy/{path}?bucket=`。

---

## 1. Minio 模式（参考 D11M02B4，勿用 /utils/fas/proxy）（原第 11 条）

- **上传**：`POST /utils/File/upload`（FormData 带 `file` + `module` + `dir`），返回 `{ dirname, filename, fileoriname, filesize, filesuffix, bucketname, storage, fileurl, contenttype }`；业务表存 `filepath = ${dirname}/${filename}`、`fasurl = fileurl`。
- **预览/下载**：`GET /utils/File/proxy/{filepath}?sec=${token}`；`request.get(url, { responseType: "blob" })` 拿 blob 后——图片用 `ElImageViewer`、PDF 用 iframe 对话框、其他下载用 `a.download`（参考 D11M16B1 附件预览）。
- **坑①**：`/utils/fas/proxy/{filepath}?bucket=` 会 404，勿用。
- **坑②**：token 必须用 `getToken()`（`@/utils/auth` 读 Cookies）；`$store.getters.token` 在部分页面返回 undefined，导致 `sec=undefined`。
- **坑③**：旧数据 fasurl 可能是 `/api/files/{bucket}/{object}` 直链，需用正则 `/\/api\/files\/[^/]+\/(.+)$/` 提取 object 路径再走 `/utils/File/proxy`，勿直连。
- **坑④**：上传接口有 `@NoRepeatSubmit` 频率限制（报"操作频率过高"）：多文件须串行逐个上传并间隔（如 800ms），遇限制等待（如 2s）重试一次；上传中加 loading。
- **坑⑤**：Word(docx) 在线预览——优先用 OnlyOffice Document Server（前端 iframe 嵌入，需后端提供 OnlyOffice 可访问的文档 URL）；前端降级方案用 JSZip 解压 `word/document.xml` 提取段落/表格渲染（样式从简）。Excel/Word 预览弹窗内容用 `v-html` 绑定 data（勿用 `$refs` 写 innerHTML，v-if 对话框内 ref 时序会白屏）。
- **坑⑥**：mammoth 在 wujie 沙箱会卡住（`convertToHtml` 的 Promise 永不 resolve，加超时仍超时）；docx-preview 0.4.0/0.3.7 用现代 ES 语法（`?.` `??`）webpack 4 无法解析，且其 package.json 仅有 exports 无 main（只能靠 transpileDependencies，勿改 vue.config.js）。
- **坑⑦**：Excel(.xls 旧格式) 预览需 `cptable.utils`（SheetJS 解析 UTF-16 字符串），webpack 打包时 xlsx 内部 `require('./dist/cpexcel.js')` 的 interop 可能使 utils 不在顶层导致报错，需显式 `require("codepage")` 并设置 `window.cptable = cptable`；读取用 FileReader（与 UploadExcel 一致），勿用 `blob.arrayBuffer()`。

## 2. 字段级"单文件"反向关联附件（参考 D11M11B1，已落地）（原第 13 条）

D11M11B1 需求变更单：原始需求描述/处理建议/处理方案 各挂一个文件；参考 `D11M11B1/components/fieldAnnex.vue` 的 slot/reset/load/commit。

- **反向关联载体**：中央附件 `POST /utils/D96M03B1/*`（表 `Uts_Attachment`）。`RelateId`=单据 id，`ModuleCode`=自由槽位标识（如 `'D11M11B1.originaldesc'`/`'suggestion'`/`'solution'`）区分同一单据不同字段的附件；`upload?relateid=&modulecode=` 一步建行。后端在 `D:\0-caoshi\0-SvcCode\OMS\inks-service-utils-master\...\UtsAttachment*`。
- **读某槽位**：`POST /utils/D96M03B1/getPageList`，body `{ PageNum,PageSize,OrderType:1,OrderBy:'CreateDate',SearchType:0, SearchPojo:{ relateid, modulecode:'模块.字段' } }`，取 `data.list[0]`（SearchType 0=AND；该接口无本人/公共可见性限制，限制只在 getList）。删除 `GET /utils/D96M03B1/delete?key=<row.id>`。
- **"先选后存、取消不落库"**：子控件只把所选 File 存本地 pending，主表单 create/update 成功拿到 id 后再 `commit(billId)` 逐个 upload（新文件成功后删旧行，保证槽位始终单文件）/按标记删；删除/更换按钮只标记、不即时请求，避免取消表单已改库。
- **预览/下载坑**（2026-09 实测；勿照抄 `@/components/Annex` 的 `row.fileurl+'?sec='`，会预览/下载报错）：
  ① **取址**：对象路径 = `row.filepath` 或 `row.dirname+'/'+row.filename`；URL=`/utils/fas/proxy/{path}?bucket={row.bucketname||'omsdata'}[&preview=1]`。此 `/utils/fas/proxy` 对 D96/Uts_Attachment 与 D11M21B1(Pms_DocFile) 桶可用——与第 1 节的 Minio 模块(`/utils/File/proxy` + `sec=token`)是两种存储，按模块实际存储选，勿一刀切把 fas 全盘否掉。
  ② **预览**：`request.get(url,{responseType:'blob'})` 拿 blob 后——图片 `ElImageViewer`、pdf/html/文本 iframe(blobUrl)、xls/xlsx 用 XLSX + `require("codepage")` 设 `window.cptable` 解析成 v-html 弹窗渲染（FileReader 读，勿 `blob.arrayBuffer()`）；Word/PPT 不支持预览仅下载。
  ③ **下载**：勿用 `<a href 直链>`（会直接跳转打开页面而非下载）→ 必须 blob → objectURL → `<a download="文件名">` click。
