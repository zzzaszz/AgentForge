# pad 虚拟数字键盘（numpad）标准与踩坑

适用项目：`0-Web_Code\web3\mf-stdpad-manu`（Vue3 + Element Plus，pad/工控机触屏端）。
凡是「数量输入」一律用项目内已有的虚拟数字键盘方案，不要用 el-input（pad 无物理键盘）、不要另造排列。

## 1. 标准按键数组（13 键，按 4 列排布）

```ts
const numpadKeys = ["7", "8", "9", "C", "4", "5", "6", "⌫", "1", "2", "3", "0", "."];
```

排布（必须 4 列网格）：

```
7  8  9  C
4  5  6  ⌫
1  2  3  0
.
```

**交互约定（各处实现保持一致）**：
- `C`：清空 buffer，值归 0，重新进入「首次覆盖」状态；
- `⌫`：退格，`parseFloat` 空/NaN 时归 0；
- `.`：已含小数点则忽略；首次覆盖时输入 `.` 处理为 `0.`（MaterialDialog 写法，推荐）；
- 首次输入覆盖默认值（`overwrite = true`），不拼接；
- buffer 去 `.` 后最长 8 位；
- 显示区用 `buffer || "0"`，值为 0 时灰色（`.zero { color: #ccc }`）。

## 2. 踩坑：grid 列数必须与按键数组匹配（2026-09-28 D05P07M1）

现象：修改领用数的虚拟键盘数字排列错乱成 `7 8 9 / C 4 5 / 6 ⌫ 1 / 2 3 0 / .`。
原因：按键数组是 4 列排布设计，弹层网格却写了 `grid-template-columns: repeat(3, 1fr)`。
**规则：改键盘样式时先对照按键数组，网格列数与数组排布列数必须一致（本项目统一 4 列）。**

## 3. 三种现成实现（新功能就近抄）

### 3.1 弹窗内常驻键盘（D05P07M1、D05P07M1EAP 的 index.vue：快捷上/下料、报工入库）

- 结构：`.numpad-display`（标签+大字值）+ `.numpad-grid`（`repeat(4, 1fr)`，键高 48~52px）；
- 键样式：白底 `#fff`、边 `#d0d5dd`、圆角 8~10px、字号 21~22px、`:active` 缩放 0.95；
- 功能键 `.key-fn`：灰底 `#f0f2f5`、橙字 `#e65100`；
- 显示区大字：28~30px 加粗，右对齐，值 0 变灰。

### 3.2 物料领用的悬浮键盘（D05M01B1WS/components/MaterialDialog.vue，**参考标准**）

「本次领用数」行内按钮 + `el-popover` 挂出的小键盘，紧贴触发按钮浮层展示：

```html
<el-popover trigger="click" placement="bottom-end" :width="320"
            popper-class="material-qty-popover"
            @show="openQuantityKeyboard(item)" @hide="closeQuantityKeyboard(item)">
  <template #reference>
    <button type="button" class="quantity-input">
      <span>{{ displayPickQty(item) }}</span>
      <el-icon><EditPen /></el-icon>
    </button>
  </template>
  <div class="quantity-keyboard" @click.stop>
    <div class="quantity-keyboard-display"><span>本次领用数</span><strong>{{ quantityBuffer || "0" }}</strong></div>
    <div class="quantity-keyboard-grid">
      <button v-for="key in quantityKeys" :key="key" class="quantity-key"
              :class="{ function: key === 'C' || key === '⌫' }"
              @click="handleQuantityKey(item, key)">{{ key }}</button>
    </div>
  </div>
</el-popover>
```

样式要点（popover 内容样式在 scoped 里必须用 `:global(.material-qty-popover ...)`，因为 popover teleport 到 body）：

```scss
:global(.material-qty-popover) { padding: 12px !important; }
:global(.material-qty-popover .quantity-keyboard-display) {
  display: flex; align-items: center; gap: 12px; min-height: 48px;
  margin-bottom: 10px; padding: 6px 12px; border-radius: 6px;
  background: #f5f7fa; color: #8a95a5; font-size: 14px;
}
:global(.material-qty-popover .quantity-keyboard-display strong) {
  flex: 1; overflow: hidden; color: #17233d; font-size: 26px; text-align: right;
}
:global(.material-qty-popover .quantity-keyboard-grid) {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;  /* 4 列！ */
}
:global(.material-qty-popover .quantity-key) {
  height: 50px; border: 1px solid #d0d5dd; border-radius: 7px; background: #fff;
  color: #333; font-size: 21px; font-weight: 600; user-select: none;
  -webkit-tap-highlight-color: transparent;
}
:global(.material-qty-popover .quantity-key:active) { background: #e7edf5; transform: scale(0.96); }
:global(.material-qty-popover .quantity-key.function) { background: #f0f2f5; color: #e65100; font-size: 16px; }
```

状态：`activeQuantityRow`（当前行）、`quantityBuffer`、`quantityOverwrite`；`@show` 初始化 buffer、`@hide` 清 active；每键实时写回 `row.pickqty`；手工动过的行打 `row._qtyManual` 标记，显示不再做两位小数收敛。

### 3.3 全屏遮罩浮动居中键盘（D05P07M1、D05P07M1EAP 的 components/OrderBom.vue：修改领用数）

- `<Teleport to="body">` + 全屏半透明遮罩（`rgba(0,0,0,.45)`，z-index 2000）+ 居中白浮层（`width: min(92vw, 400px)`，圆角 14px）；
- 浮层从上到下：标题行（操作名 + 单号/编码）→ 显示区（虚线蓝框）→ `.qn-grid`（**`repeat(4, 1fr)`**，键高 50px）→ 底部按钮行「恢复默认 / 确定」；
- 点遮罩 = 取消并还原打开前的值（打开时先存 `oldQty`）；「恢复默认」`delete item._qty`；每键实时写回 `item._qty`；
- scoped 样式对 Teleport 内容仍生效（data-v 属性会带过去），无需 :global。

## 4. 选择建议

| 场景 | 用哪种 |
|---|---|
| 弹窗内专用数量页（上/下料、入库） | 3.1 常驻键盘 |
| 列表行内改单个数量、空间紧凑 | 3.2 el-popover 悬浮键盘（MaterialDialog 版） |
| 需要遮罩聚焦、带「恢复默认/取消还原」的编辑 | 3.3 全屏浮动弹层（OrderBom 版） |
