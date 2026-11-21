# Vue2 微应用 Edit 页面表头 / 表尾规范

适用：`0-Web_Code/mf-vue2/**` 下各微应用的编辑页，结构为
`components/formEdit.vue` + `components/formTemp/editHeader.vue` + `components/formTemp/index.js`（footer）。

参考实现：**D91M01B1（货品档案，mf-stdweb-goods）为布局与间距基准**（2026-11-21 确认）；表头 + footer 的早期落地可看 D06M20B1（变更控制 ECN）。

## 1. 表头栅格

- `label-width: 100px`；**标签不加页面级覆盖**（不写 `font-size/font-weight` 去覆盖默认 14px；全局已有 `label { font-weight: 700 }`，各微应用一致）。
- **第一行最多 3 个 `<el-col :span="5">`**。页面右上角叠着 `BillState` + `BillStatusBar`，第一行放 4 个会遮挡状态栏和单据编号。
- **第二行起每行最多 4 个 `<el-col :span="5">`**。
- 所有行统一 `span=5`，不要和 `span=6/9/12` 混排，否则右侧边界参差、行高不一致。**checkbox 列也用 span5**，不用 span3 窄列（2026-11-21 确认，D06M12/M13/M19/M22 实改）。例外只有三种：textarea / checkbox-group 等长内容行用 `span="24"` 全宽；页脚 foot 行用 `col: 4`；带响应式 `xs/sm/md` 的混排列改 span5 时**连同响应式属性一起删**（标准页均为纯 span5）。
- 内容较长的字段同样用单行 `el-input` + `size="small"`；确需多行才用 textarea，但要接受该行高度被拉高。
- **分组标题用 el-divider 带文字**（2026-11-21 确认，基准 D91M01B1）：`<el-divider content-position="left">分组名</el-divider>`，divider 用默认间距（theme-chalk `margin: 24px 0`），**不加页面级 margin 覆盖**。自绘 `.form-section-title` div 写法**已废弃**（仅存量旧页面还有，坑见 §11）。
- **标题行不用蓝色字体**（2026-11-21 确认）：页面标题 `formTitle` 沿用全局灰（common.scss `#555`），分组标题走 el-divider 默认样式，不用 `#409eff`。

```vue
<el-form
  ref="formdata"
  :model="formdata"
  :label-width="'100px'"
  class="custInfo"
  :rules="formRules"
>
  <p class="formTitle">{{ title }}</p>
  <el-divider content-position="left">基本信息</el-divider>
  <el-row>
    <!-- 第一行：最多 3 个 span5 -->
    <el-col :span="5"> ... </el-col>
    <el-col :span="5"> ... </el-col>
    <el-col :span="5"> ... </el-col>
  </el-row>
  <el-divider content-position="left">变更内容</el-divider>
  <el-row>
    <!-- 第二行起：最多 4 个 span5 -->
    <el-col :span="5"> ... </el-col>
    <el-col :span="5"> ... </el-col>
    <el-col :span="5"> ... </el-col>
    <el-col :span="5"> ... </el-col>
  </el-row>
</el-form>
```

```scss
<style lang="scss" scoped>
/* 表头唯一的样式：行负边距。标签、分组标题均不加私有覆盖（对齐 D91M01B1） */
::v-deep.custInfo .el-row {
  margin-bottom: -20px;
  display: flex;
  flex-wrap: wrap;
}
</style>
```

## 2. 表头不重复显示的字段

- **单据日期 `billdate`**：右上角 `BillStatusBar` 已显示日期，表头不再放输入控件（数据字段保留、初始值仍为今天）。
- **单据编号 `refno`**：`BillState :show-ref-no="true"` 已显示，表头不放。

判断依据：formEdit 顶部已有

```vue
<BillState :formdata="formdata" :show-ref-no="true" ...>
  <template #statusBar>
    <BillStatusBar size="large" :config="statusBarConfig" />
  </template>
</BillState>
```

## 3. 日期字段默认今天

新建单据时，`formdata` 初始值里所有日期字段用 `new Date()`：

