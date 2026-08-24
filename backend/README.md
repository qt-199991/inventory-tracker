# 库存后端（多设备共享）

让所有设备/所有人登录**同一个账号**，就能看到**同一份实时库存**。
数据唯一真源在后端数据库；前端 `shared/` 只负责展示与交互。

两套后端，**接口完全一致**，前端无感知：

| 方案 | 目录 | 数据库 | 何时用 |
|---|---|---|---|
| **Node（开箱即用）** | `node/` | 嵌入式 JSON 文件（零依赖、零安装） | 现在就能在你电脑跑通验证 |
| **SpringBoot（生产）** | `springboot/` | MySQL | 长期/多用户/上云，需要 Java17+Maven+MySQL |

---

## 一、Node 版（推荐先用这个）

### 运行
```bash
cd backend/node
node server.mjs
# 或自定义： PORT=9000 OWNER_USER=admin OWNER_PASS=你的密码 node server.mjs
```
- 默认地址：`http://localhost:8080`
- 默认账号：`admin` / `admin123`（首次启动自动建好）
- 数据文件：`backend/node/data/inventory.json`（直接当"数据库"看，可备份/迁移）

### 让同 WiFi / 局域网的设备访问
后端已监听 `0.0.0.0`，同路由器下的手机/电脑用你电脑的局域网 IP 访问，例如：
`http://192.168.1.50:8080`
（前端 `shared/` 由后端一并托管，无需单独起静态服务器）

### 部署到公网（任意电脑都能开）
把 `backend/node/` 和 `shared/` 一起传到一台有公网 IP 的服务器（或云函数/容器），
用 `node server.mjs` 起服务，再用 Nginx/Caddy 反代 `:8080` 并配上 HTTPS 域名即可。
（纯静态的前端也可以单独放到 GitHub Pages / Netlify，再把 `window.API_BASE` 指到后端地址。）

### 测试
```bash
node --test backend/node/tests/*.test.mjs
```

---

## 二、SpringBoot 版（生产）

### 准备
1. 安装：JDK 17+、Maven 3.8+、MySQL 5.7/8.0
2. 建库建表：
   ```bash
   mysql -u root -p < backend/springboot/sql/inventory_schema_springboot.sql
   ```
3. 配置（环境变量或改 `application.yml`）：
   `DB_USER` / `DB_PASS` / `JWT_SECRET` / `OWNER_USER` / `OWNER_PASS`

### 运行
```bash
cd backend/springboot
mvn clean package -DskipTests
java -jar target/inventory-backend-1.2.0.jar
# 或 mvn spring-boot:run
```
- 端口 8080，Swagger：`http://localhost:8080/swagger-ui.html`（如需开启请自行引入 springdoc）

### 与 Node 版差异
- 鉴权用 JJWT（HS256），密码 SHA-256 + salt，与 Node 版算法一致，可平滑切换。
- 前端 `shared/api.js` 同时兼容两者，无需改动。

---

## 接口一览（两套后端通用）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/login` | 登录拿 token |
| POST | `/api/auth/register` | 注册（单账号场景通常不开放） |
| GET | `/api/batches?active=1` | 活动批次（默认列表） |
| GET | `/api/batches?trashed=1` | 回收站 |
| POST | `/api/batches` | 新增 |
| PUT | `/api/batches/:id` | 编辑 |
| DELETE | `/api/batches/:id` | 彻底删除 |
| PATCH | `/api/batches/:id/soft-delete` | 进回收站 |
| PATCH | `/api/batches/:id/restore` | 恢复 |
| POST | `/api/batches/trash/purge` | 清理 30 天前回收站 |
| GET/POST | `/api/consume-logs` | 消耗日志 |
| GET | `/api/users` | 用户列表 |
| POST | `/api/import` | 备份整体导入 |
