# 列表页搜索标准：后端场景搜索

> 触发：给任意 Vue2 微应用（`mf-stdweb-*`、`web2/ui-*`）列表页**新增或改造搜索、高级搜索、常用场景**时读本文件。
> 定标：2026-11-25，D04M18B1 / D04M18B2 落地，基准页面 D01M03B1（sale）。

---

## 1. 结论

列表页的快速搜索、高级筛选、常用场景**一律走「后端场景搜索」链路**：

- **不要**自己写 `el-form` + `SearchPojo` 拼高级搜索条件（字段硬编码，极易与后端 mapper 失配，最后传过去全部无效）。
- 三类搜索在**前端只产生数据**，条件是 `SceneItemPojo` 数组，**后端统一转 SQL**。
- 参照 D01M03B1 的界面：搜索框 + 高级筛选按钮（打开 `SearchForm` 弹窗）+ 场景下拉（`Scene`），全部是**全局组件**，不 import、不自研。

```text
快速搜索   el-input ──$search────────→ queryParams.searchdata
高级筛选   SearchForm 弹窗 ─$advancedSearch→ queryParams.scenedata
常用场景   Scene 组件 ──bindData 读取──→ queryParams.scenedata
                                                    │
后端 Controller: qpfilter += queryParam.getAllFilter() → setFilterstr(filterstr)
后端 Mapper:     <if test="filterstr != null"> ${filterstr} </if>
```

`getAllFilter() = getSceneFilter() + getSearchFilter()`，两者分别解析 `scenedata` / `searchdata`。

---

## 2. 全局组件（`@inksyun/webcomp` install 注册，标签直接用，禁止 import）

| 组件 | 用途 | 关键 props / 事件 |
|---|---|---|
| `Scene` | 常用场景下拉 | `:code="tableForm.formcode"`，`@bindData="bindData"` |
| `SearchForm` | 高级筛选弹窗内容 | `:code="tableForm.formcode"`，`@advancedSearch`、`@closedDialog`、`@bindData` |
| `SetColums` | 列设置（大写 C 的全局版） | `:code`、`:tableForm`、`@bindData` |

> 新页面用全局 `SetColums`；本地 `@/components/Setcolums`（小写 c）是旧版，两者都走 SYSM07B9，但**同一页面不要混用**。

---

## 3. 代码样板

### 3.1 listheader.vue（搜索框 + 高级筛选入口 + 弹窗）

```vue
<template>
  <div>
    <div class="filter-container flex j-s a-c">
      <div style="display: flex">
        <el-input v-model="strfilter" placeholder="请输入查询" prefix-icon="el-icon-search"
          style="width: 260px; height: 100%" class="filter-item" size="mini"
          @keyup.enter.native="btnSearch">
          <el-button slot="append" class="filter-item" size="mini" @click="btnSearch">搜索</el-button>
        </el-input>
      </div>

      <div class="iShowBtn">
        <el-button size="mini" icon="el-icon-search" @click="openSearchForm()" title="高级筛选"
          :type="$store.state.advancedSearch.modulecode == tableForm.formcode ? 'primary' : 'default'">
        </el-button>
        <el-button size="mini" icon="el-icon-refresh-right" @click="$emit('bindData')" title="刷新"></el-button>
        <el-button size="mini" icon="el-icon-s-tools" @click="openDialog()" title="列设置"></el-button>
        <el-button size="mini" icon="el-icon-s-help" @click="$emit('btnHelp')" title="帮助"></el-button>
      </div>
    </div>

    <!-- 列设置 -->
    <el-dialog width="800px" title="列设置" v-if="setColumsVisible" :append-to-body="true"
      :visible.sync="setColumsVisible" :close-on-click-modal="false" :destroy-on-close="true">
      <Setcolums ref="setcolums" :code="code" :tableForm="tableForm"
        @bindData="$emit('bindColumn')" @closeDialog="setColumsVisible = false" />
    </el-dialog>

    <!-- 高级筛选：字段按 formcode 从系统配置读取 -->
    <el-dialog title="高级筛选" width="720px" :visible.sync="searchVisible" :append-to-body="true"
      :close-on-click-modal="false" :destroy-on-close="true">
      <SearchForm ref="searchForm" :code="tableForm.formcode"
        @advancedSearch="advancedSearch" @closedDialog="searchVisible = false" @bindData="bindData" />
    </el-dialog>
  </div>
</template>

<script>
import Setcolums from "@/components/Setcolums";
export default {
  name: "Listheader",
  components: { Setcolums },
  props: ["tableForm"],
  data() {
    return { strfilter: "", code: "<FORMCODE>", setColumsVisible: false, searchVisible: false };
  },
  methods: {
    openDialog() { this.setColumsVisible = true; },
    // 必须延迟调 getInit，否则弹窗内字段未初始化
    openSearchForm() {
      this.searchVisible = true;
      setTimeout(() => { this.$refs.searchForm.getInit(); }, 100);
    },
    advancedSearch(searchdata) {
      this.$emit("advancedSearch", { formdata: searchdata });
      this.searchVisible = false;
    },
    btnSearch() { this.$emit("btnSearch", this.strfilter); },
    bindData() { this.$emit("bindData"); },
  },
};
</script>
```

### 3.2 index.vue（搜索 / 高级筛选方法）

