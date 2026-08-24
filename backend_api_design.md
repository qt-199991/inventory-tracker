# 个人物品库存清单 V1.0 — 后端接口与业务逻辑方案

> 配套文档：`inventory_schema_v1.sql`（已建表）、前端 PWA 页面结构。
> 设计基调：**单用户、本地优先、极简**。仅覆盖 V1.0 业务，无用户表、无注册、无文件上传（详见 §6）。

---

## 1. 技术栈与运行环境

### 1.1 技术栈（轻量 SpringBoot 版）
| 组成 | 选型 | 说明 |
|---|---|---|
| 框架 | Spring Boot 3.2.x | 主框架，内嵌 Tomcat |
| 语言 | Java 17 (LTS) | 运行环境 |
| 构建 | Maven 3.8+ | 依赖管理 |
| 持久层 | MyBatis-Plus 3.5.x | 极简 CRUD，减少样板代码 |
| 数据库 | MySQL 5.7+ / 8.0 | 字符集 utf8mb4 |
| 鉴权 | JWT (jjwt 0.12.x) | 无状态 Token |
| 校验 | Spring Validation | `@Valid` 参数校验 |
| 文档 | springdoc-openapi 2.x | 自动 Swagger |
| 工具 | Lombok | 减少 getter/setter 样板 |

### 1.2 运行环境要求
- JDK 17+，Maven 3.8+，MySQL 5.7/8.0 实例可连。
- 已执行 `inventory_schema_v1.sql` 建库建表。
- 环境变量（或 yml 配置）：`DB_URL / DB_USER / DB_PASS / JWT_SECRET / JWT_EXPIRATION(秒,默认86400) / OWNER_USER / OWNER_PASS`。

### 1.3 项目结构
```
inventory-backend/
├── pom.xml
└── src/main/java/com/example/inventory/
    ├── InventoryApplication.java
    ├── config/        # JwtInterceptor / WebMvcConfig / SwaggerConfig
    ├── controller/    # Auth / Inventory / Item / Batch / Dashboard
    ├── service/ + impl/
    ├── mapper/        # ItemMapper / StockBatchMapper
    ├── entity/        # Item / StockBatch (对应两张表)
    ├── dto/           # req(入参) / resp(出参)
    ├── common/        # Result / ErrorCode / BizException
    └── util/          # JwtUtil / DateUtil(过期日解析)
└── src/main/resources/
    ├── application.yml
    └── mapper/*.xml
```

### 1.4 application.yml 关键配置
```yaml
server:
  port: 8080
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/inventory?useSSL=false&serverTimezone=Asia/Shanghai&characterEncoding=utf8mb4
    username: ${DB_USER:root}
    password: ${DB_PASS:root}
    driver-class-name: com.mysql.cj.jdbc.Driver
mybatis-plus:
  global-config:
    db-config:
      id-type: auto
      table-underline: true   # 实体驼峰 <-> 表字段下划线
jwt:
  secret: ${JWT_SECRET:change-me-in-prod}
  expiration: 86400
```

---

## 2. 通用接口规则

### 2.1 统一返回格式 `Result<T>`
```json
{ "code": 0, "message": "success", "data": { }, "timestamp": 1690000000000 }
```
- `code=0` 成功；非 0 为业务/系统错误码。
- 列表类接口 `data` 为数组；分页类 `data` 含 `{ list, total, page, size }`。

### 2.2 统一错误码
| code | HTTP | 含义 |
|---|---|---|
| 0 | 200 | 成功 |
| 400001 | 400 | 参数校验失败（含字段级 message） |
| 401001 | 401 | Token 缺失/无效/过期 |
| 404001 | 404 | 资源不存在（物品/批次 ID 无效） |
| 409001 | 409 | 数据冲突（如修改后名称重复） |
| 500000 | 500 | 系统异常 |

错误示例：
```json
{ "code": 400001, "message": "参数校验失败: name 不能为空", "data": null, "timestamp": 1690000000000 }
```

### 2.3 参数非空校验
- 所有写接口入参用 `@Valid` + `@NotBlank`/`@NotNull`/`@DecimalMin`。
- 校验失败统一返回 `400001`，message 列出首条失败原因（或字段 map）。
- 关键约束：`name` 非空；`quantity` > 0；过期信息二选一（见 §5.1）。

### 2.4 Token 登录校验
- 登录：`POST /api/auth/login` 校验 Owner 账号，返回 `Bearer` JWT（无状态，含 subject=username、exp）。
- 校验链路：`JwtInterceptor` 拦截 `/api/**`（白名单 `/api/auth/login`），取 `Authorization: Bearer <token>`，无效/过期返回 `401001`。
- Token 失效策略：过期时间由 `jwt.expiration` 控制，前端在 401 后跳登录页。

---

## 3. 接口总览（按模块）

