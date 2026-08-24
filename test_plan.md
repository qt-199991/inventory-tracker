# 物品库存清单 App V1.0 — 测试与稳定性优化方案

> 范围说明：V1.0 实际已交付的是 **PWA 本地版**（`index.html` + `js/logic.js` + `js/app.js` + `js/db.js`，IndexedDB 存储，43 个单测通过）；**Flutter 客户端**（`inventory_flutter/`）目前为骨架；**SpringBoot 后端**（`backend_api_design.md` + `inventory_schema_v1.sql`）为已定契约、未编码。
> 本方案的功能/单元用例以**已完成代码**为准执行；登录异常、接口报错、安卓/iOS 兼容性以**目标架构（Flutter+后端）**为准。所有修复片段均针对真实代码。

---

## 一、全量功能测试用例清单

### 1.1 用例设计原则
- 每条用例 = 前置条件 + 操作步骤 + 预期结果，可执行、可断言。
- 覆盖：正常路径、边界值、异常路径三类。
- 优先级：P0（核心不可失效）/ P1（重要）/ P2（健壮性）。

### 1.2 功能用例总表（P0/P1）

| 用例ID | 模块 | 操作步骤 | 预期结果 | 优先级 |
|---|---|---|---|---|
| TC-01 | 新增-自动模式 | 填名称「牛奶」、数量2、单位「瓶」、生产日期2026-08-01、保质期30天，提交 | 成功保存；过期日自动=2026-08-31；列表显示「牛奶」1张卡、第1批 | P0 |
| TC-02 | 新增-手动模式 | 切「直接填过期日」，填名称「面包」、数量1、过期日2026-08-20，提交 | 成功保存；不依赖生产日期；倒计时正确 | P0 |
| TC-03 | 新增-校验 | 名称为空提交 / 数量留空提交 | 拦截并提示「名称必填」「数量必填或至少0」，不写库 | P0 |
| TC-04 | 分组聚合 | 连续新增「牛奶」2次（不同批次标签「旧批」「新批」），数量各2、3 | 列表仅 1 张「牛奶」卡，总库存5，含2个批次 | P0 |
| TC-05 | FIFO排序 | 上一步中查看批次顺序 | 按过期日/生产日期升序，最早批标「先用这箱」、第1批/第2批 | P0 |
| TC-06 | 用掉1-递减 | 对数量3的批次点「用掉1」 | 数量变2，列表即时刷新 | P0 |
| TC-07 | 用掉1-删除 | 对数量1的批次点「用掉1」 | 弹窗「这箱已用完，删除？」确认后该批次删除；剩批次重排为第1批 | P0 |
| TC-08 | 用掉1-小数 | 数量0.5的批次点「用掉1」 | **不应出现负数**；应直接按“用完”删除（见修复 BUG-A） | P0 |
| TC-09 | 看板-已过期 | 新增过期日<今天的物品 | 「🔴已过期」区出现，统计+1 | P0 |
| TC-10 | 看板-即将过期 | 新增过期日在[今天,今天+expiringSoonDays]内 | 「🟠即将过期」区出现 | P0 |
| TC-11 | 看板-库存不足 | 总库存<阈值(如总2、阈值3) | 「🟡库存不足」区出现 | P0 |
| TC-12 | 看板-建议先用 | 同名2批次且最早批未过期 | 「🟢建议先用」区出现；最早批提示先用 | P0 |
| TC-13 | 自定义临期天数 | 牛奶设 expiringSoonDays=5 | 第5天内算即将过期；其余物品仍用默认7天 | P1 |
| TC-14 | 自定义阈值 | 牛奶设 lowStockThreshold=3 | 总库存<3才预警；不污染其他物品 | P1 |
| TC-15 | 编辑 | 打开某批次编辑，改数量/过期日，保存 | 数据更新、列表刷新 | P1 |
| TC-16 | 删除 | 删除某批次（非最后） | 仅删该批次，主档/其他批次保留 | P1 |
| TC-17 | 搜索 | 搜索框输入「牛奶」 | 仅显示含「牛奶」的卡 | P1 |
| TC-18 | 分类筛选 | 选分类「食品」 | 仅显示该分类物品 | P1 |
| TC-19 | 排序 | 切换「按过期日/按库存/按更新」 | 列表顺序相应变化 | P2 |
| TC-20 | 空数据 | 首次打开（无数据） | 显示「还没有物品」空态，不报错 | P1 |
| TC-21 | 持久化 | 新增后刷新页面 | 数据从 IndexedDB 恢复，不丢失 | P0 |
| TC-22 | 后端登录(目标) | POST /api/auth/login 正确/错误密码 | 正确返token；错误返401001 | P0 |
| TC-23 | 后端入库(目标) | POST /api/inventory 同名二次提交 | 主档复用、仅新增批次；事务原子 | P0 |
| TC-24 | 后端消费(目标) | POST /api/batches/{id}/consume amount=1 | 减1；归零删批次；返回 action | P0 |

