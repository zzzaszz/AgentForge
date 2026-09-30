# ve-table 列表页 / 列设置 / 枚举列

> 触发：写或改 mf-stdweb-* 的列表页、ve-table 列配置、虚拟滚动、弹窗表单、列设置（SetColums）、单元格内嵌下拉时读本文件。
> 来源：原 `~/.claude/CLAUDE.md` 第 2、9、10、12、14 条，2026-09-16 迁移。

---

## 1. ve-table 模板用法（原第 2 条）

生成的表格尽量使用 ve-table：

```vue
<ve-table
  ref="multipleTable"
  rowKeyFieldName="rowKeys"
  :max-height="tableHeight"
  :style="tableStyle"
  is-horizontal-resize
  :columns="columsData"
  :table-data="lst"
  border-x
  border-y
  :border-around="true"
  :columnHiddenOption="{ defaultHiddenColumnKeys: columnHidden }"
  :column-width-resize-option="{ enable: true, minWidth: 50 }"
  :checkbox-option="checkboxOption"
  :virtual-scroll-option="virtualScrollOption"
/>
```

**上面这份配置里两项都不能省，尤其 `:virtual-scroll-option`：**

- **`:virtual-scroll-option` 必须开**，它不是"行多了才需要"的性能选项。
  ve-table 的容器高度只在开启虚拟滚动时取 `max-height`，不开就取内部实测值（初始 0，靠 ResizeObserver 回填 → 0 高度量不出高度 → 自举失败）—— **结果是一行都不显示，整表空白**。
  → 2026-09-24 在 D05M10S1 就栽在这里：这张表只有 7 行，我按"不需要虚拟滚动"的判断把它省了，整表空白，用户第一轮反馈就是"高度有问题，目前无显示内容"。
  → **"业务上不需要"不等于"技术上可以不配"**：这个开关同时控制着容器高度的计算方式。
- `:scroll-width` 传列宽合计或 0 都行（它只影响 `<table>` 的 inline width，主题 CSS 有 `min-width: 100%` 兜底，不会塌缩）。

## 2. ve-table 虚拟滚动 rowKey（原第 9 条）

`rowKeyFieldName` 对应字段必须唯一稳定；数据缺 id 时会导致列宽/行高变化触发 `bodyRowHeightChange` 的 `findIndex=-1` 崩溃（读取 undefined.height）。

规避：为每行补独立 `_key` 字段作 rowKey（id 优先、行号兜底），并把取数接口与行 key 解耦。
注意：后端 SQL 改动必须重新编译才生效。

## 3. mf-stdweb-pms 中 ve-table 与弹窗避坑（参考 D11M16B1 表格 / D11M14S1 弹窗）（原第 10 条）

- **ve-table 高度塌缩为 0**：必须完整复制 `D11M16B1/components/tableList.vue` 的 ve-table 配置（`:max-height="window.innerHeight-160+'px'"` + `:scroll-width` 返回 0 + `:virtual-scroll-option` enable:true 并更新 rowScroll + `rowKeyFieldName="id"`），序号列用 `rowIndex+rowScroll+1`。禁止用 `.ve-table-container{min-height}` 兜底——数据少时会把表格撑高致分页器位置错，删掉又会塌缩为 0，二者不可兼得。
- **首次进入不显示数据（点搜索才出）**：`index.vue` mounted 必须先 `this.bindData()` 再 `$refs.tableList.getColumn()`。
- **分页器位置**：表格高度统一 `window.innerHeight-160`，分页器用 `.flex.j-s.a-c` + Pagination（单子元素靠左，项目惯例，不要改右对齐），page-container 用 `el-row>el-col` 包裹。
- **点击弹出 dialog 后背景/遮罩看不到**（半透明遮罩消失、背景直接透出）：根因待确认（自包含 el-dialog、外层 v-if 均尝试过未完全解决）。当前规避方向：el-dialog 放 index.vue 层包裹、formEdit.vue 只做纯内容组件、显式 `:z-index`，参考 D11M14S1；表格仍用 ve-table（参考 D11M16B1）。【此条待确认后修正】
- **类型编码按名称拼音自动生成**：用项目已有 js-pinyin（`pinyin.setOptions({checkPolyphone:false,charCase:1})` + `pinyin.getFullChars(name)`）；名称变化时若编码为空或为自动生成态则填充，用户手动改编码后设标志停止自动覆盖。

