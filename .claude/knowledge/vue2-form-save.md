# Vue2 表单页保存子表（E09 系列）

> 触发：写或改 E09 系列 `formEdit.vue`、调用 `src/utils/count.js` 的 `getParam`、改明细/检测项目子表保存逻辑时读本文件。
> 来源：原 `~/.claude/CLAUDE.md` 第 16 条，2026-09-16 迁移。

---

- **坑①**：`this.$getParam(saveparam, {}, this.formdata)` 是错的。`getParam` 内部是 `paramdata.item.push(...)`；传 `{}` 时 `paramdata.item` 为 undefined——有明细行会 TypeError 中断保存（async 静默失败，只有控制台报错），无明细行则 payload 里压根没有 `item` 字段，后端按 `pojo.getItem()` 落库 → 表现为"明细/检测项目保存不上、前端未传递"。**必须写成 `{ item: [] }` 占位**，与同项目 E09M04B1/M06B1~M09B1 一致。

- **坑②**：明细组件 `editItem.vue` 的 `lst` 在 `created()` 里被置成本地空数组，而 `watch: lstitem` 没有 immediate，所以新增行 push 只落在子组件自己的数组上；保存前需 `if (this.$refs.elitem) { this.formdata.item = this.$refs.elitem.lst; }`（检测项目页签是 el-tabs 懒渲染，没点开过时 ref 不存在，必须判空）。

- **坑③**：`saveparam.js` 的 `paramsItem` 要与后端子表 Pojo 字段一一对应；`paramsItem` 为空数组的模块本就不走子表保存，不能只看"是不是传了 `{}`"来判断有没有这个坑。

- **坑④（PCB 专有）**：`$getParam` 有两份实现，取决于 `main.js` 怎么绑。`@inksyun/utils` 的 `count.getParam` **只处理 `item/mat/cash/draw/obj`，没有 `drl`（钻带）分支**；老项目 `web2/ui-omsweb-pcb/src/main.js` 用**项目本地** `src/utils/count.js` 覆盖了它，那份才有 drl。微服务版项目若直接绑 `inksutils.count.getParam`，`D91M09B1/D91M09B2`（作业指示）保存时 payload 的 `drl` 恒为空数组，表现为"钻带保存不上"。排查同类"某子表保存不上"问题，先 `rg "\$getParam" src/main.js` 看绑的是哪一份。
