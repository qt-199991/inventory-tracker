-- ==========================================================================
--  V1.1 轻量埋点 / 统计所需表结构
--  执行: mysql -u inv_user -p inventory < metrics_schema.sql
--  设计原则: 仅 1 张追加表 + 1 张日聚合表，零冗余，单用户量极小
-- ==========================================================================

-- 1) 原始事件表（只追加，不更新/不删除）
CREATE TABLE IF NOT EXISTS metric_event (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_type  VARCHAR(50)  NOT NULL COMMENT '事件类型: app_open/item_add/item_consume/dashboard_view/batch_delete/export/import',
  item_id     BIGINT UNSIGNED NULL COMMENT '关联 item.id，无则空',
  payload     JSON          NULL COMMENT '扩展字段，如 {qty:2, source:"manual"}',
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_event_type (event_type),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='埋点原始事件';

-- 2) 日聚合表（每日凌晨由定时任务统计写入，看板统计直接读此表，避免实时扫全表）
CREATE TABLE IF NOT EXISTS metric_daily (
  stat_date       DATE         NOT NULL COMMENT '统计日期',
  event_type      VARCHAR(50)  NOT NULL,
  cnt             INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (stat_date, event_type),
  KEY idx_event_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='埋点日聚合';