```js
billdate: new Date(),
implementdate: new Date(),
effectivedate: new Date(),
approvedate: new Date(),
```

加载已有单据时以 `getBillEntity` 返回值为准；返回的日期字段为 `null`/空串时，在 `bindData` 里补 `new Date()`（用 `$set` 保证响应式），避免历史单据日期显示为空：

```js
var todayFields = ['billdate', 'implementdate', 'effectivedate', 'approvedate']
todayFields.forEach((field) => {
  if (!this.formdata[field]) {
    this.$set(this.formdata, field, new Date())
  }
})
```

## 4. footer（formTemp/index.js）

表尾用于放**经办人（一般用字典）、备注 / 摘要、创建人、审核人相关信息**，不放主业务字段。

- **页脚第一条放 divider 分隔线**（2026-11-21 确认）：`type: 'divider', label: '', center: ''`，用于隔开主表与页脚。**备注 / 摘要属于 foot 区块**，放分隔线之后、foot 行之前——分隔线在备注上方，不在备注与 foot 行之间。
- 备注 / 摘要：`type: 'input'`，`col: 22`（2026-11-21 对齐 D91M01B1 摘要列宽）。
- 经办人：`type: 'dictionary'` + `billcode`（走 SYS 字典）。
- 创建人 / 创建日期 / 制表 / 修改日期 / 审核 / 审核日期：`type: 'foot'` 行，`type: 'text'`。
- **页脚样式不加任何页面级覆盖**（2026-11-21 确认，基准 D91M01B1）：divider 用默认 `margin: 24px 0`；foot 标签用 footer.vue 默认 100px 宽，值 span 走全局 common.scss 的 `min-width: 140px` 左对齐。**此前记录的「divider `margin: 12px 0 8px` + 标签 `width: auto; padding-right: 10px`」已废弃**——各微应用的 footer.vue、FormTemp/index.vue、common.scss、全局 `label{font-weight:700}` 逐字相同，页脚观感差异全部来自页面私有覆盖，对齐方式是**删覆盖**，不是加覆盖。

```js
footer: {
  type: 1,
  content: [
    { type: 'divider', label: '', center: '' },
    {
      rowitem: [
        { col: 22, code: 'remark', label: '备注', type: 'input', methods: '', param: '' }
      ]
    },
    {
      type: 'foot',
      rowitem: [
        { col: 4, code: 'createby', label: '创建人', type: 'text' },
        { col: 4, code: 'createdate', label: '创建日期', type: 'text' },
        { col: 4, code: 'lister', label: '制表', type: 'text' },
        { col: 4, code: 'modifydate', label: '修改日期', type: 'text' },
        { col: 4, code: 'assessor', label: '审核', type: 'text' },
        { col: 4, code: 'assessdate', label: '审核日期', type: 'text' }
      ]
    }
  ]
}
```

注意：

- footer 字段同样通过 `formdata[code]` 绑定，新增字段要同步在 `formEdit.vue` 的 `formdata` 初始值里声明，否则不是响应式。
- 数据库 `CiFormCustom` 若存在该 `FrmCode` 的 `FrmContent` 配置，会覆盖 `formTemp/index.js`；改本地 index.js 前先确认库里没有配置（D06M20B1 实测无配置）。
- `BillState` 里的 `finished/revoke/approve/approving` 依赖 `formdata` 的主子表字段，表头改字段时不要顺手删这些依赖字段。

## 5. 表格内容默认居中

- 编辑页子表（`formTemp/editItem.vue` 的 `initTable`）与列表页（`components/tableTh.vue` 的 `initTable`）生成的列统一 `align: 'center'`。
- 不要用 `item.aligntype ? item.aligntype : 'center'`：列元数据（SYSM07B6）或用户列设置里的 `aligntype` 一旦是 `left`，内容就会左对齐，与页面规范不一致。
- `vue-easytable` 的 `align` 同时作用于表头与单元格内容，无需 `headerAlign`（该库不支持该属性）。
- 序号列、复选框列本来就固定 `align: 'center'`，保持一致即可。

