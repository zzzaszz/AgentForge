# 列表页打开编辑/详情窗口：优先页内组件切换，不用微前端微窗口，慎用路由跳转

**约定（2026-11-27 用户确认）**：标准版微应用项目内部，列表页点击行内链接打开另一单据的编辑/详情窗口，**优先用页内组件切换**（v-if 全页替换列表，同自己单据编码 `showEdit` 的模式）；**不用 `openMicroWindow` / `$wujie.props.opensub` 微窗口**；**路由跳转到 ED 详情页要慎用**（有白屏坑，见下）。跨微应用、由主应用托管的弹窗场景才走 opensub。

## 两种废弃方式的坑

**微窗口（opensub）**：窗口内删除/保存后要刷新外层列表，只能靠 bindData 回调链：
`window.js openMicroWindow` 塞 `params.bindData` → 主应用按 `openType===0` 挂 `$wujie.props.bindData` → 子应用 `$microBindData()` 调它。
链路任何一环缺失（openType 不对、主应用未挂回调、中间层组件未监听）都**静默失效**，删除后外层列表不刷新且无报错。实测 D06M12B1→8D 微窗口删除后列表不刷新即是此因。

**路由跳转 ED 详情页**：微前端子应用内做正常路由跳转时 `$ismicroapp` 仍为 true，详情页外壳（如 D06M13B1 的 `detailIndex.vue`）`init()` 按 `$ismicroapp` 分支去读 `$wujie.props.lstp` 拿不到 idx，`v-if="idx"` 不渲染 → **白屏**。且 App.vue 无条件 keep-alive，返回刷新还得补 `beforeRouteEnter`。两处坑叠加，不如组件切换可靠。

## 标准写法（样板：mf-stdweb-qms D06M12B1 打开 8D 报告详情）

**详情组件要求**：目标编辑组件只通过 props 接收 `idx`、通过 `$emit('closeForm')`/`$emit('bindData')` 通知外层，不内部操作路由/微前端（如 `D06M13B1/components/drawFormEdit.vue`，路由逻辑在外壳 detailIndex，嵌套使用时不引外壳）。

**列表页**（`D06M12B1/index.vue`）：

```vue
<!-- 编辑页打开8D详情时用 v-show 隐藏，不销毁 FormEdit，保留未保存的编辑状态 -->
<div v-show="formvisible && !eightdvisible">
  <FormEdit v-if="formvisible" ... @openEightD="openEightD" />
</div>
<!-- 8D详情：页内组件切换，不走微窗口/路由 -->
<DrawEightdEdit v-if="eightdvisible" :idx="eightdidx"
  @bindData="bindData" @closeForm="closeEightd" />
<div v-show="!formvisible && !eightdvisible" class="index">...列表...</div>
```

```js
openEightD(eightDId) {
  const id = String(eightDId || '').trim()
  if (!id) return
  this.eightdidx = id
  this.eightdvisible = true
},
closeEightd() {
  this.eightdvisible = false
  this.eightdidx = ''
  this.bindData()
}
```

**编辑页（formEdit）里也要打开详情时**：不自己开，`$emit('openEightD', id)` 交给外层统一打开（外层 v-show 隐藏编辑页而非销毁，未保存改动不丢）；关闭详情后回到编辑页原状态。

**刷新链**：详情组件删除成功自带 `$emit('bindData')` → 外层 `bindData()` 刷列表；关闭时 `closeForm` → `closeEightd` 再刷一次，幂等。

## 检查清单

- 新做「列表页点链接打开编辑/详情」：直接引目标模块的编辑组件页内切换，照 D06M12B1 样板
- 确认目标组件 props 只有 idx、关闭只靠 $emit；如果它内部有 `$router.back()`/`$microClose()`，那说明它依赖外壳（detailIndex 类），不要直接嵌，引它的外壳所包的内层组件
- 编辑页里打开详情：$emit 给外层，外层用 v-show 隐藏编辑页，不用 v-if 销毁
- `beforeRouteEnter` 刷新只在确实走路由跳转的页面保留（如历史遗留），新代码不靠它
- D06M12B1 的 `openEightD.js`（微窗口/路由混合打开器）已废弃无人引用，留作历史参考，不要新代码再引