## 4. 批量编辑列表的枚举列：单元格内嵌透明下拉（原第 12 条）

ve-table 批量编辑列表的枚举列（如参数类型/控制类型），用"单元格内嵌透明下拉选择框"实现 input 样式，勿直接放可见 el-select 占满整格。完整实现参考 `SYSM06B1/components/elitem.vue` 的 `renderOverlaySelect` 方法（cfgtype、ctrltype 两列共用）：

- **结构**：外层 div + 透明覆盖层(el-select) + 可见内容层；下层铺一层 `opacity:0`、`z-index:1`、覆盖整格的 el-select（filterable，v-model 绑行字段），选项在 body 弹层显示。视觉上是"文本+角标"，点击即弹出筛选下拉。
- **对齐习惯**：枚举列可见内容"文字水平居中 + 下拉角标右对齐"——文本层 `justify-content:center`，左右各留约 18px（`padding:0 18px`，长文本加 ellipsis）避免与右侧角标重叠；角标用 `position:absolute; right:4px; top:50%; transform:translateY(-50%)` 贴格子右缘垂直居中；不要用 `space-between`（会把文字顶到左侧）。
- **坑**：透明覆盖层(z-index:1)会拦截物理点击，若未命中其内部 el-select（el-select 常因 `.wpselect` `z-index:-1` 压在层下），点击无反应、下拉打不开。规避：必须在外层 div 挂 `on-click`，统一 `document.getElementById(id).click()` 程序化触发（el-select 根 `@click.stop=toggleMenu`，物理点击能命中它时自会 stop，不会双重开关）；id 用 `column.field+"_"+row.rowKeys`（rowKeys 每行唯一且 watcher 先于首次渲染赋好；勿用 rownum，移动/删除后不稳）。
- **显示值要映射 label**（`cfgTypeList=[{label:'系统',value:0}...]`，`selectLabel(val,list)` 取值转文案），data 里存数值；选项 el-option label/value 分离。多个枚举列复用同一 `renderOverlaySelect(row,column,list)`。
- **固定枚举**（如 cfgtype 0/1/2）不要加 `allow-create`，避免把用户输入文本当脏字符串入库；需要筛选才加 filterable。
- 依赖 `@/styles/mycustom.scss` 的 `.wpselect`、`.writePacksn`（箭头样式）、`.textlinethrough`（作废划线）。
- **保存剥离 rowKeys 必须克隆行后删**（`Object.assign({},row)` 再 `$delete rowKeys`），勿直接删原行——保存失败时原行 rowKeys 丢失会破坏下拉/勾选。
- 该列不要设 `edit:true`，下拉填充/剪贴板只作用到 cfgname/cfgkey/cfgvalue/cfgoption 等可编辑文本列。

## 5. 列表"列设置"（SetColums）（参考 D11M16B1 / D11M19B1 列表，2026-09 实测）（原第 14 条）

