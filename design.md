# 设计文档：多设备共享库存（方案② — 后端 + 数据库）

> 目标：所有电脑/手机登录后看到**同一份**库存数据。
> 范围：单账号（你自己），多设备同步；后端先跑在自己电脑上。
> 本文档为 Superpowers「Brainstorming」产出，需你签字确认后进入「Implementation Planning」。

---

## 1. 目标与功能范围

要支持当前前端（V1.2）已有的全部能力，后端必须覆盖：

- 物品主档 + 批次（同名聚合、FIFO 先用）
- 照片（每批次一张，沿用前端 base64 方式，最简）
- 低库存 / 临期 / 过期 状态计算（与前端逻辑一致）
- 回收站（软删除，30 天自动清理，可恢复/彻底删除）
- 消耗统计（每次"用掉"记一条日志，供近 30 天柱状图）
- 单账号登录（JWT），多设备共用同一账号

**不做**（本次）：多真实用户注册、权限隔离、图片独立文件服务（用 base64 存库，个人级够用）。

---

## 2. 架构

```
┌────────────┐   HTTPS/HTTP    ┌──────────────────┐   SQL    ┌──────────────┐
│  浏览器 PWA │ ── /api/** ──▶  │  后端 API 服务    │ ───────▶ │  数据库       │
│ (任意设备)  │ ◀─ JSON ──────  │ (SpringBoot/Node)│ ◀─────── │ MySQL/SQLite │
└────────────┘   Bearer Token  └──────────────────┘          └──────────────┘
      ↑ 只改这里：前端从"读本地"改成"调接口"
```

- 前端不再用 IndexedDB 存业务数据，改为调用后端 REST API。
- 数据唯一真源 = 数据库；所有设备看到同一份。
- 后端监听 `0.0.0.0`，同一 WiFi 下手机用电脑 LAN IP 访问；日后上云只需把后端部署到服务器。

---

## 3. 技术选型（双后端，同套 API）

| 角色 | 选型 | 能否在本环境测试 | 说明 |
|---|---|---|---|
| **生产后端（你选的）** | SpringBoot 3.2 + MyBatis-Plus + MySQL 8 | ❌ 无 JDK/MySQL | 完整代码，按你原 `backend_api_design.md` 落地 |
| **可运行参考后端** | Node.js + Express + SQLite | ✅ 可跑可测 | API 与上面完全一致，今天就能在你电脑跑通 |

> 两者暴露**完全相同的 REST 接口与返回结构**，前端无感知。你先用 Node 版验证"共享数据"跑得通，后续想换成 SpringBoot+MySQL 时，前端一行不用改。

---

## 4. 数据库设计（在现有 schema 上扩展）

沿用 `item` + `stock_batch` 两张表，扩展三处：

1. `stock_batch` 加 `photo TEXT` —— 存每张批次照片的 base64（免文件服务器）。
2. `item`、`stock_batch` 加 `deleted_at DATETIME` —— 回收站软删除（查询统一过滤 `IS NULL`）。
3. 新增 `consume_log` 表 —— 消耗统计用。

