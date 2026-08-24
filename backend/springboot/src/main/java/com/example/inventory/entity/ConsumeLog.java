package com.example.inventory.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 消耗日志：每次"用掉 / 减少"记录一条，供消耗趋势统计 */
@Data
@TableName("consume_log")
public class ConsumeLog {
  @TableId(type = IdType.INPUT)
  private String id;

  private String ownerId;
  private String itemId;
  private String name;
  private BigDecimal qty;
  private LocalDateTime at;
}