- **`<SetColums>` 是全局组件**，由平台库 `@inksyun/webcomp` 提供（main.js: `import { install } from "@inksyun/webcomp"; Vue.use(install)`），标签必须写 `<SetColums>`（大写 C），listHeader.vue 里**不需要 import、不需要 components 注册**。不要 import `@/components/Setcolums`——那是本地旧版，只有少数老页面（D11M06B1、D11M03B1、EditGroupBtns）在用；混用会让两套行为不一致。
- **生效链路**：弹窗内改动只落在副本上 → 点"保存" POST `/system/SYSM07B9/saveByCode`（"重置"走 `/deleteByCode?code=`）→ 组件 `$emit("bindData")` → listHeader 转发 `@bindColumn` → index.vue `$refs.tableList.getColumn()` → `$getColumn` 重拉配置 → initTable 重建列。组件的 `bindData()` 里是 `JSON.parse(JSON.stringify(this.tableForm))` **深拷贝**，所以**只拨开关不点保存不会生效**；也不要写 `watch("tableForm.item")` 之类的本地监听去"实时生效"，`tableForm.item` 根本不会被改，那是死代码。
- **initTable 里隐藏列要直接不 push 进 customData**（`if (!item.displaymark) { columnHidden.push(...); return; }`），不要只依赖 `:columnHiddenOption`：ve-table 的 `defaultHiddenColumnKeys` 只在 `initColumns()` 里读一次，而 `initColumns()` 仅在 columns prop 变化时调用（`node_modules/vue-easytable/packages/ve-table/src/index.jsx:979`），且该数组为**空数组时不重置** hiddenColumns。参考 `D05M05M2/components/tableTh.vue` 对动态工序列的处理（displaymark=0 直接 return）。
- **动态列**（按后端配置/字典生成的列，如 D11M19B1 的资料类型列、D05M05M2 的工序列）要能进列设置并被记住，必须**在调用 `$getColumn` 之前就并进本地列配置**（itemcode 用业务码，如 typecode），不能等 `$getColumn` 返回后再插：`src/utils/getcolumn.js` 的 `mergeColumnData` 按 itemcode 在后端配置与本地配置间对齐——后端独有的列会被丢弃、本地独有的列被追加到末尾、顺序以后端保存的顺序为准。只在返回后插入的动态列永远匹配不上后端存的 displaymark/minwidth，每次刷新都会退回默认显示。

---

## 6. ve-table 单元格内嵌可编辑控件（下拉 / 时间 / 编辑框）（2026-09-24 D05M10S1 实测全线踩坑）

> 场景：表格每个单元格都是可编辑控件（日类型下拉、首班/末班时间、班次数与工时、备注），且行数据之间要联动（改时间自动算工时）。

### ① 整表不可见 = 容器高度塌缩为 0

根因在 ve-table 的 `tableContainerStyle()` 两个分支：

```js
if (this.isVirtualScroll) {
  tableContainerHeight = maxHeight;      // 开了虚拟滚动：容器高度 = max-height，确定值
} else {
  tableContainerHeight = this.tableHeight; // 没开：取内部实测高度，初始就是 0
}
```

`tableHeight` 初始值 `0`，靠 ResizeObserver 回填——**高度为 0 的容器量不出内容高度，自举失败，整张表永远不显示**。

- 规避：必须开 `:virtual-scroll-option="{ enable: true, scrolling: ({ startRowIndex }) => this.rowScroll = startRowIndex }"`，并配 `rowKeyFieldName`。
- **附带坑**：开了虚拟滚动后 `max-height` 会被**直接当成容器高度**。别给 `window.innerHeight - 300` 这种，表格只有几行时下方会空一大块；按「表头 + 行数 × 行高 + 合计行」给贴合的值（如 7 行表给 320px），窗口矮时再收窄。

### ② `:scroll-width` 传 0 不会导致塌缩

它只作为 `<table>` 的 inline width，主题 CSS 有 `min-width: 100%` 兜底。需要窄屏横向滚动就传列宽合计（`min-width:100%` 保证宽屏仍拉满）。

### ③ 改行数据后单元格不刷新——**别用 `keynum += 1` 重建整表**

- `renderBodyCell` 返回的是**静态 vnode**；ve-table 只 watch `tableData` 的**引用**（非 deep），改 row 字段不会重新渲染单元格。
- 重建整表会**销毁正在打开的下拉/时间面板**。典型症状：时间面板 spinner 滚一格就实时 emit 一次 input → 触发联动重算 → 重建 → 面板立刻消失（表现为"滚一格就没了"）。
- **正确做法**：把单元格内容做成响应式子组件（`props: { row, field }`，render 里读 `row[field]`），数据一变它自己刷，表格完全不用重建：