```js
// 快速搜索：按 formcode 的搜索字段配置生成 searchdata
search(res) {
  this.$search(this, res);
},
// 高级筛选：SearchForm 返回的条件走 scenedata
advancedSearch(val) {
  // 空数组防护：$advancedSearch 内部会读 val.formdata[0].field
  if (!val || !val.formdata || val.formdata.length == 0) {
    this.$message.warning("请选择筛选条件");
    return;
  }
  this.$advancedSearch(this, val, 1);
},
```

### 3.3 Scene 常用场景（放在分页器同一行右侧）

```vue
<div style="display: flex; justify-content: space-between; align-items: center">
  <pagination v-show="total > 0" :total="total" :page.sync="queryParams.PageNum"
    :limit.sync="queryParams.PageSize" @pagination="GetList" />
  <div style="margin-right: 10px">
    <Scene ref="scene" :code="tableForm.formcode" @bindData="bindData"></Scene>
  </div>
</div>
```

```js
mounted() {
  this.bindData();
  this.getColumn();
  // 加载常用场景
  this.$nextTick(() => {
    if (this.$refs.scene) this.$refs.scene.bindData();
  });
},
methods: {
  bindData() {
    // 场景条件并入查询参数（全项目统一写法，含 total != 0 的边界）
    if (!!this.$refs.scene && this.$refs.scene.radio != -1 && this.total != 0) {
      this.queryParams.scenedata = JSON.parse(
        this.$refs.scene.lst[this.$refs.scene.radio].scenedata
      );
    } else {
      if (this.queryParams.SearchType == 1) {
        this.$delete(this.queryParams, "scenedata");
      }
      if (!!this.$refs.scene) this.$refs.scene.radio = -1;
    }
    // ... 正常查询
  },
},
```

### 3.4 后端 Controller / Mapper

```java
String qpfilter = "";
qpfilter += queryParam.getAllFilter();   // 场景 + 快速搜索条件
queryParam.setFilterstr(qpfilter);
```

```xml
<if test="filterstr != null ">
    ${filterstr}
</if>
```

---

## 4. 前置配置（不配则搜索静默失效）

| 配置 | 位置 | 作用 |
|---|---|---|
| 字段列表 | `/system/SYSM07B12/getFieldListByCode?code={formcode}` | 快速搜索取 `searchmark=1` 的字段；`SearchForm` 也按此生成条件行 |
| 列配置 | `/system/SYSM07B9/getBillEntityByCode?code={formcode}` | 列设置、列表列元数据 |
| Vuex 模块 | `src/store/index.js` 注册 `advancedSearch` | 高级筛选按钮高亮用 `$store.state.advancedSearch.modulecode` |

两者都用 **formcode**（如 `D04M18B1List`），不是模块编码。

---

## 5. 坑

1. **`SearchForm` 打开必须 `setTimeout(..., 100)` 后调 `$refs.searchForm.getInit()`**，否则弹窗内字段列表是空的。
2. **`$search` / `$advancedSearch` 会 `$delete(queryParams, "OrderBy")`**：后端 Controller 必须给默认排序（`if (OrderBy == null) setOrderBy(...)`），否则列表顺序随机。
3. **`$search` 依赖 SYSM07B12 配置**：该 formcode 没配 `searchmark` 字段时，`searchdata` 会被删掉，搜索框输入后相当于没搜（返回全部），不报错。
4. **多表 join 的列表，场景/筛选字段必须带表前缀**（如 `Mat_InventoryLayer.LayerNo`、`Mat_AccessItemLayer.Direction`），否则列名歧义报错。
5. **`val.formdata` 可能为空数组**，`$advancedSearch` 内部直接取 `[0].field` 会抛异常，入口处先判空。
6. **不要自己写高级搜索表单**：D04M18B1/B2 曾经从别的页面抄了「功能编码/名称/时间字段/数据表/列名」，后端 mapper 根本没有这些条件，全部无效且难排查。
7. `Scene` 的 `code` 用 `tableForm.formcode`；场景里选中的条件存在 `$refs.scene.lst[radio].scenedata`（JSON 字符串，需 `JSON.parse`）。
8. 新增页面记得 `mounted` 里 `$nextTick` 调一次 `$refs.scene.bindData()`，否则场景下拉为空。

---

## 6. 条件格式（前端传给后端的形态）

```js
[
  {
    field: "Mat_InventoryLayer.LayerNo",  // SQL 列名/表达式，多表必带前缀
    fieldtype: 0,                          // 0 字符 / 1 数值
    math: "equal",                         // 常见：equal / ilike / like / between 等，以 QueryParam.getSceneFilter 为准
    value: "KC2026110001"
  }
]
```

`$search` 自动生成时：文本字段用 `math: "ilike"`，数值字段用 `math: "="`。

---

## 7. 基准实现

| 页面 | 位置 | 可参考的点 |
|---|---|---|
| D01M03B1 | `mf-stdweb-sale/.../D01/D01M03B1/components/listHeader.vue` | 搜索框 + SearchForm 高级筛选 + 时间范围，最完整 |
| D04M18B1 / D04M18B2 | `mf-stdweb-store/.../D04/D04M18B1|D04M18B2/` | 2026-11-25 落地：ve-table + Scene + SearchForm |
| D04M04B1 | `mf-stdweb-store/.../D04/D04M04B1/index.vue` | Scene 场景 + 分页器同行布局 |