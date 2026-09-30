# 云打印 / 锐浪(Grid++Report) printWebBill 报文

> 触发：改 printWebBill、云打印报文、锐浪报表模板对接、打印次数、MQTT 打印下发、**子表打印不出来 / 模板表名排查**时读本文件。子报表专项案例见 `cloud-print-subreport-case.md`。
> 来源：原 `~/.claude/CLAUDE.md` 第 15 条，2026-09-16 迁移。实测环境：`inks-service-oem-k1038` + `mf-cusweb-k1038-sale` E09 系列。

---

## 1. 两种报文结构

选哪种**取决于锐浪模板里声明的记录集名，必须完全一致且大小写敏感**：

- **单明细表（标准，多数模块）**：`{"report":{"xml":{"row":[明细行...]},"_grparam":{表头}}}`，明细网格绑 `row`、表头字段取 `_grparam.xxx`（参考 `OMS/inks-service-sale-master` 的 `BusMachiningController.printWebBill`）。
- **多明细表**：`{"xml":{"Item":[...],"Chemical":[...],"Mech":[...],"Master":{表头}}}`——根节点就是 `xml`，各子表是 xml 下的独立节点（**首字母大写**，勿用 item/master 小写），表头放 `Master` 节点，没有 report 外层、没有 `_grparam`（参考 sale 的 `BusDepositController.printWebBill`）。

## 2. 坑①（最容易踩，会打出几十行空行）

表头 map 必须剔除子表 List 与原始 JSON 串。`BeanUtils.beanToMap(pojo)` 会把 pojo 的 `item`(List<子表 Pojo>)、`xxxJson`(String) 一并带进表头 → `Master` 元素下多出重复的 `<item>` 子元素（fastjson 还会写 `"exts":{"$ref":"$.xml.item[0].exts"}`，看到 `$ref` 就是这个病），客户端把 `Master` 的子元素当重复元素按行渲染，明细会多出 70~80 行、除 item 那两行外全是空行。

修：`map.remove("item"); map.remove("chemicalJson"); map.remove("mechJson");`，需要原文就另存 `xxxJsonRaw`。

## 3. 坑②

`mapPrint` 必须 put `sn`；本地打印判断要含 `local`/`localsec`/`localthi`，只判 `"local"` 会漏。

## 4. 坑③

打印里不要调通用 `update()` 刷 printcount——这类 update 是"先按 parentid 删子表、再按 `pojo.getItem()` 重插"，打印时 item 为空会把明细删光；要刷次数就走专用的 `updatePrintcount`。

## 5. 坑④（子表空白 / 只有表头没有行：同一个 XML 表名在模板里只能填一处）

2026-09-24 于 E09M06B1（挤压生产原始记录）实测确认。

锐浪按 XML 表名匹配记录集时，**一个表名只认第一处，被先匹配到的对象消耗掉，后面的对象就拿不到**。所以同一个表名在模板里出现两次以上，必然有对象是空表。

两种踩法：

| 踩法 | 重复的两处 | 现象 |
|---|---|---|
| 子报表内部重复 | 内嵌 Report 的 **Report 级 `XmlTableName`**（设计器里是「子报表对象 → 报表主对象 → xml 表名」）+ 子报表自己的 **`DetailGrid.Recordset.XmlTableName`** | 子表**列标题画得出来，行数恒为 0** |
| 主报表明细网格与子报表撞名 | 主报表 `DetailGrid.Recordset.XmlTableName` + 某个子报表的记录集用了同一个表名 | 被撞的那个子表**整张表连列标题都不显示** |

修法：**每个 XML 表名在模板里只保留 `DetailGrid.Recordset.XmlTableName` 一处**，Report 级不要写；验证用的临时明细网格用完必须删掉。

> 排查口诀：打开模板数一数，每个 `XmlTableName` 出现几次，>1 次就是病根。别先去怀疑后端报文——报文里每个节点名出现一次就够了，**这个坑纯在模板侧**。

体检脚本：

```python
# 统计模板（含所有子报表）里每个 XmlTableName 的出现次数，>1 即有问题
import json, glob, collections

def subs(r):
    for band in ('ReportHeader', 'PageHeader'):
        for sec in r.get(band, []) or []:
            for x in sec.get('Control', []) or []:
                if x.get('Type') == 'SubReport':
                    yield x['Report']
                    yield from subs(x['Report'])

for f in glob.glob('*.grf'):
    d = json.loads(open(f, encoding='utf-8-sig').read())
    c = collections.Counter()
    for r in [d] + list(subs(d)):
        rs = r.get('DetailGrid', {}).get('Recordset', {})
        if rs.get('XmlTableName'):
            c[rs['XmlTableName']] += 1
        if r.get('XmlTableName'):          # Report 级，重复的主要来源
            c[r['XmlTableName']] += 1
    dup = {k: v for k, v in c.items() if v > 1}
    print(f, dict(c), '重复:' + str(dup) if dup else 'OK')
```

配套的完整排查案例（E09M06B1 各版本对照、被排除的怀疑点）见 `cloud-print-subreport-case.md`。

## 6. 排查手法

把 ptJson 打日志或抓前端 WS 下发的 data，直接比对节点名和行数，比在锐浪设计器里猜快得多。

另注意：**后端改动必须重新编译部署**，别拿旧包的报文下结论（报文节点大小写与当前代码不一致就说明跑的是旧包）。
