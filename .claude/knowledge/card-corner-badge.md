# 卡片右上角状态角标（斜向四边形）

> **本文件是"角标"的默认样式基线。** 以后说"角标"（卡片右上角状态标识），默认就是这套；
> 除非明确要求三角形 / 缎带 / 水平标签，否则不要另起炉灶。

首次落地位置：`0-Web_Code\web2\0-wkspaceapp\inksomsuniapp-fb\src\pages\modules\D05\D05M05R1\index.vue` + `index.scss`
（uniapp 移动端「包装工单查询」页，D05M05R1）。落地日期 2026-09-22。

---

## 1. 样式定义（照抄即可）

### 模板

```html
<view
  v-if="getStateTag(item)"
  class="card-corner"
  :style="{ background: getStateTag(item).bg }"
>
  <text class="corner-text">{{ getStateTag(item).text }}</text>
</view>
```

### SCSS

```scss
// 右上角状态斜角标（斜向四边形，底色由行内样式给）
// 取 u=距卡片右边、v=距卡片上边（单位 rpx）。四边形四边：
//   上边  v=0 且 u∈[79,150] —— 与卡片上边重合
//   右边  u=0 且 v∈[76,150] —— 与卡片右边重合
//   斜边  u+v=76 / u+v=150  —— 两条平行的 45° 边，两端分别落在卡片上边、右边
// 用 clip-path 精确裁出四条边，不依赖卡片 overflow
.card-corner {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 3;
  width: 150rpx;
  height: 150rpx;
  clip-path: polygon(47.33% 0%, 0% 0%, 100% 100%, 100% 50.67%);

  .corner-text {
    position: absolute;
    // 中心落在梯形形心 (u,v)=(58.6,59.0) → 元素内 left=150-58.6、top=59
    left: 91rpx;
    top: 59rpx;
    // 文字沿 45° 斜边方向排列
    transform: translate(-50%, -50%) rotate(45deg);
    font-size: 20rpx;
    line-height: 24rpx;
    color: #fff;
    font-weight: bold;
    white-space: nowrap;
  }
}
```

宿主卡片必须有 `position: relative` 与 `overflow: hidden`（`.bill-card` 已有）。

### 头部让位（角标会压住右上角内容时加）

```scss
.card-header {
  // 角标占 76 ≤ u+v ≤ 150；标签右上角 (padding, 22) 需满足 padding+22 > 150
  &.has-corner {
    padding-right: 140rpx;
  }
}
```

模板上配 `:class="{ 'has-corner': getStateTag(item) }"`，**无角标的卡片不加这个类**，布局与改动前完全一致。

### 状态映射（与角标配套）

```js
// 工单状态码（Wk_WipNote.StateCode）-> 右上角斜角标，空表示正常，不显示
getStateTag(item) {
  const code = (item.statecode || "").toLowerCase();
  if (!code) return null;
  const map = {
    abnormal: { text: "异常处理中", bg: "#ff5722" },
    pause: { text: "已暂停", bg: "#ff9800" },
  };
  return map[code] || { text: item.statecode, bg: "#909399" };
}
```

---

## 2. 为什么是 `clip-path` 而不是旋转方块

这是最容易走弯路的地方，**别再用"旋转方块 + 卡片 overflow 裁切"那套**：

- 绕卡片右上角旋转 45° 的方块，被卡片裁出来的**永远是三角形或楔形**（可见区只有 `带厚×0.707`），装不下 5 个汉字；
- 想让文字全显示就得把元素往卡片里推，推到最后形状既不是三角形也不是平行四边形，来回改都不到位。

`clip-path: polygon()` 直接声明四条边，形状精确可控，**不依赖卡片裁剪**，也不怕 `border-radius` 把角啃掉。

## 3. 参数含义与调参

在 `u`（距卡片右边）/ `v`（距卡片上边）坐标系里，四边形 = `{u≥0, v≥0, c1 ≤ u+v ≤ c2}`：

| 参数 | 现值 | 含义 / 怎么调 |
|---|---|---|
| `c2` | `150rpx` | 长斜边位置。**角标离角的最远距离就是它**，也是决定能装多长文字的那个量 |
| `c1` | `76rpx` | 短斜边位置。**角标靠角侧的切角大小**。调小→更贴角，但小于 ~16rpx 后视觉上退化成三角形；调大→四边形感更强，但角上留白明显 |
| `width/height` | `150rpx` | 元素正方形边长，等于 `c2`（元素右上角 = 卡片右上角） |
| `clip-path` 前两个百分比 | `47.33%` / `50.67%` | = `(c2-c1)/c2` 与 `c1/c2`，改 c1/c2 时要跟着改 |
| `left` / `top` | `91rpx` / `59rpx` | 文字中心。`left = c2 - u`、`top = v`，`(u,v)` 取梯形**形心**（按面积算，不是四顶点平均） |

**文字能否装下的判据**：45° 方向的可用长度 = `2p`（`p` = 沿角平分线离角的距离）。
文字近端需 `p ≥ 长度/2`。20rpx 字号 5 个汉字 = 100rpx，所以梯形形心处 `p` 需 ≥ 50 → 反推 `c2 ≥ 约 105rpx`。

## 4. 依赖的后端字段

`statecode` 来自 `Wk_WipNote.StateCode`（`''` 正常 / `'abnormal'` 异常处理中 / `'pause'` 暂停）。
写入方在 qms：`QmsAbnormityServiceImpl` 提报异常时 `updateWipStateCode(wipid, "abnormal")`。

⚠️ **列表接口 `D05M05B1/getOnlinePageList` 用的 `selectdetailVo`（`inks-service-manu-master/.../mapper/WkWipnoteMapper.xml`）原本不 select 这一列**，已补上 `Wk_WipNote.StateCode,`。
若哪个环境返回的 `statecode` 是 null，先查这里，不要怀疑前端。

## 5. 验证方法（别靠肉眼）

几何调参容易自我说服，**用探针实测**：

```js
// 1) 探针取点：往被测元素里插 0 尺寸 div，读 getBoundingClientRect，再换算成 (u,v)
const cr = card.getBoundingClientRect();
const uv = (px, py) => ({ u: +((cr.right - px) * 2).toFixed(1), v: +((py - cr.top) * 2).toFixed(1) });
// 375 视口下 1rpx = 0.5px

// 2) 命中测试最直接：clip-path 会影响 hit-testing
document.elementFromPoint(cr.right - u / 2, cr.top + v / 2);
// u+v < 76 或 > 150 应命中卡片，76~150 之间应命中 .card-corner
```

要看的四个量：角标四角是否在卡内、文字四角是否在四边形内（叉积做多边形内点判定）、文字到两条斜边的最小距离、工序标签是否被判为在四边形内。

真机入口：`http://localhost:8005/#/pages/modules/D05/D05M05R1/index`
登录 `demo / inks@2025` → **「选择组织」必须选 `OMS标准版-RT`** → 首页「切换」到**简易版** → 「工单查询」→ 选「包装」工序。
（漏选组织会导致 `tenantid` 为空，制造模块全部报"没有权限"、数据为 0。）