```js
// initTable 内
var obj = {
  field: item.itemcode,
  key: item.itemcode,
  title: item.itemname,
  width: !isNaN(item.minwidth) ? Number(item.minwidth) : item.minwidth,
  align: 'center', // 内容默认居中
  // ...
}
```

### 枚举字段用下拉

editItem 子表的固定枚举字段（变更类别 `itemtype`、影响程度 `impact`、明细状态 `itemstatus` 等）不用文本输入，统一用 `ve-table-and-list.md` 第 7 节的**透明覆盖层下拉**：

- 列配置 `edit: false`（不参与 ve-table 双击编辑）、`ellipsis: false`（内嵌控件不能开 overflow，见该文档第 8 节）
- 选项数组与后端实体注释保持一致（如 `itemtype: material/process/doc/standard/other`、`impact: high/mid/low`、`itemstatus: pending/done/verified`）
- 显示层用响应式组件按 value 映射中文 label，下拉值变化时单元格自行刷新，不要 `keynum += 1` 重建整表
- 结构与 `renderOverlayCell` 写法直接照抄该文档第 7 节

## 6. operate.js 操作栏约定

`components/formTemp/operate.js` 的 `operateBar` 只放**业务操作**：

- **不放打印、审核**：这两项已由 formEdit 外层的 `EditGroupBtns` 提供，`@approval="approval"`、`@printButton="$refs.PrintServer.printButton(0, 1)"` 已在组件上绑定，重复配置会出现两个入口。
- **删除通常放这里**，依赖 `formstate` 控制可用状态。
- **中止/作废/恢复/开启** 统一用「中止单据...」父项 + `children` 四项，`methods` 都是 `discontinue`，`param` 分别为 1 作废 / 2 恢复 / 3 中止 / 4 开启（对应 `formEdit.vue` 的 `discontinue(type)`）。

```js
export const operateBar = [
  {
    show: 1,
    divided: false,
    label: "删 除",
    icon: "el-icon-delete",
    disabled: "this.formstate!=1",
    methods: "deleteForm",
    param: "",
    children: [],
  },
  {
    show: 1,
    divided: true,
    label: "中止单据...",
    icon: "",
    methods: "",
    param: "",
    children: [
      { show: 1, divided: false, label: "作废", icon: "zuofei", methods: "discontinue", param: 1, children: [] },
      { show: 1, divided: false, label: "恢复", icon: "huifu", methods: "discontinue", param: 2, children: [] },
      { show: 1, divided: true, label: "中止", icon: "zhongzhi", methods: "discontinue", param: 3, children: [] },
      { show: 1, divided: false, label: "开启", icon: "kaiqi", methods: "discontinue", param: 4, children: [] },
    ],
  },
];
export const processBar = [];
```

外层 `EditGroupBtns`（不需要在 operate.js 重复配置的项）：

```vue
<EditGroupBtns
  ref="EditGroupBtns"
  :formdata="formdata"
  :operate-bar="operateBar"
  :process-bar="processBar"
  :formstate="formstate"
  :submitting="submitting"
  @submitForm="submitForm"
  @approval="approval"
  @closeForm="closeForm"
  @printButton="$refs.PrintServer.printButton(0, 1)"
  @clickMethods="clickMethods"
/>
```

## 7. 审核 / 反审核

- 外层 `EditGroupBtns` 的审核按钮文字由 `formdata.assessor` 自动切换（有值显示「反审核」，无值显示「审核」），**不需要**在 `operate.js` 里再配一项。
- 审核后页面只读：表头所有控件 `:disabled="!!formdata.assessor"`；子表通过 `formstate == 2` 置 `isEditOk = false`；`saveForm` 再兜底拦截一次。footer 字段可在 `formTemp/index.js` 配 `disabled: '!!this.formdata.approver'`（该字符串由 footer.vue `returnEval` 执行）。
- 后端 `approval` 必须真正落库（参考 `QmsFaiRecController`）：审批时写审核人/审核人id/审核日期，反审核时清空，同步把单据状态置为 `approved` / `draft`，并校准状态栏；不能只 `return getEntity()`。
- **字段名要对齐**：平台通用字段是 `Assessor/Assessorid/AssessDate`，但部分定制表用 `Approver/Approverid/ApproveDate`（如 Qms_Ecn）。前端判断统一用 `assessor` 时，在加载/保存/审核成功后做别名：`$set(formdata, 'assessor', formdata.approver || '')`，否则按钮不切换、页面不加锁。