```js
const TextCell = {
  props: { row: { type: Object, required: true }, field: { type: String, required: true } },
  render(h) { return <span>{this.row[this.field]}</span>; },
};
```

### ④ `clearable` 默认 true——透明覆盖层里点得到那个看不见的 ×

- 症状：点单元格右侧 → **值被清空，且下拉/面板打不开**。
- 根因：`el-date/time-picker` 的 `clearable` **默认 true**，input 右侧有清除按钮；因为覆盖层是 `opacity:0`，用户看不见它。清除按钮带 `@click.stop`，事件不冒泡，外层 div 的 on-click 不触发 → 拿不到 focus、面板打不开。
- 规避：`clearable={false}`。

### ⑤ 触发元素**不能**用 0 尺寸（`width:0;height:0`）

- 症状：面板能弹出，但**滚轮无效、拖不动滚动条、点一下就关**。
- 根因：popper 拿触发元素的矩形算定位、边界检测和"是否点在面板内"的判定，0×0 时全部失真（`time-spinner` 用 `el-scrollbar`，滚动全靠 JS 处理 wrap 上的事件，判定失效就全废）。
- 做法：让触发元素**有真实尺寸**——`opacity:0` 的透明覆盖层铺满整格，里面放 `width:100%;height:100%` 的控件。
- 隐藏控件的容器要**绝对定位**脱离布局流（`position:absolute;left:0;top:0;width:100%;height:100%`）。否则控件被 `focus()` 后内部 input/图标撑开容器，撑动 flex 行把同行角标挤走且不恢复。
- 面板加 `appendToBody={true}`，避免被表格滚动容器裁剪。

### ⑥ 面板挂在 body 上，scoped 样式命不中它

`appendToBody` 的面板是 body 的子元素，**没有 `data-v-xxx` 祖先**，scoped 里的 `::v-deep` 对它无效。要给它加样式（如提高 z-index 防被页面元素压住）必须：

```js
// 模板：popper-class="week-time-popper"
// 文件里另开一个【非 scoped】style 块
<style lang="scss">
.week-time-popper { z-index: 3000 !important; }  // !important 才能盖过 element-ui 的 inline z-index
</style>
```

### ⑦ 角标（展开指示）的标准做法

绝对定位钉在格子右缘垂直居中，`pointer-events:none` 不接事件；点击统一由**外层 div 挂 on-click**程序化唤起（el-select 用 `el.click()`，el-date/time-picker 用 `el.focus()`）；id 用 `列field + "_" + 行唯一值`。

```jsx
<i class="writePacksn el-icon-time"
   style="position:absolute;right:4px;top:50%;transform:translateY(-50%);z-index:2;pointer-events:none;" />
```

### ⑧ `edit: true` 与 `renderBodyCell` 可以共存

ve-table 的编辑器是**独立浮层**（`EditInput` 绝对定位在表格容器上，不在 td 内），所以列上同时写 `edit: true` 和 `renderBodyCell` 不冲突：平时显示 renderBodyCell 的内容，双击时浮层输入框盖上来。配合：

```js
editOption: {
  cellValueChange: ({ row, column, changeValue }) => { /* changeValue 是字符串，转成目标类型 */ },
  // beforeCellValueChange 返回 false 可阻止写入
}
```

### ⑨ rowKeyFieldName 直接用现成的业务唯一字段

固定行数的表（周历一周 7 行）直接 `rowKeyFieldName="weekday"` 即可，不必再往行数据里塞 `rowKeys`。

### ⑩ 表格内元素由 ve-table 子组件渲染，scoped 样式要 `::v-deep`