| 模块 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 认证 | POST | `/api/auth/login` | Owner 登录获取 Token |
| 入库/新增 | POST | `/api/inventory` | 新增物品（同名自动复用主档 + 建批次，事务） |
| 物品查询 | GET | `/api/items` | 列表（筛选+聚合库存+状态标志） |
| 物品详情 | GET | `/api/items/{id}` | 主档 + 其下批次（FIFO 排序） |
| 物品编辑 | PUT | `/api/items/{id}` | 改主档配置（名称/分类/阈值等） |
| 物品删除 | DELETE | `/api/items/{id}` | 删主档（级联删批次） |
| 批次编辑 | PUT | `/api/batches/{id}` | 改批次字段（数量/日期/位置…） |
| 批次删除 | DELETE | `/api/batches/{id}` | 删单个批次 |
| 消费扣减 | POST | `/api/batches/{id}/consume` | “用掉1”（可指定数量，归零删批次） |
| 看板 | GET | `/api/dashboard` | 四区统计 + 明细 |

---

## 4. 详细接口设计

### 4.1 认证模块
**POST `/api/auth/login`**
- 入参：
```json
{ "username": "owner", "password": "123456" }
```
- 返回：
```json
{ "code": 0, "message": "success",
  "data": { "token": "eyJhbGciOi...", "tokenType": "Bearer", "expiresIn": 86400, "username": "owner" },
  "timestamp": 1690000000000 }
```
- 业务逻辑：比对配置的 Owner 账号（`OWNER_USER/OWNER_PASS` 或 yml）；成功签发 JWT；V1.0 **不提供注册**（单用户），如需多用户后续加 `sys_user` 表并开放注册。

### 4.2 入库 / 新增模块
**POST `/api/inventory`**  （前端“新增物品”表单提交入口）
- 入参：
```json
{
  "name": "牛奶",
  "category": "食品",
  "unit": "瓶",
  "defaultLocation": "冰箱上层",
  "expiringSoonDays": 5,
  "lowStockThreshold": 3,
  "quantity": 2,
  "location": "冰箱上层",
  "productionDate": "2026-08-01",
  "shelfLifeDays": 30,
  "expiryDate": null,
  "batchTag": "促销装",
  "notes": "临期前喝完"
}
```
- 返回：`{ "code":0, "data": { "item": {...}, "batch": {...} }, ... }`
- 核心业务逻辑（事务 `@Transactional`）：
  1. 校验 `name` 非空、`quantity>0`；解析过期日（见 §5.1）——二选一缺失则 `400001`。
  2. **同名主档 upsert**：`name` 不存在则新建 `item`（写入分类/单位/默认位置/临期天数/阈值）；已存在则**保留原主档配置**，仅新建批次（避免误改阈值）。
  3. 新建 `stock_batch`，`item_id`=主档 ID，`expiry_date`=解析结果，其余字段落库。
  4. 返回主档 + 批次。

### 4.3 物品主档模块
**GET `/api/items`**
- 入参（query）：`keyword`（名称模糊）、`category`、`status`（expired/expiringSoon/lowStock/suggestUseFirst 任一，过滤）、`page`、`size`。
- 返回：
```json
{ "code":0, "data": {
  "list": [
    { "id":1, "name":"牛奶", "category":"食品", "unit":"瓶",
      "expiringSoonDays":5, "lowStockThreshold":3,
      "totalStock":5, "batchCount":2,
      "flags": { "expired":false, "expiringSoon":true, "lowStock":false, "suggestUseFirst":true } }
  ],
  "total":12, "page":1, "size":20 }, "timestamp":1690000000000 }
```
- 业务逻辑：联表 `stock_batch` 聚合 `SUM(quantity)` 与批次数；按 §5.2 计算 `flags`；支持按名称/分类/状态过滤与分页。

**GET `/api/items/{id}`**
- 返回：主档 + `batches` 数组（按 `production_date/expiry_date` 升序即 FIFO，最早批次标 `suggestUseFirst:true`）。
- 业务逻辑：批次级返回 `daysLeft`（距过期天数）、`expired`、`suggestUseFirst`。

**PUT `/api/items/{id}`**
- 入参（同新增主档配置字段，均可选）：`name,category,unit,defaultLocation,expiringSoonDays,lowStockThreshold`。
- 业务逻辑：更新主档；若改 `name` 需保证不与其它主档重名（冲突 `409001`）。

**DELETE `/api/items/{id}`**
- 业务逻辑：删主档；FK `ON DELETE CASCADE` 自动删其全部批次。返回成功。

### 4.4 库存批次模块
**PUT `/api/batches/{id}`**
- 入参：`quantity,location,productionDate,shelfLifeDays,expiryDate,batchTag,notes`（按需）。
- 业务逻辑：若改了生产日期/保质期/过期日，按 §5.1 重解 `expiry_date`；`quantity` 不允许直接置 0（归零走 consume 删除）。

**DELETE `/api/batches/{id}`**
- 业务逻辑：删单批次；若该物品批次清空，主档保留（可后续补货）。如希望“无批次即删主档”可加开关，V1.0 默认保留。

