# 库存清单 App V1.1 开发总结（A/B/C/D 全量实现）

按 Superpowers 方法论（任务分解 + TDD + 证据驱动）完成用户提出的 A/B/C/D 四项需求。设计在此前已锁定，故直接进入实现，以测试作为验收证据。

## 已实现功能

### A. 照片点击看大图
- 列表分组卡片的缩略图可点击，弹出全屏 lightbox 预览（点空白 / ✕ 关闭）。
- 改动：`index.html` 加 `#lightbox`；`app.js` 加 `openLightbox/closeLightbox`，`renderList` 缩略图加 `data-act="photo"` 事件委托；`css` 加 `.lightbox`。

### B. 切换账号菜单
- 顶部用户按钮改为弹出下拉，列出本机全部账号，点击**免密切换**；底部保留「退出登录」。
- 改动：`index.html` 加 `#userMenu`；`app.js` 加 `openUserMenu/switchUser`，并把 `getAllUsers` 加入导入。

### C1. 用掉数量可调
- `logic.js consumeOne(item, amount=1)` 支持一次扣 N 个（≤N 即删，杜绝负库存）。
- 列表「用掉」按钮弹数量输入框，确认后扣减。
- 新增 4 条逻辑测试覆盖扣 N 语义。

### C2. 待补货清单
- 首页加「🛒 待补货清单」按钮，弹窗列出低库存 / 临期物品及建议购买数量，支持复制清单。

### C3. 数据导出 / 导入
- 右上角 ⚙ 打开数据面板：导出全部物品 + 账号为 JSON 文件；导入 JSON 恢复（换机不丢）。

### D. 本机稳定部署
- `deploy-local.md`：三种方式（双击 `file://` / 本机 `http.server` / 生产 Nginx）。
- 桌面 `run-local-server.bat`：一键起本地服务（自动选 Python 或 Node），访问 `http://localhost:8000/inventory.html`。

## 技术改动文件
- `js/logic.js`：`consumeOne` 支持 `amount`
- `js/app.js`：A/B/C1/C2/C3 全部交互 + `getAllUsers` 导入
- `index.html`：`#lightbox` / `#userMenu` / `#consumeModal` / `#restockModal` / `#dataModal` / `#dataBtn` / `#restockBtn` / `#importFile`
- `css/styles.css`：上述组件样式
- `tests/logic.test.mjs`：+4 用例

## 测试与验证
- `node --test`：**49/49 通过，0 失败，0 取消**（含 C1 扣 N 的 4 个新回归用例）。
- 单文件预览 `standalone.html` 已重建（73KB），并复制到桌面 `inventory.html` 覆盖旧版。

## 如何运行 / 演示
1. 桌面双击 `inventory.html`（`file://`），或双击 `run-local-server.bat` 后访问 `http://localhost:8000/inventory.html`。
2. 注册账号 → 添加带照片物品 → 点缩略图看大图 → 点「用掉」扣 N → 点 🛒 看补货清单 → 点 ⚙ 导出 / 导入。
3. 切换账号：点顶部用户名下拉选其他账号（免密）。

## 已知限制
- `file://` 下个别浏览器存储受限，重要数据建议用方式二（本地服务器）或应用内导出备份。
- 多用户仍为「本机多账号隔离」，非云端同步（云端需 V2.0 + 后端，见 `deploy_guide.md`）。
