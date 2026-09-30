# 后端异步任务 + 轮询标准模式与 Controller 编码规范

> 触发：**写"后端异步任务 + 前端轮询"接口、新增 Controller 接口或 mapper 方法时先读再动手**。
> 标准样板：`0-SvcCode\OMS\inks-service-store-master\inks-service-std-store` 的
> `controller\D04M08B1Controller.java`（`quickBackflush` / `quickBackflushByMat` / `getCreateState`）与
> `service\impl\MatRequisitionServiceImpl.java`（`createAsync` / `createAsyncByMat` / `doCreateAsync`，约 895-1004 行）。
> 以下代码均摘自真实代码，照抄即可。

---

## 一、标准化轮询：三段式（标准）

整体流程：**提交接口发 uuid → @Async 任务写状态到 Redis → 轮询接口按 uuid 读状态**。状态 key 用常量前缀 + uuid，如 `StoreConstant.ASYNC_REQUISITION_STATE = "requisition_state:"`（`constant\StoreConstant.java` 第 12 行）。

### 1. 提交接口（POST）

只做两件事：生成 `redisKey`、触发 `@Async` 方法，立即返回 key，**不在提交接口里同步等业务完成**。

```java
// D04M08B1Controller.java
@RequestMapping(value = "/quickBackflushByMat", method = RequestMethod.POST)
@PreAuthorize(hasPermi = "Mat_Requisition.Edit")
public R<String> quickBackflushByMat(@RequestBody QuickBackDto quickBackDto) {
    LoginUser loginUser = tokenService.getLoginUser(ServletUtils.getRequest());
    try {
        String redisKey = UUID.randomUUID().toString();
        this.matRequisitionService.createAsyncByMat(quickBackDto, redisKey,
                loginUser.getTenantid(), SecurityUtils.getToken(ServletUtils.getRequest()));
        return R.ok(redisKey);
    } catch (Exception e) {
        return R.fail(e.getMessage());
    }
}
```

注意第四个参数：把当前请求的 token 传进异步方法（见下文 `setAuthRequestContext`）。

### 2. 异步任务（service 层，`@Async + @Transactional`）

```java
// MatRequisitionServiceImpl.java（骨架摘录）
@Async
@Transactional
public void createAsyncByMat(QuickBackDto dto, String redisKey, String tid, String authCode) {
    doCreateAsync(dto, redisKey, tid, authCode, true);
}

private void doCreateAsync(QuickBackDto dto, String redisKey, String tid, String authCode, boolean byMat) {
    // ① 绑定最小请求上下文：异步线程无 ServletRequest，
    //    @InksConfig 切面需通过 tokenService.getLoginUser() 取登录用户
    setAuthRequestContext(authCode);
    Map<String, Object> state = new HashMap<>();
    state.put("code", "100");
    state.put("msg", "任务开始处理");
    state.put("startTime", DateUtils.parseDateToStr("yyyy-MM-dd HH:mm:ss", new Date()));
    redisService.setCacheObject(StoreConstant.ASYNC_REQUISITION_STATE + redisKey, state, 120L, TimeUnit.MINUTES);
    try {
        // ...业务循环...
        // ② 成功状态
        state.put("code", "200");
        state.put("msg", ...);
        state.put("endTime", ...);
        state.put("count", bills.size());
        state.put("skipCount", skipDetails.size());
        state.put("skips", skipDetails);   // 每条"哪条、为什么跳过"
        state.put("bills", bills);         // 含 billid、refno
        redisService.setCacheObject(StoreConstant.ASYNC_REQUISITION_STATE + redisKey, state, 30L, TimeUnit.MINUTES);
    } catch (Exception e) {
        // ③ 异常被 catch 后 @Transactional 不会自动回滚，必须显式标记，否则留半成品数据
        try {
            TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
        } catch (Exception rollbackEx) {
            log.warn("标记事务回滚失败:{}", rollbackEx.getMessage()); // 事务已不在作用域时忽略
        }
        log.error("异步任务处理失败", e);
        state.put("code", "500");
        state.put("msg", "任务处理失败...");
        state.put("endTime", ...);
        state.put("skipCount", skipDetails.size());
        state.put("skips", skipDetails);
        state.put("error", e.getMessage());
        redisService.setCacheObject(StoreConstant.ASYNC_REQUISITION_STATE + redisKey, state, 30L, TimeUnit.MINUTES);
    } finally {
        // ④ 清理线程上下文，避免线程池复用串上下文
        RequestContextHolder.resetRequestAttributes();
    }
}
```

`setAuthRequestContext` 的实现（同文件约 1050 行）：用 `Proxy.newProxyInstance` 动态代理出一个只响应 `getHeader("Authorization")`（返回传入 token）的 `HttpServletRequest`，塞进 `RequestContextHolder`。新写异步任务直接复用这个私有方法（或照抄）。