### 1.3 异常/边界用例（P2，健壮性）
| 用例ID | 场景 | 预期 |
|---|---|---|
| TC-25 | IndexedDB 不可用（Safari 隐私模式/磁盘满） | 捕获异常，显示「本地存储不可用」提示而非白屏（见 BUG-L） |
| TC-26 | 数量为负/超长文本 | 前端拦截负数；长文本不撑破布局（截断/换行） |
| TC-27 | 过期日非法字符串 | resolveExpiry 返回 null，状态降级为 ok，不抛错 |
| TC-28 | 并发多次「用掉1」 | 每次基于最新库存，最终不出现负库存 |
| TC-29 | 网络超时(目标) | 10s 超时后提示「网络异常，请重试」，不卡死（见 BUG-P） |
| TC-30 | Token 过期(目标) | 401 自动清登录态并跳登录页（见 BUG-P） |

---

## 二、高频 BUG 预判 + 修复片段

### BUG-A（高危）`consumeOne` 小数/≤1 数量产生负库存
**位置**：`js/logic.js` `consumeOne`
**现象**：数量 0.5 点「用掉1」→ `qty!==1` 走 update，`quantity = 0.5-1 = -0.5`，写入负库存。
**修复**：
```js
export function consumeOne(item, now = new Date()) {
  const qty = Number(item.quantity) || 0;
  if (qty <= 0) return { action: 'none', item };
  if (qty <= 1) return { action: 'delete', item }; // 修：<=1 即视为用完删除，杜绝负数
  return { action: 'update', item: { ...item, quantity: qty - 1, updatedAt: now.toISOString() } };
}
```

### BUG-B（中）`needsUseFirstReminder` 与后端契约不一致
**位置**：`js/logic.js`；后端 `backend_api_design.md` 定义 suggestUseFirst = 批次数≥2 且**最早批未过期**。
**现象**：最早批已过期时，PWA 仍提示「建议先用」（应丢弃而非食用）。
**修复**：
```js
export function needsUseFirstReminder(group, now = new Date()) {
  const sorted = sortBatchesForUse(group.batches, now);
  if (sorted.length < 2) return false;
  const first = sorted[0];
  const exp = resolveExpiry(first);
  const d = daysUntil(exp, now);
  const usable = exp == null || (d != null && d >= 0); // 最早批仍可食用才建议先用
  return usable && Number(first.quantity) > 0;
}
```

### BUG-E（中/安全）`unit` 字段未转义 → 存储型 XSS
**位置**：`js/app.js` 看板「建议先用」区（line 185）、`fmtGroupStock`（line 59）、列表数量（line 243）。
**现象**：用户在「单位」输入 `<img src=x onerror=alert(1)>` 可被注入执行。
**修复**：统一对 `unit` 转义：
```js
// 现有 esc() 已覆盖文本，补一处即可：
const qty = `${Number(it.quantity) || 0}${esc(it.unit || '')}`; // line243
// 看板建议区 line185 改为：
`第1批（${esc(first.batchLabel || '最早批')}）剩 ${Number(first.quantity) || 0}${esc(first.unit || '')}，第2批 ${Number(second.quantity) || 0}${esc(second.unit || '')}`
// fmtGroupStock line59 返回 `${getGroupStock(group)}${esc(unit)}`
```