## 8. 日期字段格式化

日期字段不能直接输出原值，列表和编辑页都要格式化：

**列表**（`components/tableTh.vue` 的 `renderBodyCell`）：日期列统一走 `dateFormat` 过滤器，可按需追加字段。

```js
if (
  item.itemcode == 'createdate' ||
  item.itemcode == 'effectivedate' ||
  item.itemcode == 'implementdate' ||
  item.itemcode == 'approvedate' ||
  item.itemcode == 'billdate' ||
  item.itemcode == 'modifydate'
) {
  return this.$options.filters.dateFormat(row[item.itemcode])
}
```

- `dateFormat` → `yyyy-MM-dd`；需要时分秒用 `dateFormats`（过滤器在 `src/utils/filter.js`，两者都用 `new Date(value)`，时间戳/ISO/`yyyy-MM-dd HH:mm:ss` 都能解析）。

**编辑页**：加载、保存成功、审核/反审核成功后统一格式化，保证与 `el-date-picker` 的 `value-format="yyyy-MM-dd"` 一致；为空的可编辑日期补今天，`createdate/modifydate` 只格式化不补默认。

```js
normalizeDateFields() {
  var editableFields = ['billdate', 'implementdate', 'effectivedate', 'approvedate']
  editableFields.forEach((field) => {
    this.$set(this.formdata, field,
      this.$options.filters.dateFormat(this.formdata[field] || new Date()))
  })
  var readFields = ['createdate', 'modifydate']
  readFields.forEach((field) => {
    if (this.formdata[field]) {
      this.$set(this.formdata, field,
        this.$options.filters.dateFormat(this.formdata[field]))
    }
  })
}
```

- 调用点：`bindData` 拿到 `getBillEntity` 结果后、`create/update` 成功后、`CRUD.approval` 成功后（`that.normalizeDateFields && that.normalizeDateFields()`）。
- 不格式化的后果：后端 Date 以时间戳/ISO 串返回时，日期控件可能显示空白或原串，列表则直接显示 `2026-11-10T08:00:00.000Z`。

## 9. 列表与编辑页字段口径一致

列表（tableTh / list）显示的字段含义必须与 edit 页一致，枚举字段不能把原始 code 直接显示出来：

- **下拉字段**：显示 edit 页下拉选项的中文 label。例：`changetype` → 设计变更 / 工艺变更 / 材料变更 / 其他。
- **状态字段**：用 `el-tag` 展示，label 与 edit 页状态下拉完全一致；颜色按语义映射。
- **是否审核**：用 `el-tag`，已审核显示审核人（success），未审核显示「未审核」（info）。
- 日期字段按第 8 节格式化。

```js
// renderBodyCell 内追加分支
} else if (item.itemcode == 'changetype') {
  var changetypeMap = {
    design: '设计变更', process: '工艺变更', material: '材料变更', other: '其他'
  }
  return changetypeMap[row[item.itemcode]] || row[item.itemcode]
} else if (item.itemcode == 'status') {
  return this.renderStatusTag(row[item.itemcode])
} else if (item.itemcode == 'approver') {
  return row[item.itemcode]
    ? <el-tag size='mini' type='success'>{row[item.itemcode]}</el-tag>
    : <el-tag size='mini' type='info'>未审核</el-tag>
}
```

```js
// 单据状态标签，label 与 edit 下拉保持一致
renderStatusTag(val) {
  var map = {
    draft: { label: '草稿', type: 'info' },
    'under-review': { label: '审批中', type: 'warning' },
    approved: { label: '已批准', type: 'success' },
    implementing: { label: '实施中', type: '' },
    fai: { label: '首件验证', type: 'warning' },
    effective: { label: '已生效', type: 'success' },
    closed: { label: '已关闭', type: 'info' },
    rejected: { label: '已驳回', type: 'danger' },
    canceled: { label: '已取消', type: 'danger' }
  }
  var cfg = map[val] || { label: val || '-', type: 'info' }
  return <el-tag size='mini' type={cfg.type}>{cfg.label}</el-tag>
}
```