关键点回顾：

- 入口先 `setAuthRequestContext(token)`——不绑的话，异步线程里任何走 `@InksConfig` 切面 / `tokenService.getLoginUser()` 的代码拿不到用户直接炸。
- 任务一开始就写 `code=100` 初始状态（TTL 120 分钟），保证前端轮询立刻有东西可读。
- 成功 / 失败状态 TTL 30 分钟，靠过期自动清理。
- **catch 里必须 `setRollbackOnly()`**——这是最容易漏的一行，漏了就是异常路径留半成品数据。
- finally 里 `RequestContextHolder.resetRequestAttributes()`。

### 3. 轮询接口（GET）

```java
// D04M08B1Controller.java
@RequestMapping(value = "/getCreateState", method = RequestMethod.GET)
public R<Map<String, Object>> getCreateState(String rediskey) {
    Map<String, Object> state = redisService.getCacheObject(StoreConstant.ASYNC_REQUISITION_STATE + rediskey);
    return R.ok(state);
}
```

约定：`code=100` 进行中 / `200` 成功（`bills` 含 billid、refno）/ `500` 失败（`error` 含原因）。前端轮询直到 `code != 100`。轮询接口**不加 `@PreAuthorize`**（只读状态、无敏感数据）。

### 4. 状态存储的硬性约定

- **必须存独立 Redis key（常量前缀 + uuid）并带 TTL，不能用 hash field**——hash 的 field 无法单独设置过期，任务多了 key 只堆不清。
- `redisService.getCacheObject` 是泛型 `<T> T`，须以 `Map` 变量接收让 T 推断为 Map，再 `R.ok` 包装。

---

## 二、Controller / 命名编码规范（四条）

### 规范① getLoginUser 必须写在 try 之外

```java
// 标准（样板里所有接口都这么写）
LoginUser loginUser = tokenService.getLoginUser(ServletUtils.getRequest());
try {
    ...
} catch (Exception e) {
    return R.fail(e.getMessage());
}
```

**为什么**：登录用户解析失败属于认证层错误，应让框架层返回真实状态码；写进 try 里会被 catch 吞成业务 `R.fail`，掩盖真实状态码。**检查**：新接口写完看一眼，`getLoginUser` 是否在 try 前单独一行。

### 规范② `catch (Exception e) { return R.fail(e.getMessage()); }` 会吞状态码（已知坑）

所有异常被统一压成 `R.fail`，认证失败、参数错误、业务异常在响应上全部同貌，原始状态码信息丢失。历史代码大量如此写（不动它们），但：**新代码要意识到这个写法会吞状态码**；排查"前端拿不到正确状态码 / 不同错误长一个样"问题时，先想到它。

### 规范③ 对外返回字段一律小写开头

返回给前端的字段名（state Map 里的 `code` / `msg` / `startTime` / `endTime` / `count` / `skipCount` / `skips` / `bills` / `error`，以及接口参数 `rediskey`）一律小写开头，不与大写驼峰混用。

### 规范④ mapper 方法名用完整单词，不自造缩写

标准：`selectWorksheetMatByWorkId`、`selectSubcontractMatByWorkId`、`getEntityByStoreGoods` 这类全词拼写。反例：`updateRequAcceFinish`（Requ/Acce 自造缩写）。新 mapper 方法照全词风格命名。

---

## 三、动手前检查清单（写新异步轮询接口时逐条对照）

- [ ] 提交接口只生成 uuid + 调 `@Async` 方法 + `return R.ok(redisKey)`，没有同步业务逻辑
- [ ] 调 `@Async` 方法时把 `SecurityUtils.getToken(ServletUtils.getRequest())` 传了进去
- [ ] 异步方法标了 `@Async + @Transactional`，入口第一行 `setAuthRequestContext(token)`
- [ ] 任务入口立即写了 `code=100` 初始状态（TTL 120 分钟）
- [ ] 状态 key = 常量前缀 + uuid，独立 key 带 TTL，没用 hash field
- [ ] catch 里 `TransactionAspectSupport.currentTransactionStatus().setRollbackOnly()`
- [ ] finally 里 `RequestContextHolder.resetRequestAttributes()`
- [ ] 轮询接口 GET、不加 `@PreAuthorize`、以 `Map` 接收 `getCacheObject` 后 `R.ok` 返回
- [ ] 状态字段全部小写开头（code/msg/startTime/endTime/count/skipCount/skips/bills/error）
- [ ] `getLoginUser` 在 try 之外单独一行
- [ ] 新 mapper 方法名是完整单词，无自造缩写