`[data-v-x] .cls` 能命中 ve-table 根元素（继承父组件 scopeId）内的后代；直接写 `.cls` 不生效。单元格左右留白交给覆盖层/文字层控制时，把 td 的 padding 一起改掉（`::v-deep .ve-table-body-td { padding: 2px 0 }`）。

---

## 7. 【标准】单元格可编辑的 ve-table ——**下次直接照这套做**

> 2026-09-24 定标（D05M10S1 周历规则）。凡「一张小表、每格都要能改、格与格之间还要联动」的场景，一律用这套，不要重新发明。
> **参考实现（完整可运行）**：`0-Web_Code\mf-vue2\mfomsweb\mf-stdweb-manu\src\views\modules\D05\D05M10S1\components\weekTable.vue`

### 视觉 / 交互规范

| 单元格类型 | 平时显示 | 怎么编辑 |
|---|---|---|
| 文本、数字 | 纯文本（居中/左对齐） | **双击** → ve-table 内置输入框浮层 |
| 枚举、时间、日期 | 纯文本 + **右缘蓝色角标** | **点格子任意处** → 唤起下拉/时间面板 |

- 角标：`writePacksn` + 对应图标（`el-icon-arrow-down` / `el-icon-time` / `el-icon-date`），绝对定位钉在右缘垂直居中，`pointer-events:none`
- 表格底部：`footer-data` + `fixed-footer` 做合计行
- 表格下方：一行 legend 放合计数字、操作按钮和说明文字
- 下拉填充（`cell-autofill-option`）默认开，行标识列禁止填充

### ve-table 属性骨架（照抄）

```html
<ve-table
  ref="tableList"
  rowKeyFieldName="<业务唯一字段>"       <!-- 如 weekday，不必另造 rowKeys -->
  :max-height="tableMaxHeight"           <!-- ⚠ 开虚拟滚动后它就是容器高度，给贴合值，别给 100vh-300 -->
  :scroll-width="tableMinWidth"           <!-- 列宽合计 -->
  is-horizontal-resize
  :fixed-header="true"
  :columns="columsData"
  :table-data="lst"
  border-x
  border-y
  :border-around="true"
  :footer-data="footerData"
  :fixed-footer="true"
  :column-width-resize-option="{ enable: true, minWidth: 50 }"
  :virtual-scroll-option="virtualScrollOption"   <!-- ⚠ 必须，否则整表不可见 -->
  :cellSelectionOption="{ enable: true }"
  :edit-option="editOption"
  :cell-autofill-option="cellAutofillOption"
/>
```

### data 骨架

```js
rowScroll: 0,
virtualScrollOption: {                                     // 见第 6 节 ①
  enable: true,
  scrolling: ({ startRowIndex }) => { this.rowScroll = startRowIndex; },
},
editOption: {                                              // 双击编辑：编辑框给的是字符串
  cellValueChange: ({ row, column, changeValue }) => {
    if (column.field == "shiftcount") row.shiftcount = this.toNumber(changeValue, 0, 3);
  },
},
cellAutofillOption: {
  directionX: true,
  directionY: true,
  beforeAutofill: ({ sourceSelectionData }) =>
    this.fillKey(sourceSelectionData) != "<行唯一字段>",    // 行标识列禁止填充
  afterAutofill: ({ sourceSelectionData, targetSelectionData }) => { /* 需要联动的列在这里重算 */ },
},
```

### 单元格渲染器（三种，按列选用）

