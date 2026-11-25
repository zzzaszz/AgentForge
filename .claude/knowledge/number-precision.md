# 前端数量/金额精度问题（相减长尾与小数位）

> 触发：页面出现 `0.30000000000000004`、`12.300000000000001` 这类长尾小数；要展示或回传"需求-已领""总投-完成-MRB""入库-出库"等差值；新增数量/金额展示字段。
> 记录时间：2026-11-25，来源：D05M01B1WS 单据抽屉物料明细（需求/已领/应领）。

## 1. 结论：标准写法

```js
function num(value) {
  return Number(value) || 0;
}

// 展示：默认两位小数
function fmtQty(value) {
  return num(value).toFixed(2);
}

// 相减：先收敛再使用（展示和回传都用这个值，不要用裸差值）
const remain = Number((num(row.quantity) - num(row.finishqty)).toFixed(2));
```

规则：

1. **差值一律先 `toFixed(2)` 再使用**：`Number((a - b).toFixed(2))`。不要直接 `a - b` 拿去展示或回传。
2. **展示统一两位小数**：`num(v).toFixed(2)`，无效值兜底 `0.00`（不是 `0`）。
3. **回传后端的数量也要收敛**，不能只处理显示——长尾写库后，后续领用/入库数量会带出更多小数。
4. **默认两位**；业务单位精度更高时（如按该单位的 `UnitRate`）按该业务统一的小数位处理，不要同一页面各写各的。
5. **不要自作主张 `Math.max(0, ...)`**：超领、负数差异要能看出来；只有业务明确"不允许负数"时才截断（如领料弹窗的"本次可领"）。

## 2. 为什么会出现

JS 用 IEEE 754 双精度浮点，`0.1 + 0.2 !== 0.3`。数量字段本身往往是 `decimal(18,4)` 之类，前后端 JSON 往返后仍是浮点，相减就带长尾：

```js
12.3 - 12 // 0.2999999999999998
```

`toFixed(2)` 必须作用在**最终差值**上；中间过程先转字符串再算，会引入新的精度问题。

## 3. 存量参照（改之前先 grep 这些写法）

| 位置 | 写法 |
|---|---|
| `D05M01B1WS/components/MaterialDialog.vue` | `fmtQty = num(v).toFixed(2)`；`remainingQty = Number(Math.max(0, q - f).toFixed(2))` |
| `D05M01B1WS/components/ItemDetailDrawer.vue` | 物料明细：需求 `quantity`、已领 `finishqty`、应领 `(quantity - finishqty).toFixed(2)` |
| `D05M01B1WS/components/BillList.vue` | 结余 `balQty = Number((qty - done - mrb).toFixed(2))` |
| `D05M01B1WS/components/InStoreDialog.vue` | 入库数量 `(num(...) - num(...)).toFixed(2)` |
| `QuickScanWorkbench / QuickScanInStore / FirstInputDrawer / FirstOutputDrawer` | 同一口径：可处理数 = 应有 - 已处理，先 `toFixed(2)` |

共性：这些地方算的都是"**应处理数 = 应有 - 已处理**"，属于同一类问题，发现一处就要 grep 同类一起核对。

## 4. 动手前检查清单

- [ ] 相减是否用了 `Number((a - b).toFixed(2))`
- [ ] 展示是否两位小数、无效值是否兜底 `0.00`
- [ ] 传给后端的数量是否也收敛过
- [ ] 是否先 `grep -rn "toFixed\|quantity -\|finishqty"` 核对了同类写法，避免只改用户报的那一处
- [ ] 是否需要 `Math.max(0, ...)` 是否由业务明确，而不是随手加