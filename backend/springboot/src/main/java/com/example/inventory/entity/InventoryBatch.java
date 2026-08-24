package com.example.inventory.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 库存批次（前端的一条"物品"记录）。
 * 与 Node 版后端、前端 api.js 字段完全一致，保证多端互通。
 */
@Data
@TableName("inventory_batch")
public class InventoryBatch {
  @TableId(type = IdType.INPUT)
  private String id;

  private String ownerId;
  private String name;
  private String category;
  private String location;
  private BigDecimal quantity;
  private String unit;
  private LocalDate productionDate;
  private LocalDate expiryDate;
  private Integer shelfLifeDays;
  private BigDecimal lowStockThreshold;
  private Integer expiringSoonDays;
  private String batchLabel;
  private String note;
  private String photo;          // 照片 base64（LONGTEXT）

  private LocalDateTime createdAt;
  private LocalDateTime updatedAt;
  private LocalDateTime deletedAt; // 软删除标记，非空=在回收站
}
