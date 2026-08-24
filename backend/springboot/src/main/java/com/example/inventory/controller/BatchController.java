package com.example.inventory.controller;

import com.example.inventory.common.Result;
import com.example.inventory.dto.req.BatchRequest;
import com.example.inventory.entity.InventoryBatch;
import com.example.inventory.service.InventoryService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/batches")
public class BatchController {

  private final InventoryService inventoryService;

  public BatchController(InventoryService inventoryService) {
    this.inventoryService = inventoryService;
  }

  private String userId(HttpServletRequest req) {
    return (String) req.getAttribute("userId");
  }

  @GetMapping
  public Result<Object> list(@RequestParam(value = "filter", required = false) String filter,
                             HttpServletRequest req) {
    // filter: active=1 -> active, trashed=1 -> trashed, 其它 -> all
    String f = "all";
    if ("1".equals(req.getParameter("active"))) f = "active";
    else if ("1".equals(req.getParameter("trashed"))) f = "trashed";
    if ("active".equals(filter)) f = "active";
    else if ("trashed".equals(filter)) f = "trashed";
    return Result.ok(inventoryService.list(f));
  }

  @PostMapping
  public Result<Object> create(@RequestBody BatchRequest body, HttpServletRequest req) {
    return Result.ok(inventoryService.create(body, userId(req)));
  }

  @GetMapping("/{id}")
  public Result<Object> get(@PathVariable String id) {
    return Result.ok(inventoryService.get(id));
  }

  @PutMapping("/{id}")
  public Result<Object> update(@PathVariable String id, @RequestBody BatchRequest body) {
    return Result.ok(inventoryService.update(id, body));
  }

  @DeleteMapping("/{id}")
  public Result<Void> delete(@PathVariable String id) {
    inventoryService.deleteHard(id);
    return Result.ok();
  }

  @PatchMapping("/{id}/soft-delete")
  public Result<Object> softDelete(@PathVariable String id) {
    return Result.ok(inventoryService.softDelete(id));
  }

  @PatchMapping("/{id}/restore")
  public Result<Object> restore(@PathVariable String id) {
    return Result.ok(inventoryService.restore(id));
  }

  @PostMapping("/trash/purge")
  public Result<Object> purge() {
    return Result.ok(java.util.Map.of("removed", inventoryService.purgeTrash()));
  }
}
