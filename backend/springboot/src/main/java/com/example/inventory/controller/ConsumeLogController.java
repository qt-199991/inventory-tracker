package com.example.inventory.controller;

import com.example.inventory.common.Result;
import com.example.inventory.service.ConsumeLogService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/consume-logs")
public class ConsumeLogController {

  private final ConsumeLogService consumeLogService;

  public ConsumeLogController(ConsumeLogService consumeLogService) {
    this.consumeLogService = consumeLogService;
  }

  @GetMapping
  public Result<Object> list() {
    return Result.ok(consumeLogService.list());
  }

  @PostMapping
  public Result<Object> create(@RequestBody Map<String, Object> body, HttpServletRequest req) {
    String ownerId = (String) req.getAttribute("userId");
    String itemId = body.get("itemId") != null ? body.get("itemId").toString() : null;
    String name = body.get("name") != null ? body.get("name").toString() : "物品";
    BigDecimal qty = body.get("qty") != null ? new BigDecimal(body.get("qty").toString()) : BigDecimal.ZERO;
    return Result.ok(consumeLogService.create(ownerId, itemId, name, qty));
  }
}
