# Flutter 前端项目目录结构（任务1：目录结构梳理）

> 项目名：`inventory_flutter`（与后端 `inventory_schema_v1.sql` / `backend_api_design.md` 配套）
> 技术栈：Flutter 3.x + Dart 3 | 网络 Dio | 状态管理 Provider | 本地存储 SharedPreferences
> 本文仅覆盖**任务1（目录结构）**，页面完整代码 / 网络封装 / 状态管理 / 环境 / 打包 分别在任务 2–6 落地。

---

## 一、完整目录树

```text
inventory_flutter/
├── lib/                          # 【Dart 源码根目录】所有业务代码
│   ├── main.dart                 # 应用入口：runApp(App())
│   ├── app/                      # 应用级配置（主题 / 路由 / 根组件）
│   │   ├── app.dart              #   MaterialApp：主题、路由表、初始页
│   │   ├── routes.dart           #   路由名称常量（集中管理，避免硬编码）
│   │   └── theme.dart            #   全局主题 + 四区状态色标（红/橙/黄/绿）
│   ├── models/                   # 数据模型层（后端 JSON ↔ Dart 对象）
│   │   ├── api_response.dart     #   统一返回结构 {code,message,data,timestamp}
│   │   ├── item.dart             #   物品主档 + 聚合字段 + 四区 flags
│   │   ├── stock_batch.dart      #   库存批次（含 daysLeft/expired 派生字段）
│   │   └── dashboard.dart        #   看板数据：counts + 四区列表
│   ├── services/                 # 网络层（对接后端 REST 接口）
│   │   ├── api_client.dart       #   通用请求封装：Dio + Token 拦截 + 统一异常（Task 3 完整）
│   │   ├── auth_service.dart     #   登录接口（Task 3 补充）
│   │   ├── item_service.dart     #   物品 CRUD + 列表（Task 3 补充）
│   │   ├── batch_service.dart    #   批次 CRUD + 消费（Task 3 补充）
│   │   └── dashboard_service.dart#   看板查询（Task 3 补充）
│   ├── providers/                # 轻量状态管理（Provider，Task 4 完整）
│   │   ├── auth_provider.dart    #   登录态 / Token 状态（已建占位）
│   │   ├── item_provider.dart    #   物品列表 / 详情状态（Task 4 补充）
│   │   └── dashboard_provider.dart#  看板数据状态（Task 4 补充）
│   ├── pages/                    # 页面层（按功能模块拆分）
│   │   ├── login/                #   登录页
│   │   │   └── login_page.dart   #     （已建占位，Task 2 完整）
│   │   ├── dashboard/            #   看板首页（四区统计 + 列表）
│   │   │   └── dashboard_page.dart#    （已建占位，Task 2 完整）
│   │   ├── items/                #   物品列表 / 详情（含批次 FIFO）
│   │   │   ├── item_list_page.dart   # Task 2
│   │   │   └── item_detail_page.dart # Task 2
│   │   ├── inventory/            #   新增 / 入库表单（两种过期录入模式）
│   │   │   └── inventory_add_page.dart# Task 2
│   │   └── batch/                #   批次编辑 / “用掉1”入口
│   │       └── batch_edit_page.dart  # Task 2
│   ├── widgets/                  # 复用 UI 组件
│   │   ├── status_badge.dart     #   状态色标徽章（🔴🟠🟡🟢，已建）
│   │   ├── item_card.dart        #   物品卡片（Task 2）
│   │   └── loading.dart          #   加载/空态组件（Task 2）
│   └── utils/                    # 工具类
│       ├── constants.dart        #   接口地址 / 默认分页等常量（已建）
│       ├── storage.dart          #   Token 本地存储（已建）
│       └── date_util.dart        #   过期日 / 剩余天数计算（Task 3 补充）
├── assets/                       # 静态资源
│   └── images/                   #   图标、占位图（已在 pubspec 注册）
├── test/                         # 单元测试 / Widget 测试（TDD，Task 6 前补齐）
├── android/                      # 原生安卓工程（flutter create 自动生成，Task 5/6 用）
├── ios/                          # 原生 iOS 工程（flutter create 自动生成，Task 5/6 用）
├── windows/                      # Windows 桌面工程（flutter create 自动生成，可选）
├── pubspec.yaml                  # 依赖与资源配置（已建）
└── STRUCTURE.md                  # 本文：目录结构说明
```

---

## 二、各目录核心作用

| 目录 / 文件 | 核心作用 | 状态 |
|---|---|---|
| `lib/main.dart` | 程序入口，启动 `App`，可在此做异步初始化 | ✅ 已建 |
| `lib/app/` | 应用骨架：主题、路由表、根 `MaterialApp` | ✅ 已建 |
| `lib/models/` | 纯数据层，定义与后端 JSON 一一对应的实体；`fromJson` 完成驼峰↔下划线映射 | ✅ 已建 4 个 |
| `lib/services/` | 网络层，封装 Dio 请求与拦截器，按接口分 service | ⚠️ client 已建 / 各 service 待 Task3 |
| `lib/providers/` | 状态管理（Provider），隔离 UI 与数据获取 | ⚠️ auth 占位 / 其余待 Task4 |
| `lib/pages/` | 按功能拆分的页面，每个模块独立目录 | ⚠️ login/dashboard 占位 / 其余待 Task2 |
| `lib/widgets/` | 跨页面复用的展示组件，降低重复代码 | ⚠️ status_badge 已建 / 其余待 Task2 |
| `lib/utils/` | 常量、本地存储、日期工具等无状态辅助 | ✅ constants/storage 已建 |
| `assets/images/` | 图标与图片资源，已在 `pubspec.yaml` 注册 | ✅ 已建 |
| `test/` | 单元测试与 Widget 测试，支撑 TDD 红绿循环 | 🔜 Task6 前 |
| `android/ ios/ windows/` | 各平台原生壳工程，由 `flutter create` 生成，打包时使用 | 🔜 Task5/6 |

---

## 三、设计决策（对应后端约束）

1. **目录按“层 + 功能”双维度划分**：`models/services/providers` 是横向分层，`pages/<模块>/` 是纵向功能拆分，二者正交，便于多人协作（Subagent 并行）。
2. **models 与后端 JSON 强对齐**：字段名、聚合字段（`totalStock/batchCount/flags`）、派生字段（`daysLeft/expired/suggestUseFirst`）完全对应 `backend_api_design.md`，避免前后端字段错位。
3. **状态色标集中到 `theme.dart`**：🔴已过期/🟠即将过期/🟡库存不足/🟢建议先用 与 PWA 版、看板四区统一，保证多端视觉一致。
4. **`android/ ios/` 不手写**：由 `flutter create .` 生成，避免提交庞大原生模板；环境配置与打包见任务 5/6。
5. **YAGNI**：未引入 i18n、复杂 DI、冗余分层；状态管理先用官方 `Provider`（轻量），待业务膨胀再升级 Riverpod。

---

## 四、当前进度

| 任务 | 内容 | 进度 |
|---|---|---|
| 任务1 | 目录结构梳理 + 注解 | ✅ 本次完成（本文 + 骨架） |
| 任务2 | 各页面完整 Dart 代码 | 🔜 待启动 |
| 任务3 | 网络请求工具类完整封装 | ⚠️ `api_client` 已搭骨架 |
| 任务4 | 轻量状态管理方案 | ⚠️ `auth_provider` 已占位 |
| 任务5 | Windows/iOS/Android 环境搭建指令 | 🔜 待启动 |
| 任务6 | APK / IPA 打包命令 | 🔜 待启动 |
