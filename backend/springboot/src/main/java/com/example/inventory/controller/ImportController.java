package com.example.inventory.controller;

import com.example.inventory.common.Result;
import com.example.inventory.dto.req.ImportRequest;
import com.example.inventory.entity.InventoryBatch;
import com.example.inventory.entity.User;
import com.example.inventory.service.InventoryService;
import com.example.inventory.service.UserService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/import")
public class ImportController {

  private final InventoryService inventoryService;
  private final UserService userService;

  public ImportController(InventoryService inventoryService, UserService userService) {
    this.inventoryService = inventoryService;
    this.userService = userService;
  }

  @PostMapping
  public Result<Void> importAll(@RequestBody ImportRequest req) {
    if (req.getBatches() != null) {
      for (InventoryBatch b : req.getBatches()) inventoryService.importBatch(b);
    }
    if (req.getUsers() != null) {
      for (User u : req.getUsers()) userService.importUser(u);
    }
    return Result.ok();
  }
}
