# 个人物品库存清单 · 部署包（v1.3 多账户独立版）

一个纯前端 + 轻后端的小工具，用来追踪「东西放哪、剩多少、是否过期」。
本包提供 **两种使用模式**，按你自己的需要选：

| 模式 | 数据存哪 | 多设备/多人共享 | 怎么跑 |
|---|---|---|---|
| **A. 单机离线版** | 你浏览器本地（IndexedDB） | ❌ 各设备各一份 | 双击 `standalone.html` 即可，**零安装** |
| **B. 共享后端版（本包重点，v1.3）** | 后端数据库（一个 JSON 文件 / 或 MySQL） | ✅ 多账户各自独立；同一账号在所有设备看同一份 | 启动 `backend/node/server.mjs`，浏览器开 `http://<地址>:8080` |

> v1.3 起支持**多账户各自独立**：每人注册自己的账号，只看到自己的库存；同一账号在手机/电脑登录看到同一份（跨设备同步）。下面讲它，以及怎么部署到免费云平台让任意浏览器都能访问。

---

## 模式 B：多设备共享版（推荐你用这个）

### 1) 启动（只要装了 Node.js ≥ 18）

- **Windows**：双击 `run-shared-backend.bat`
- **macOS / Linux / 云服务器**：`bash start-backend.sh`（或 `cd backend/node && node server.mjs`）

启动后看到：
```
✅ 库存后端已启动： http://localhost:8080
   前端页面：         http://localhost:8080/
   默认账号：         admin / admin123
   数据文件：         .../backend/node/data/inventory.json
```

### 2) 打开使用

浏览器访问 `http://localhost:8080` → 用 `admin / admin123` 登录即可。
所有登录这个账号的设备，看到的都是 **同一份库存**。

### 3) 让「任意电脑/手机」都能访问你的网址

后端默认只监听本机。要让别人也能打开，三选一：

**① 同 WiFi / 同路由器（最快，免费）**
把 `localhost` 换成你电脑的局域网 IP。查 IP：
- Windows：`ipconfig` 看「IPv4 地址」（如 `192.168.1.20`）
- Mac/Linux：`ifconfig` 或 `ip a`
然后手机/其他电脑开 `http://192.168.1.20:8080`。
> 注意：你电脑要关掉防火墙对 8080 端口的限制；电脑关机服务就停。

**② 内网穿透（临时公网网址，几秒搞定，免注册）**
本机起好后端后，再开一个终端：
```bash
# 任选其一（都不用注册账号）
npx ngrok http 8080            # 得到 https://xxxx.ngrok.io
# 或
cloudflared tunnel --url http://localhost:8080
```
把得到的网址发给任何人，他们就能打开。**网址会变、关掉就没了**，适合临时分享。

