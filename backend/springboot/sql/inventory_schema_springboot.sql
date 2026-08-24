-- ============================================================
-- 个人物品库存清单 V1.2 — SpringBoot + MySQL 生产库结构
-- 引擎: InnoDB | 字符集: utf8mb4
-- 说明: 与 Node 版后端、前端 api.js 字段完全一致（扁平"批次"模型）
-- ============================================================

CREATE DATABASE IF NOT EXISTS inventory DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE inventory;

-- 用户表（单账号多设备共享；默认账号由应用启动时按 owner.user/owner.pass 注入）
CREATE TABLE IF NOT EXISTS `sys_user` (
  `id`           VARCHAR(36)    NOT NULL                COMMENT '用户ID(uuid)',
  `username`     VARCHAR(100)   NOT NULL                COMMENT '用户名（唯一）',
  `salt`         VARCHAR(64)    NOT NULL                COMMENT '密码 salt',
  `password_hash` VARCHAR(128)  NOT NULL                COMMENT 'SHA-256(密码+salt)',
  `is_owner`     TINYINT(1)     DEFAULT 0               COMMENT '是否默认 Owner',
  `created_at`   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户表';

-- 库存批次表（前端的一条"物品"记录）
CREATE TABLE IF NOT EXISTS `inventory_batch` (
  `id`                  VARCHAR(36)    NOT NULL                COMMENT '批次ID(uuid)',
  `owner_id`            VARCHAR(36)    DEFAULT NULL            COMMENT '所属用户ID',
  `name`                VARCHAR(100)   NOT NULL                COMMENT '物品名称（同名在前端聚合为一张卡）',
  `category`            VARCHAR(50)    DEFAULT '未分类'        COMMENT '分类（仅筛选用）',
  `location`            VARCHAR(100)   DEFAULT NULL            COMMENT '存放位置',
  `quantity`            DECIMAL(10,2)  NOT NULL DEFAULT 0      COMMENT '剩余数量',
  `unit`                VARCHAR(10)    DEFAULT '个'            COMMENT '单位',
  `production_date`     DATE           DEFAULT NULL            COMMENT '生产日期',
  `expiry_date`         DATE           DEFAULT NULL            COMMENT '过期日期（以本字段判临期/过期）',
  `shelf_life_days`     INT            DEFAULT NULL            COMMENT '保质期天数',
  `low_stock_threshold` DECIMAL(10,2)  DEFAULT NULL            COMMENT '低库存阈值（空不预警）',
  `expiring_soon_days`  INT            DEFAULT NULL            COMMENT '临期提醒天数（空默认7）',
  `batch_label`         VARCHAR(50)    DEFAULT NULL            COMMENT '批次标签',
  `note`                VARCHAR(500)   DEFAULT NULL            COMMENT '备注',
  `photo`               LONGTEXT       DEFAULT NULL            COMMENT '物品照片(base64)',
  `created_at`          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`          DATETIME       DEFAULT NULL            COMMENT '软删除标记，非空=在回收站(30天自动清理)',
  PRIMARY KEY (`id`),
  KEY `idx_owner` (`owner_id`),
  KEY `idx_expiry` (`expiry_date`),
  KEY `idx_deleted` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='库存批次表';

-- 消耗日志表（每次"用掉/减少"记一条，供趋势统计）
CREATE TABLE IF NOT EXISTS `consume_log` (
  `id`         VARCHAR(36)   NOT NULL                COMMENT '日志ID(uuid)',
  `owner_id`   VARCHAR(36)   DEFAULT NULL            COMMENT '所属用户ID',
  `item_id`    VARCHAR(36)   DEFAULT NULL            COMMENT '关联批次ID',
  `name`       VARCHAR(100)  DEFAULT NULL            COMMENT '物品名称（冗余，便于统计）',
  `qty`        DECIMAL(10,2) NOT NULL DEFAULT 0      COMMENT '本次消耗数量',
  `at`         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发生时间',
  PRIMARY KEY (`id`),
  KEY `idx_owner_at` (`owner_id`, `at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='消耗日志表';
