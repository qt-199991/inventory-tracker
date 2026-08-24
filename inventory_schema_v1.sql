-- ============================================================
-- 个人物品库存清单 App - V1.0 数据库架构
-- 引擎: InnoDB | 字符集: utf8mb4
-- 设计原则: 极简、主从结构、仅覆盖 V1.0 业务
-- 核心实体: item(物品主档) + stock_batch(入库批次)
-- ============================================================

-- ------------------------------------------------------------
-- 1. 物品主档表 item
-- 作用: 同名物品唯一主档, 承载物品级配置
--       (分类/单位/默认位置/临期天数/低库存阈值)
-- ------------------------------------------------------------
CREATE TABLE `item` (
  `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '物品ID(主档主键)',
  `name`                VARCHAR(100)    NOT NULL                COMMENT '物品名称(如"牛奶"), 用于分组聚合, 同名唯一',
  `category`            VARCHAR(50)     DEFAULT NULL            COMMENT '分类(如"食品/日用品"), 仅用于筛选, 可空',
  `unit`                VARCHAR(10)     DEFAULT NULL            COMMENT '计量单位(如"瓶/袋/个"), 批次默认继承',
  `default_location`    VARCHAR(100)    DEFAULT NULL            COMMENT '默认存放位置(如"冰箱上层"), 可空',
  `expiring_soon_days` SMALLINT UNSIGNED DEFAULT NULL          COMMENT '临期提醒天数(提前N天提示), 为空时前端用默认7天',
  `low_stock_threshold` DECIMAL(10,2)   DEFAULT NULL            COMMENT '低库存阈值(总库存低于此值预警), 为空时不预警',
  `created_at`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP                COMMENT '创建时间',
  `updated_at`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='物品主档表';

-- ------------------------------------------------------------
-- 2. 库存批次表 stock_batch
-- 作用: 每一次入库/购买形成的批次, 关联所属物品
--       存储批次级数据: 数量/生产日期/保质期/过期日/位置/标签/备注
-- ------------------------------------------------------------
CREATE TABLE `stock_batch` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '批次ID',
  `item_id`          BIGINT UNSIGNED NOT NULL                COMMENT '关联物品ID(FK -> item.id)',
  `quantity`         DECIMAL(10,2)   NOT NULL DEFAULT '0.00' COMMENT '本批次剩余数量("用掉1"递减, 归零删除该批次)',
  `location`         VARCHAR(100)    DEFAULT NULL            COMMENT '本批次实际存放位置(可覆盖物品默认位置)',
  `production_date`  DATE            DEFAULT NULL            COMMENT '生产日期(录入方式①)',
  `shelf_life_days`  SMALLINT UNSIGNED DEFAULT NULL          COMMENT '保质期天数(录入方式①, 配合生产日期推算过期日)',
  `expiry_date`      DATE            DEFAULT NULL            COMMENT '过期日期(录入方式②直接填, 或由①推算; 以本字段为准判临期/过期)',
  `batch_tag`        VARCHAR(50)     DEFAULT NULL            COMMENT '批次标签(如"2026春款"/"促销装"), 区分同名批次',
  `notes`            VARCHAR(500)    DEFAULT NULL            COMMENT '备注',
  `created_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP                COMMENT '创建时间',
  `updated_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_item` (`item_id`),
  KEY `idx_expiry` (`expiry_date`),
  CONSTRAINT `fk_batch_item` FOREIGN KEY (`item_id`) REFERENCES `item` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='库存批次表';
