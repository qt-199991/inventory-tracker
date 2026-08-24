# 个人物品库存清单 · V1.0 长期迭代与运维方案

> 定位：中小型个人/小团队工具，轻量化、易维护、低成本长期运营。
> 现状基线（已交付）：PWA 可跑 + Flutter 骨架 + SpringBoot 3.2 / Java 17 / MySQL 8.0 / Nginx / 单用户本地优先。
> 配套脚本已生成：`scripts/backup_db.sh`（数据库备份）、`scripts/metrics_schema.sql`（埋点建表）。

---

## 1. V1.1 迭代规划（新增功能 + 优化方向）

### 1.1 新增功能（按价值/成本排序，建议优先级 P0→P2）

| 优先级 | 功能 | 说明 | 工作量 |
|---|---|---|---|
| **P0** | 消费数量可调（用掉 N） | 当前仅「用掉1」，改为可输入数量；负数守卫已在 `logic.js` 修好 | 小 |
| **P0** | 一键补货 + 补货提醒 | 物品详情「补货」按钮快速建新批次；低于阈值时看板高亮 | 小 |
| **P0** | 数据导出/导入 | JSON/CSV 本地备份与还原（无云也安全），应对换机 | 小 |
| **P1** | 多维筛选/搜索增强 | 按位置、分类、状态筛选 + 关键字搜索（V1.0 仅分类筛选） | 中 |
| **P1** | 消耗趋势统计 | 按月聚合「用掉」量，看板加简易折线（依赖第 2 章埋点） | 中 |
| **P1** | 临期/过期主动推送 | 浏览器 Notification + PWA 离线提醒；可选微信模板消息 | 中 |
| **P2** | 回收站 | 误删 30 天内可恢复（软删 `deleted_at`） | 中 |
| **P2** | 扫码录入 | 摄像头扫商品条码回填名称（需相机权限，注意隐私声明） | 中 |

### 1.2 优化方向（非功能）
- **看板查询缓存**：物品多时给 `GET /api/dashboard` 加 30s 本地缓存（Caffeine），降低 DB 压力。
- **大列表虚拟滚动**：Flutter 物品超 500 条用 `ListView.builder` 懒加载。
- **DB 索引复核**：随筛选维度增加，补 `idx_location`、`idx_category` 索引（见 `inventory_schema_v1.sql` 注释）。
- **错误处理统一**：后端补 `@ControllerAdvice` 全局异常（已在 `backend_api_design.md` 规划）。

> 刻意不进 V1.1（留 V2.0）：多用户/家庭成员共享、云端多设备同步账号体系——需要用户表 + 鉴权改造，超出轻量定位。

---

## 2. 用户数据统计 + 基础埋点方案（轻量）

原则：**单用户量极小，不上 Kafka/ES，MySQL 直接落库 + 日聚合即可**。

### 2.1 数据模型（已写入 `scripts/metrics_schema.sql`）
- `metric_event`：追加式原始事件（`event_type` / `item_id` / `payload` JSON / `created_at`）。
- `metric_daily`：日聚合（统计看板直接读，免实时全表扫）。

### 2.2 后端接口（新增，沿用统一 `Result` 返回）
```
POST /api/metrics            # 前端上报事件，body: {eventType, itemId?, payload?}
POST /api/metrics/aggregate  # 触发日聚合（也可由定时任务调用）
GET  /api/metrics/daily?from=&to=&type=  # 统计趋势查询
```

### 2.3 前端埋点（Flutter 侧轻封装）
```dart
// lib/services/metrics_service.dart
Future<void> track(String type, {int? itemId, Map? payload}) async {
  try {
    await api.post('/metrics', data: {
      'eventType': type,
      'itemId': itemId,
      'payload': payload,
    });
  } catch (_) { /* 埋点失败不影响主流程 */ }
}
// 调用点：app 启动 track('app_open')、新增后 track('item_add', itemId: x)
```

### 2.4 日聚合定时任务（cron 凌晨跑）
```sql
-- 示例：把昨天的事件按类型汇总进 metric_daily
INSERT INTO metric_daily (stat_date, event_type, cnt)
SELECT DATE(created_at), event_type, COUNT(*)
FROM metric_event
WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
GROUP BY event_type
ON DUPLICATE KEY UPDATE cnt = VALUES(cnt);
```

---

## 3. 服务器扩容 + 数据库定时备份方案