### BUG-H（中）提交缺少必填/数值校验
**位置**：`js/app.js` `submitForm`
**现象**：名称空、数量为负也能入库，造成脏数据。
**修复**（提交前校验）：
```js
const name = $('#f_name').value.trim();
const qtyRaw = $('#f_quantity').value;
if (!name) { alert('请填写物品名称'); return; }
if (qtyRaw === '' || isNaN(Number(qtyRaw)) || Number(qtyRaw) < 0) {
  alert('数量须为不小于 0 的数字'); return;
}
```

### BUG-L（高危）IndexedDB 调用无 try/catch → 白屏/提交静默失败
**位置**：`js/app.js` `start()/load()/submitForm()/consumeItem()`
**现象**：隐私模式/磁盘满时 `initDB`/`addItem` 抛错未被捕获，`start()` 中断 → 页面空白；提交失败用户无感知。
**修复**（包装 + 友好提示）：
```js
async function safeLoad() {
  try { await load(); }
  catch (e) {
    console.error(e);
    const el = document.querySelector('#emptyHint');
    if (el) { el.hidden = false; el.textContent = '本地存储不可用，请检查浏览器设置后重试。'; }
  }
}
async function start() {
  try { await initDB(); }
  catch (e) { /* 同上提示 */ return; }
  bind();
  await safeLoad();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
// submitForm / consumeItem 中 await 处同样包 try/catch 并 alert 失败原因
```

### BUG-P（高危，Flutter 目标）`api_client` 不处理 401 / 业务码非 0
**位置**：`inventory_flutter/lib/services/api_client.dart`
**现象**：登录异常、Token 过期无跳转；后端返回 `code!=0` 也不抛错，UI 无法感知。
**修复**（补全 onError + 统一抛错 + 401 跳转）：
```dart
// 1) 请求后判定业务码
Future<ApiResponse<T>> _parse(Response res, T? Function(dynamic)? fromData) {
  final api = ApiResponse.fromJson(res.data, fromData);
  if (!api.success) throw ApiException(api.code, api.message); // 业务失败即抛
  return api;
}
// 2) onError 拦截 401 并清登录态
onError: (DioException e, handler) async {
  if (e.response?.statusCode == 401) {
    await Storage.clear();
    // 通过全局 navigatorKey 跳转登录页（在 main 注入）
    navigatorKey.currentState?.pushNamedAndRemoveUntil(Routes.login, (_) => false);
  }
  handler.next(e);
},
// 3) get/post 内用 _parse 包裹返回值；对 DioException 透传友好文案
```

### BUG-X（契约一致性，跨端）字段命名不一致
**现象**：PWA 用 `batchLabel`/`note`；后端表 `batch_tag`/`notes`；Flutter 模型用 `batchTag`/`notes`。字段名错位会导致「数据提交失败/入库字段丢失」。
**约定**：全链路统一为后端契约 `batchTag` / `notes`；PWA 在 `submitForm` 与渲染处做映射（`batchLabel→batchTag`、`note→notes`），或后续 PWA 直接改名。测试须覆盖字段双向映射。

### 后端侧补充（目标，防「数据提交失败」）
- `POST /api/inventory` 用 `@Transactional` 包 upsert+建批次；`consume` 同样事务化并加「减后 quantity<0 则拒绝」守卫（镜像 BUG-A）。
- 入参 `@Valid`：name 非空、quantity≥0、过期信息二选一（已在 `backend_api_design.md §2.3` 约定，编码时落地）。

---

## 三、兼容性测试标准（Android / iOS）

### 3.1 系统版本矩阵
| 平台 | 最低支持 | 重点验证版本 | 说明 |
|---|---|---|---|
| Android | minSdk 23（Android 6.0） | 8.0 / 10 / 12 / 13 / 14 | 覆盖 95%+ 活跃设备；旧版验证 WebView/存储权限 |
| iOS | deployment target 13.0 | 15 / 16 / 17 / 18 | 验证安全区、隐私清单、后台刷新策略 |

### 3.2 屏幕尺寸 / 形态适配
| 类型 | 示例分辨率 | 验证点 |
|---|---|---|
| 小屏手机 | 360×640 / 320pt(SE) | 不溢出、按钮可点、文本不截断 |
| 主流手机 | 390×844 / 393pt(15) | 主链路完整 |
| 大屏/平板 | 768×1024 / 810pt(iPad) | 布局不拉伸、合理留白 |
| 折叠屏 | 展开 717× unfolded | 横竖切换不丢状态、不白屏 |