- `el-tag` 的 `type` 只有 `success / info / warning / danger`，其余传空串用默认蓝色。
- 新增/修改 edit 页下拉选项时，同步更新列表的 label 映射与状态 tag 映射，两边口径一起改。

## 10. 排查口径

表头/页脚样式不对时先看四处：`editHeader.vue` 的 span 组合、`formEdit.vue` 的 `.el-form-item { min-width: 180px }`、`formTemp/index.js` 的 footer 配置、页面里是否残留对标签/divider 的私有覆盖（标准是不加任何覆盖，见 §1/§4；`el-form` 多了 `size` 的行距问题见 §11）。

## 11. 行距坑：el-form 的 size 与 .el-row 负边距叠加（D06M17B2 实测）

> 2026-11-21 起分组标题标准已改为 `el-divider content-position="left"`（见 §1），divider 默认 `margin: 24px 0` 大于行负边距 20px，新页面天然规避本坑。本节保留，用于维护仍存在 `.form-section-title` 的存量旧页面（D06M15B1/17B2/17B3/20B1 等）。

**现象**：照旧版 §1 样式（自绘 `.form-section-title`）写完表头后，各行控件之间、控件与分组标题几乎贴在一起，行距接近 0。

**根因（两个因素叠加）**：

1. `<el-form>` 上加 `size="small"` 会让 Element UI 给表单项挂 `.el-form-item--small`，下边距由 22px 变 **18px**（theme-chalk：`.el-form-item--mini.el-form-item,.el-form-item--small.el-form-item{margin-bottom:18px}`）。而标准样式 `::v-deep.custInfo .el-row { margin-bottom: -20px }` 是按默认 22px 设计的抵消量：18 - 20 = **-2px**，行与行相互重叠。
2. 分组标题夹在两个 `el-row` 之间，其上 margin 与上一行的 -20px 负 margin 折叠（6 + (-20) = -14px），标题被拽进上一行控件区域。§1 示例里的 `margin: 6px 0` 只在**没有**负 margin 干扰时成立。

**实测数据**（D06M17B2，离线对照页 + Playwright 量 `getBoundingClientRect`）：

| 版本 | 输入框底 → 标题顶 | 标题底 → 下一行输入框顶 |
|---|---|---|
| 问题版：form `size="small"` + 标题 `margin: 6px 0` | 4px | 7px |
| 修复版：form 不传 size + 标题 `margin: 24px 0 12px` | 30px | 17px |

**标准写法**：

- **el-form 不设 size**，`size="small"` 加在每个控件上（D06M17B1 / D06M17B2 均如此）。控件外观不变（input 高度仍 32px），只让表单项 margin 回到 22px，与 -20px 负 margin 正确抵消。
- 有分组标题时，标题 margin 用 `24px 0 12px` 补回被负 margin 吃掉的上间距；不要照抄 §1 的 `6px 0`。
- 若确需保留 el-form 的 `size="small"`，则行负 margin 同步改 `-16px` 并重新实测标题间距——**两处只能一起改，改一处必贴**。

```scss
/* 有分组标题的表头：标题上间距必须大于行负 margin 的绝对值 */
.form-section-title {
  padding: 4px 0;
  margin: 24px 0 12px;
}
```

**动手前检查**：

- [ ] 复制 §1 表头模板时，确认没给 `el-form` 顺手加 `size`
- [ ] 新增/调整分组标题后实测两段间隙（输入框底 → 标题顶应 ≥ 20px），不凭肉眼判断
- [ ] 无登录态时的实测办法：用项目 `node_modules` 里的 `vue/dist/vue.min.js` + `element-ui/lib/index.js` + `theme-chalk/index.css` 搭离线对照页（问题版/修复版同页渲染），起仅绑定 `127.0.0.1` 的静态服务后用 Playwright 量矩形差；playwright MCP 禁 `file://` 协议，必须走 http
