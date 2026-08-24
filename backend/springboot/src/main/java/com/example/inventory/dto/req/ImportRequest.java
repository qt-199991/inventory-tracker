package com.example.inventory.dto.req;

import com.example.inventory.entity.InventoryBatch;
import com.example.inventory.entity.User;
import lombok.Data;

import java.util.List;

/** 整体导入（备份还原）入参 */
@Data
public class ImportRequest {
  private List<InventoryBatch> batches;
  private List<User> users;
}