```js
// 1) 文本 / 数字：双击编辑。⚠ 不要用重建表格来刷新，见第 6 节 ③
{
  field: "shiftcount", key: "shiftcount", title: "班次数", width: 110, align: "center",
  edit: true,
  renderBodyCell: ({ row, column }, h) => <TextCell row={row} field={column.field} />,
}

// 2) 枚举（下拉）
renderBodyCell: ({ row, column }, h) =>
  this.renderOverlayCell({ row, column }, {
    icon: "el-icon-arrow-down",
    trigger: "click",
    render: (id) => (
      <el-select class="wpselect" style="width:100%;height:100%;" size="mini" id={id}
        v-model={row[column.field]} on-change={(val) => this.changeXxx(row, val)}>
        {this.xxxList.map((it, i) => <el-option key={i} label={it.label} value={it.value} />)}
      </el-select>
    ),
  }),

// 3) 时间 / 日期（同结构，触发器换成 focus）
renderBodyCell: ({ row, column }, h) =>
  this.renderOverlayCell({ row, column }, {
    icon: "el-icon-time",
    trigger: "focus",
    render: (id) => (
      <el-time-picker style="width:100%;height:100%;" size="small" id={id}
        value={row[column.field]} valueFormat="HH:mm" format="HH:mm"
        clearable={false}                 /* ⚠ 必须，见第 6 节 ④ */
        appendToBody={true}
        popperClass="week-time-popper"    /* ⚠ 配合非 scoped 样式提层级 */
        on-input={(val) => this.changeTime(row, column.field, val)} />
    ),
  }),
```

### renderOverlayCell / openCellEditor（照抄，只换图标和 trigger）

```js
// 透明覆盖层铺满整格 + 文字居中 + 角标右缘垂直居中不接事件
// 覆盖层会挡住物理点击，故外层 div 统一挂 on-click 程序化唤起
renderOverlayCell({ row, column }, cfg) {
  var id = column.field + "_" + row.<行唯一字段>;
  return (
    <div style="position:relative;height:100%;box-sizing:border-box;"
      on-click={() => this.openCellEditor(id, cfg.trigger)}>
      <div style="position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;z-index:1;">
        {cfg.render(id)}
      </div>
      <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:0 18px;box-sizing:border-box;">
        <span style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">
          <TextCell row={row} field={column.field} />
        </span>
      </div>
      <i class={"writePacksn " + cfg.icon}
        style="position:absolute;right:4px;top:50%;transform:translateY(-50%);z-index:2;pointer-events:none;font-weight:bold;font-size:14px;" />
    </div>
  );
},
// el-select 用 click()，el-date/time-picker 用 focus()
openCellEditor(id, method) {
  var el = document.getElementById(id);
  if (!el) return;
  method == "focus" ? el.focus() : el.click();
},
```

### 必备的两个响应式单元格组件（放在 SFC 的 `<script>` 顶部、`export default` 之前）

```js
// 文本：行数据被间接改动（联动重算 / 下拉填充）时自己刷新，绝不重建表格
const TextCell = {
  props: { row: { type: Object, required: true }, field: { type: String, required: true } },
  render(h) { return <span>{this.row[this.field]}</span>; },
};
// 状态标签之类同理，做成组件而不是渲染函数
```

### 样式骨架

```scss
<style lang="scss" scoped>
@import "@/styles/mycustom.scss";              // 提供 .wpselect / .writePacksn
::v-deep .ve-table-body-td { padding: 2px 0; }  // 左右留白交给覆盖层/文字层
::v-deep .ve-table-footer-td { padding: 4px; }
</style>

<!-- 面板样式：必须非 scoped（面板 appendToBody 后没有 data-v 祖先） -->
<style lang="scss">
.week-time-popper { z-index: 3000 !important; }
</style>
```

### 落地检查清单

- [ ] `:virtual-scroll-option` 开了（否则整表空白）
- [ ] `max-height` 按「表头 + 行数 × 行高 + 合计行」给的贴合值
- [ ] `rowKeyFieldName` 用的是行内唯一且稳定的业务字段
- [ ] 时间/日期选择器有 `clearable={false}`
- [ ] 隐藏控件有真实尺寸（`opacity:0` 覆盖层），没有用 `width:0;height:0`
- [ ] 面板有 `appendToBody` + `popper-class`，且样式在**非 scoped** 块里
- [ ] 单元格内容用 `TextCell` 之类的响应式组件，**全文没有 `keynum += 1` 重建表格**
- [ ] 值变化后不需要刷新别处时，不要动 `columns` / `table-data` 的引用
