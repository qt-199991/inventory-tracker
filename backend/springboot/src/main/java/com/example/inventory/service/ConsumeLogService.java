package com.example.inventory.service;

import com.example.inventory.dto.req.BatchRequest;
import com.example.inventory.entity.ConsumeLog;
import com.example.inventory.mapper.ConsumeLogMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class ConsumeLogService {

  private final ConsumeLogMapper logMapper;

  public ConsumeLogService(ConsumeLogMapper logMapper) {
    this.logMapper = logMapper;
  }

  public ConsumeLog create(String ownerId, String itemId, String name, java.math.BigDecimal qty) {
    ConsumeLog log = new ConsumeLog();
    log.setId(UUID.randomUUID().toString());
    log.setOwnerId(ownerId);
    log.setItemId(itemId);
    log.setName(name);
    log.setQty(qty);
    log.setAt(LocalDateTime.now());
    logMapper.insert(log);
    return log;
  }

  public List<ConsumeLog> list() {
    return logMapper.selectList(
        com.baomidou.mybatisplus.core.toolkit.Wrappers.lambdaQuery(ConsumeLog.class)
            .orderByDesc(ConsumeLog::getAt));
  }
}