**POST `/api/batches/{id}/consume`**  （“用掉1”）
- 入参：`{ "amount": 1 }`（`amount` 缺省为 1，须 ≥1）。
- 返回：`{ "code":0, "data": { "action":"update", "batch":{...} } }` 或 `{ "action":"deleted", "batchId": 7 }`。
- 核心业务逻辑（`@Transactional`）：
  1. 加载批次，不存在 `404001`；`quantity` 须 > 0。
  2. `quantity -= amount`：
     - 仍 > 0 → `update` 该行，返回最新批次。
     - ≤ 0 → **删除该批次行**（返回 `action:deleted`）。
  3. **批次重排**：剩余批次的“第1批/第2批/先用这箱”由前端按 `production_date/expiry_date` 升序派生，**不落库、不存储序号**（见 §5.3）。

### 4.5 看板模块
**GET `/api/dashboard`**
- 入参（query，可选）：`asOf`（统计基准日，默认今天）。
- 返回：
```json
{ "code":0, "data": {
  "counts": { "totalItems":12, "totalBatches":20, "expired":1, "expiringSoon":3, "lowStock":2, "suggestUseFirst":4 },
  "expired":        [ { "id":1, "name":"牛奶", "earliestExpiry":"2026-08-10", "daysLeft":-3 } ],
  "expiringSoon":   [ { "id":1, "name":"牛奶", "earliestExpiry":"2026-08-18", "daysLeft":4 } ],
  "lowStock":       [ { "id":2, "name":"抽纸", "totalStock":1, "threshold":3 } ],
  "suggestUseFirst":[ { "id":1, "name":"牛奶", "earliestBatch":"第1批(先用这箱)", "earliestExpiry":"2026-08-18" } ]
}, "timestamp":1690000000000 }
```
- 业务逻辑：遍历所有物品，按 §5.2 规则归类到四区（允许同物品跨区），统计 `counts`。明细取每区 Top N（或全部，由 `size` 控）。

---

## 5. 核心业务逻辑说明（重点）

### 5.1 过期日解析规则（两种录入模式）
- 模式①：`expiryDate` 直接给出 → 以它为准。
- 模式②：`productionDate` + `shelfLifeDays` 给出 → `expiryDate = productionDate + shelfLifeDays 天`。
- 两者都给 → 以 `expiryDate` 为准（模式①优先），并校验与模式②推算一致（不一致告警可不阻断）。
- 两者都缺 → 拒绝入库（`400001`）。落库统一存 `expiry_date`，查询时不再运行时计算。

### 5.2 状态/四区计算（与前端看板一致）
对每物品，取 `expiringSoonDays`（空则用默认 7）、`totalStock=SUM(quantity)`、`earliestExpiry=MIN(expiry_date)`：
- **expired（已过期）**：存在批次 `expiry_date < 今天`。
- **expiringSoon（即将过期）**：未过期 且 `0 ≤ (earliestExpiry − 今天) ≤ expiringSoonDays`。
- **lowStock（库存不足）**：`lowStockThreshold` 非空 且 `totalStock < lowStockThreshold`。
- **suggestUseFirst（建议先用）**：批次数 ≥ 2 且最早批次 `expiry_date ≥ 今天`（尚有时间，应先消耗最早批次防浪费）。
> 四区可重叠（如既 lowStock 又 expiringSoon），看板按标志分别归入，互不影响。

### 5.3 FIFO 与“用掉1”重排
- 批次“第1批/第2批/先用这箱”**不存储序号**，前端按 `production_date/expiry_date` 升序实时派生；最早批次标 `suggestUseFirst`。
- “用掉1”（`consume`）：扣减 → 归零删除该行 → 其余批次因排序派生而自动重排编号，无需后端写序号。

### 5.4 级联与事务
- 删主档 → 级联删批次（FK `ON DELETE CASCADE`）。
- 入库（upsert+建批次）、consume（扣减/删除）均包 `@Transactional`，保证原子性。

---

## 6. 文件上传（V1.0 范围外）
- 当前 PRD 与 `item/stock_batch` 表均无图片字段，**V1.0 不提供文件上传接口**，避免冗余。
- 后续若需物品图片：① `item` 表加 `image_url VARCHAR(255)`；② 新增 `POST /api/files/upload`（返回 URL，OSS/本地存储均可）；③ 新增时携带 `imageUrl`。属 V1.1 扩展，不影响现有表与接口。

---

## 7. 启动与部署
1. 建库建表：`mysql -u root -p inventory < inventory_schema_v1.sql`
2. 配置环境变量（DB_*/JWT_*/OWNER_*）或改 `application.yml`。
3. 启动：`mvn clean package -DskipTests` → `java -jar target/inventory-backend-1.0.jar`（或 `mvn spring-boot:run`）。
4. 默认端口 8080；Swagger：`http://localhost:8080/swagger-ui.html`；健康检查：`GET /actuator/health`（可选开启）。
5. 前端 PWA 调 `http://<后端>/api/**`，登录后带 `Authorization: Bearer <token>`。