```sql
-- 在 inventory_schema_v1.sql 基础上追加/修改：

ALTER TABLE stock_batch
  ADD COLUMN `photo` TEXT DEFAULT NULL COMMENT '批次照片(base64), 个人级最简方案',
  ADD COLUMN `deleted_at` DATETIME DEFAULT NULL COMMENT '回收站软删除时间';

ALTER TABLE item
  ADD COLUMN `deleted_at` DATETIME DEFAULT NULL COMMENT '回收站软删除时间';

CREATE TABLE `consume_log` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `item_id`    BIGINT UNSIGNED DEFAULT NULL,
  `batch_id`   BIGINT UNSIGNED DEFAULT NULL,
  `name`       VARCHAR(100)    NOT NULL,
  `qty`        DECIMAL(10,2)   NOT NULL DEFAULT 1,
  `at`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_at` (`at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消耗日志(统计用)';
```

> SQLite 版去掉 `AUTO_INCREMENT`/`ENGINE` 等方言，用 `INTEGER PRIMARY KEY AUTOINCREMENT` + `TEXT` 即可，逻辑一致。

---

## 5. API 列表（复用原设计 + 扩展）

沿用 `backend_api_design.md` 的接口与 `Result<T>` 统一返回：

| 模块 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 认证 | POST | `/api/auth/login` | 单账号登录，返回 JWT |
| 物品 | POST | `/api/inventory` | 新增（同名 upsert + 建批次，事务） |
| 物品 | GET | `/api/items` | 列表（聚合库存+状态标志+回收站过滤） |
| 物品 | GET | `/api/items/{id}` | 主档 + 批次（FIFO） |
| 物品 | PUT | `/api/items/{id}` | 改主档配置 |
| 物品 | DELETE | `/api/items/{id}` | 软删（进回收站） |
| 批次 | PUT | `/api/batches/{id}` | 改批次（数量/日期/位置/照片） |
| 批次 | DELETE | `/api/batches/{id}` | 删单批次 |
| 消耗 | POST | `/api/batches/{id}/consume` | "用掉N"，归零删批次，并写 consume_log |
| 看板 | GET | `/api/dashboard` | 四区统计 + 明细 |
| 回收站 | GET | `/api/trash` | 已软删物品列表 |
| 回收站 | POST | `/api/trash/{id}/restore` | 恢复 |
| 回收站 | DELETE | `/api/trash/{id}` | 彻底删除 |
| 统计 | GET | `/api/consume-logs?days=30` | 近 N 天消耗（供柱状图） |

状态/四区计算、FIFO、"用掉1"重排逻辑与 `backend_api_design.md §5` 完全一致，由后端计算后下发，前端只负责展示。

---

## 6. 鉴权（单账号）

- 登录 `POST /api/auth/login` 校验固定 Owner 账号（环境变量 `OWNER_USER/OWNER_PASS` 或配置文件）。
- 成功返回 `Bearer` JWT；前端存 `localStorage` 的 token，之后每个请求带 `Authorization` 头。
- `JwtInterceptor` 拦截 `/api/**`，白名单 `/api/auth/login`；401 跳登录页。
- 因是单账号，无需 user 表、无需注册。

---

## 7. 前端改造方案

只动"数据层"，UI 与交互尽量不动：

1. 新增 `js/api.js`：封装所有 HTTP 调用（对应现 `db.js` 的接口形态：getActiveItems / addItem / updateItem / softDeleteItem / restoreItem / addConsumeLog / getConsumeLogs / login 等）。
2. `js/app.js`：把 `import ... from './db.js'` 换成 `./api.js`，调用改为 `await`；登录态从"本地多账号"改成"后端单账号登录"。
3. 新增 `API_BASE` 配置（默认同源 `/api`，也可填 `http://192.168.x.x:8080/api`），让前端能指向你电脑上的后端。
4. 照片、回收站、统计 UI 保持不变，数据来源换成接口返回。
5. 加一个"连接后端失败"的友好提示页。

> 改造后前端本身不再存业务数据，彻底变成"纯展示 + 调接口"，多设备天然共享。

---

## 8. 运行与部署（先在自己电脑）

**Node 版（立刻能跑）：**
1. 装 Node.js（你已有）。
2. `node server-api.mjs`（内置 SQLite 文件 `inventory.db`，自动建表）。
3. 前端 `API_BASE` 指向 `http://localhost:8080/api`（同机）或电脑 LAN IP（手机）。
4. 浏览器开前端，用 Owner 账号登录。

**SpringBoot 版（后续升级）：**
1. 装 JDK17 + Maven + MySQL，执行扩展后的 SQL 建库建表。
2. 配 `DB_*/JWT_*/OWNER_*` 环境变量，`mvn spring-boot:run`。
3. 同上加前端 `API_BASE`。

---

## 9. 验证方式与本环境限制

- ✅ 本环境可：写完 Node 版后用 `curl`/脚本实测每个接口（增/查/改/删/登录/统计），保证"共享数据"真正跑通。
- ❌ 本环境不可：运行 SpringBoot/MySQL，故 SpringBoot 版只能交付代码 + 启动说明，无法在此实测（需你在自己电脑按 §8 验证）。
- 前端改造会在 Node 后端上做端到端联调（浏览器内预览 → 调本地 Node API）。

---

## 10. 风险与取舍

- base64 照片存库：简单但占空间，个人级可接受；若日后图片多，再换 OSS/本地文件服务。
- 单账号无注册：符合"只有我自己"；若以后要多人，加 `sys_user` 表 + 注册即可（原设计已留扩展点）。
- 后端跑自己电脑：关机即停；要"随时访问"再上云服务器（参考 `deploy_guide.md`）。

---

### 请确认

1. 双后端（SpringBoot 生产 + Node 可运行参考）是否接受？
2. 照片用 base64 存库（最简）是否接受，还是你想要独立图片上传？
3. 前端改造为"纯调接口、不再本地存数据"，你认可吗？
