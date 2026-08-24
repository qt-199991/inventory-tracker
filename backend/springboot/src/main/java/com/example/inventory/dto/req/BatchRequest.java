package com.example.inventory.dto.req;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/** 新增/编辑批次的入参（均可选，由服务层决定新建还是更新） */
@Data
public class BatchRequest {
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
  private String photo;
}
