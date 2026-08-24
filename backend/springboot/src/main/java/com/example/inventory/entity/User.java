package com.example.inventory.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("sys_user")
public class User {
  @TableId(type = IdType.INPUT)
  private String id;

  private String username;
  private String salt;
  private String passwordHash;
  private Boolean isOwner;
  private LocalDateTime createdAt;
}