**③ 免费云平台（Render，推荐做「全网可达」）**
本包已带 `render.yaml`，可一键部署、拿到固定公网网址，任意浏览器/手机都能开：
1. 把本文件夹推到 GitHub（仓库里已含 `render.yaml` 与 `.gitignore`）。
2. 打开 [render.com](https://render.com) → 用 GitHub 登录 → **New** → **Blueprint** → 选该仓库。
3. 关键设置：`Runtime: Node`、`Plan: Free`、`Start Command: node backend/node/server.mjs`（Blueprint 已自动填好）。
4. 在 **Environment** 里加 `OWNER_PASS=你自己设的强密码`（admin 账号密码）。
5. 点 **Create** → 等一两分钟 → 得到 `https://xxxx.onrender.com`，任意设备浏览器打开即用。
> 免费层实例 15 分钟不用会休眠（首次打开慢几秒）；实例重启后数据保留，但「重新部署」会重置数据文件。
> 用应用内 **⚙ → 导出备份** 随时存档；想永久不丢可挂 Render 持久盘（需付费档）或改部署到 Railway（带免费卷）。

**④ 云服务器（永久公网网址，需自购）**
把整个文件夹传到一台云服务器，用 `bash start-backend.sh` 或 `nohup node backend/node/server.mjs &` 常驻，
配合域名 + 反向代理（Nginx/Caddy）即可得到一个永久 `https://你的域名`。
详见 `deploy_guide.md`、`ops_guide.md`。

### 4) 默认账号 & 安全

- 默认 `admin / admin123`，**首次启动自动创建**（建议部署后用 `OWNER_PASS` 环境变量改成强密码）。
- 其他人用：在登录页点「注册」，填用户名+密码即可开自己的账号，**各看各的数据**，互不可见。
- 改密码：删掉 `backend/node/data/inventory.json` 后用环境变量重启：
  ```bash
  OWNER_USER=admin OWNER_PASS=你的新密码 node backend/node/server.mjs
  ```
- 数据文件是一个普通 JSON，定期备份它就是备份全部库存。
- 网址是公开的：拿到链接的人都能打开这个应用，但**必须用自己的账号登录才看得到数据**；不泄露账号即安全。

### 5) 备份 / 迁移

应用内点右上角 **⚙ → 导出备份**（JSON）可手动存档；**导入备份**可还原。
共享版也会把数据落到 `backend/node/data/inventory.json`，直接复制这个文件也是备份。

---

## 模式 A：单机离线版（不想搭后端时用）

- 双击 `standalone.html` 直接用浏览器打开，**不用任何服务器**，数据存你本机浏览器。
- 或双击 `run-local-server.bat` 起一个静态服务，开 `http://localhost:8000`。
- 多人/多设备不共享，适合纯个人单机。

---

## 技术架构（模式 B）

```
浏览器(shared/)  ──HTTP /api/*──▶  backend/node/server.mjs  ──▶  数据层 db.mjs  ──▶  inventory.json
   app.js / api.js                        (零依赖 Node)              (增删改查/鉴权/JWT)     (一个文件当数据库)
```

- 前端 `shared/` 与原离线版 `js/app.js` 几乎一致，只是把本地存储 `db.js` 换成了调接口的 `api.js`。
- 后端 `backend/node/`：**零第三方依赖**（只用 Node 内置 `http`/`crypto`），用 JSON 文件当数据库，开箱即跑。
- 功能完全一致：照片、低库存提醒、临期通知、回收站、消耗统计、Excel/JSON 导出导入、分类筛选。

### 接口一览（与 `backend_api_design.md` 一致）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/login` | 登录（公开） |
| POST | `/api/auth/register` | 注册（公开） |
| GET | `/api/batches?active=1` | 在库物品 |
| GET | `/api/batches?trashed=1` | 回收站 |
| POST | `/api/batches` | 新增 |
| PUT | `/api/batches/:id` | 修改 |
| DELETE | `/api/batches/:id` | 彻底删除 |
| PATCH | `/api/batches/:id/soft-delete` | 进回收站 |
| PATCH | `/api/batches/:id/restore` | 恢复 |
| POST | `/api/batches/trash/purge` | 清理过期回收站 |
| GET/POST | `/api/consume-logs` | 消耗日志（统计用） |
| GET | `/api/users` | 用户列表 |
| POST | `/api/import` | 整体导入备份 |

---

## 生产升级：SpringBoot + MySQL

如果你以后要 **多账号各自独立、上应用商店、或用真正的数据库**，包内 `backend/springboot/` 是完整可编译的 SpringBoot + MyBatis-Plus + MySQL 代码，接口与本 Node 后端 **完全一致**，前端无需改动。
建库脚本：`backend/springboot/sql/inventory_schema_springboot.sql`。
当前沙箱无 JDK/MySQL，故未现场编译运行；你本机装好环境后即可 `mvn spring-boot:run`。

> 说明：纯前端 + 本 Node 后端已能满足「多设备共享同一份数据」，MySQL 不是必选项。

---

## 测试

```bash
# 前端逻辑（根目录）
node --test tests/*.test.mjs

# 后端接口（可运行版）
cd backend/node && node --test tests/*.test.mjs
```
当前：前端 55/55 通过、后端 26/26 通过（含 14 项接口集成测试 + 12 项端到端全链路 e2e 测试）。

后端 e2e 测试会用一个临时数据目录拉起真实服务，跑通「登录→建物品→消耗→软删→回收站→恢复→日志→导入→清理」整条多设备共享链路，验证完毕自动清理临时文件。

---

## 目录结构

```
inventory-tracker-v1.2/
├─ shared/                 ← 共享版前端（模式 B）
│  ├─ index.html  app.js  api.js  logic.js  css/  icons/
├─ backend/
│  ├─ node/               ← 可运行零依赖后端（模式 B 用这个）
│  └─ springboot/         ← 生产级 SpringBoot+MySQL 代码（可选升级）
├─ index.html  js/  css/  standalone.html   ← 单机离线版（模式 A）
├─ run-shared-backend.bat  start-backend.sh  ← 启动脚本（模式 B）
├─ run-local-server.bat                      ← 启动脚本（模式 A）
├─ *.md                   ← 设计/部署/运维/测试文档
├─ inventory_schema_v1.sql                  ← 数据库设计
└─ tests/  scripts/  inventory_flutter/     ← 测试/脚本/Flutter 骨架
```

更详细的接口、部署、运维、上架说明见：`backend_api_design.md`、`deploy_guide.md`、`deploy-local.md`、`ops_guide.md`、`publish_guide.md`、`design.md`、`test_plan.md`。
