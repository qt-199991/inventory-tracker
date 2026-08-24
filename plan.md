# 物品库存清单 App — 实现计划

> 遵循 TDD（先写测试，再写实现），纯静态 PWA，无需构建步骤。

## 任务分解

### T1 — 项目骨架
- 建目录 `css/ js/ tests/ icons/`
- `index.html`：移动优先单页外壳，含看板区、列表区、表单弹层挂载点
- `manifest.webmanifest` + `sw.js`：PWA 安装与离线
- `icons/`：192/512 PNG 图标（用 Pillow 生成）

### T2 — 纯逻辑 `js/logic.js`（ESM，可测）
函数：
- `computeExpiry(productionDate, shelfLifeDays)`
- `daysUntil(date, now)`
- `getItemStatus(item, now)`（用 `item.expiringSoonDays`）
- `isLowStock(item)`
- `groupByName(items)`（批次归组）
- `summarize(items, now)`（看板统计：总数/过期/临期/不足）

### T3 — 逻辑测试 `tests/logic.test.mjs`（先写，Red）
覆盖：自动算过期、已过期/临期判定、库存不足、批次归组、统计。

### T4 — 存储 `js/db.js`（ESM，IndexedDB 封装）
- `initDB()`、`addItem`、`getAllItems`、`updateItem`、`deleteItem`
- 使用全局 `indexedDB`（浏览器 / fake-indexeddb 均可）

### T5 — 存储测试 `tests/db.test.mjs`（先写，Red）
用 `fake-indexeddb/auto`，验证增/查/改/删与持久化语义。

### T6 — 应用层 `js/app.js`（ESM，浏览器）
- 状态管理 + 看板渲染（🔴🟠🟡 + 统计）
- 列表按名称分组（批次）+ 展开
- 新增/编辑表单（两种过期模式、阈值自定）
- 搜索 + 分类 + 状态筛选
- 删除二次确认

### T7 — 样式 `css/styles.css`
移动优先、大按钮、状态色标、卡片式布局。

### T8 — 验证与交付
- `node --test` 跑 logic + db 测试（证据）
- 本地起静态服务器供预览
- 更新 `design.md` 验收勾选，`final_report.md` 总结

## 技术约束
- 纯 HTML/CSS/原生 JS（ESM），无打包器
- 逻辑与存储为 ESM，便于 Node 测试
- 依赖（仅测试期）：`fake-indexeddb`、`pillow`（图标），不进运行时
