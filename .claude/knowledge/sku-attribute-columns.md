# SKU/SPU 属性（attributejson）在前端表格中的标准显示方式

> **标准**：用户 2026-10 明确要求「下次遇到 sku 默认使用这种方式」。凡列表页/弹窗要显示货品 SKU 属性（颜色、长、宽、厚等），直接照本文实现，不要再自行设计。

## 场景与数据形态

- 列表行数据上带 `attributejson` 字段，内容是 JSON 字符串：`"[{\"key\":\"spuyanse\",\"value\":\"棕色\"}]"`。
- 空值有三种形态，**解析时都要兼容**：`""`、`"[]"`、或已经是数组（非字符串）。

## 标准做法（四步）

1. **解析并平铺到行**：把 attributejson 解析为 `[{key,value}]`，逐项 `row[key] = value` 平铺到行对象上（Vue2 用 `this.$set`，Vue3 直接赋值）。
2. **取属性定义**：GET `/goods/D91M01S2/getListByShow?ud=` 返回 SPU 属性定义列表，字段 `attrkey`（如 `spuyanse`）、`attrname`（如 `颜色`）、`listshow`、`skumark` 等，建 `attrkey → attrname` 映射。
3. **列常驻（关键，勿返工）**：动态列按属性定义**全集**生成（v-for，`:prop="attrkey"` `:label="attrname"`），**不是**按当前页数据里出现过的 key 生成——即使当前页数据没有 attributejson，属性列也要常驻显示、值留空。（2026-10 用户明确要求；最初按 key 并集动态生成被要求返工。）
4. **兜底列**：数据行中出现、但属性定义里已缺失的 key（历史数据残留），追加在定义列末尾，列头显示 key 原文。

## 坑

- **属性定义可能已被删除**：实测库存数据里有 `spuwaijing/spunajing/spugaodu` 的值，但 `getListByShow` 已无定义——没有兜底列这些值就无处显示。
- **别和货品自定义字段混用**：`custjson` 是另一套，key 翻译走 `/goods/D91M01S4/getListByShow`（字段名 `custkey`/`custname`），与 SPU 属性的 D91M01S2 不是同一接口。

## 已落地实例（照抄）

- Vue3 pad：`0-Web_Code\web3\mf-stdpad-manu\src\views\modules\D05\D05P07M1\components\InventMa.vue`、`D05P07M1EAP\components\InventMa.vue`（parseAttrs + loadAttrColumns + attrColumns v-for，含"剩余数量"列 quantity）
- Vue2 老参考：`0-Web_Code\mf-vue2\mfomsweb\mf-stdweb-store\src\views\modules\D04\D04M04B1\components\selectonline.vue`

## 相关接口事实

库存行接口 `/store/D04M04B1/getOnlinePageList` 的 SQL 本就返回 `attributejson`、`skuid`、`quantity`、`storename`——显示 SKU 属性纯前端改动即可，无需动后端。