### 3.1 数据库定时备份（已落地 `scripts/backup_db.sh`）
```bash
# 加入 crontab（每日 03:00，日志追加）
crontab -e
# 0 3 * * * bash /opt/inventory/scripts/backup_db.sh >> /opt/inventory/backups/backup.log 2>&1

# 手动立即备份
bash /opt/inventory/scripts/backup_db.sh

# 恢复（举例：恢复到指定库）
gunzip -c /opt/inventory/backups/inventory_20260814_030000.sql.gz | mysql -u inv_user -p inventory
```
脚本特性：`--single-transaction` 一致性快照、gzip 压缩、自动清理 30 天前备份。

**异地容灾（可选）**：备份后 `rsync` 到另一台机器或对象存储（OSS/COS），防止单机磁盘故障。
```bash
# 备份后追加一行（示例）
rsync -az /opt/inventory/backups/ user@backup-server:/data/inventory_backups/
```

### 3.2 服务器扩容路线（由轻到重）
1. **垂直扩容（首选）**：云控制台一键升配 CPU/内存，重启即可，零改造。单用户工具 2G→4G 足够撑很久。
2. **应用层水平（中等规模才需）**：起 2 个 SpringBoot 实例（不同端口），Nginx `upstream` 负载均衡：
   ```nginx
   upstream inventory_backend { server 127.0.0.1:8080; server 127.0.0.1:8081; }
   # location / 中 proxy_pass http://inventory_backend;
   ```
3. **数据库读写分离（大量读时）**：MySQL 主从，看板查询走从库。当前阶段**不需要**。
4. **监控告警（低成本）**：cron 每 5 分钟探活，异常发钉钉/邮件 webhook（见 4.4）。

---

## 4. 日常运维核心操作指令

### 4.1 服务管理
```bash
# 重启后端
sudo systemctl restart inventory
sudo systemctl status inventory --no-pager     # 看状态
sudo systemctl stop inventory && sudo systemctl start inventory

# Nginx 重载（改配置后）
sudo nginx -t && sudo systemctl reload nginx
```

### 4.2 日志查看
```bash
# 后端日志（systemd）
sudo journalctl -u inventory -f                 # 实时
sudo journalctl -u inventory --since "2026-08-14 00:00" -n 200

# 后端日志（nohup 方式）
tail -f /opt/inventory/app.log
grep ERROR /opt/inventory/app.log | tail -20

# Nginx 访问/错误日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# 统计访问量 Top IP / 热门接口
sudo awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head
sudo awk '{print $7}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head
```

### 4.3 数据与状态检查
```bash
# 数据库连通 + 表清单
mysql -u inv_user -p -e "USE inventory; SHOW TABLES; SELECT COUNT(*) FROM item;"

# 磁盘 / 内存 / 负载
df -h /opt && free -h && uptime

# 端口监听
sudo ss -tlnp | grep -E ':(8080|80|443|3306)'

# 最近备份
ls -lh /opt/inventory/backups/ | tail -5
```

### 4.4 异常排查清单
| 现象 | 先查 | 命令 |
|---|---|---|
| 服务不可达 | 进程/端口 | `systemctl is-active inventory` + `ss -tlnp\|grep 8080` |
| 接口 500 | 后端错误日志 | `journalctl -u inventory -n 100 \| grep ERROR` |
| 连不上库 | 账号/防火墙 | `mysql -u inv_user -p` + 云安全组 |
| 磁盘满 | 备份/日志膨胀 | `df -h` + `du -sh /opt/inventory/backups/* \| sort -h` |
| 内存飙升 | JVM/泄漏 | `free -h` + `jstat -gcutil <pid>` |
| 证书过期 | certbot 状态 | `sudo certbot certificates` |

**探活告警（可选，5 分钟一次）**
```bash
# crontab: */5 * * * * curl -fsS https://yourdomain.com/api/dashboard >/dev/null || curl -X POST 钉钉webhook -d '{"text":"inventory 探活失败"}'
```

---

## 5. 运维节奏建议
- **每日**：cron 自动备份 + 探活（无人值守）。
- **每周**：人工扫一眼 `journalctl` 错误、备份目录大小、磁盘。
- **每月**：看 `metric_daily` 使用趋势，评估是否需 V1.1 功能；检查证书续期（certbot 自动）。
- **版本发布**：蓝绿/滚动——`systemctl restart` 秒级，体量小无需复杂发布系统。