### 3.3 适配检查清单
- [ ] **安全区**：刘海/挖孔/底部 Home 指示条不被遮挡（`SafeArea`）。
- [ ] **键盘遮挡**：表单输入时 `resize`/`scroll` 到位，不挡提交按钮。
- [ ] **字体缩放**：系统字号调到最大（iOS 大字号 / Android 200%）不破版。
- [ ] **深色模式**：状态色标（红/橙/黄/绿）在暗色下对比度达标（WCAG AA）。
- [ ] **横竖屏**：旋转后列表/表单状态保留。
- [ ] **权限**：Android 存储/通知权限首次弹窗不崩溃；拒绝后有降级提示。
- [ ] **低带宽/弱网**：接口超时走 BUG-P 友好提示，不卡死。

---

## 四、代码安全与逻辑漏洞校验 — 执行指令模板

### 4.1 Flutter / Dart 端
```bash
# 1) 静态分析与代码规范
flutter analyze
dart analyze lib

# 2) 单元 + Widget 测试（TDD 红绿循环）
flutter test --coverage
genhtml coverage/lcov.info -o coverage/html   # 生成覆盖率报告

# 3) 集成测试（多端真机/模拟器）
flutter test integration_test/app_test.dart

# 4) 依赖安全审计
flutter pub outdated
dart pub global activate pana && pana .        # 包质量/安全评分

# 5) 兼容性自动化矩阵（CI 多设备）
flutter test -d emulator-5554   # Android
flutter test -d iPhone 15       # iOS（需 macOS）
```

### 4.2 PWA / Web 端（已交付代码）
```bash
# 1) JS 语法/规范（项目若引入 npm）
npx eslint js/
# 2) 运行既有单元测试（logic/db，43+5 用例）
node --test tests/
# 3) 依赖审计
npm audit
# 4) 手动 XSS 走查清单（必做）
#    - 所有 innerHTML 拼接的用户字段均经 esc()：name/category/location/note/batchLabel/unit
#    - 重点复核 BUG-E 中 unit 转义是否到位
```

### 4.3 后端（目标，SpringBoot）
```bash
# 1) 编译 + 单测
mvn clean test
# 2) 静态安全扫描（SQL 注入 / 空指针）
mvn com.github.spotbugs:spotbugs-maven-plugin:check
# 3) SonarQube 质量门禁
mvn sonar:sonar -Dsonar.projectKey=inventory
# 4) SQL 注入走查：确认 MyBatis 全部使用 #{ } 占位，禁止 ${ } 拼接
# 5) 接口契约校验：用 backend_api_design.md 的 JSON 示例跑 Postman/Newman 集合
newman run inventory.postman_collection.json
```

### 4.4 逻辑漏洞校验清单（人工 + 自动）
- [ ] 负库存：所有扣减路径（PWA `consumeOne`、后端 `consume`）守卫 `quantity≥0`。
- [ ] 除零/NaN：聚合（总库存、阈值 min）对空值/非法数有兜底。
- [ ] 时区：过期日计算统一按「当地 0 点」（`daysUntil` 已处理），后端用 `serverTimezone=Asia/Shanghai`。
- [ ] 越权：单用户无多租户，但后端删除/编辑须校验资源归属（当前 Owner 单账号，后续多用户必加）。
- [ ] 注入：前端 esc 全覆盖；后端参数化查询；Token 不出现在 URL/日志。
- [ ] 事务：入库/消费/删除必须原子，失败回滚。

---

## 五、落地优先级（直接提升稳定性）
1. **立即修**：BUG-A、BUG-L、BUG-E（负库存/白屏/XSS，直接影响可用性与安全）。
2. **跟进修**：BUG-B、BUG-H、BUG-P、BUG-X（一致性 + 目标架构健壮性）。
3. **测试补齐**：把 TC-01~TC-30 落到 `flutter test` / `node --test`；CI 跑 §4 指令模板。
4. **兼容性**：按 §3 矩阵在真机跑一遍主链路。

> 修复均「小改动、低风险、可单测验证」，符合「简单高效、直接优化稳定性」约束。
