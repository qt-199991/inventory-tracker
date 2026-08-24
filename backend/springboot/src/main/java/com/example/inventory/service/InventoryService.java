package com.example.inventory.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.example.inventory.common.BizException;
import com.example.inventory.common.ErrorCode;
import com.example.inventory.dto.req.BatchRequest;
import com.example.inventory.entity.InventoryBatch;
import com.example.inventory.mapper.InventoryBatchMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class InventoryService {

  private static final int TRASH_DAYS = 30;
  private final InventoryBatchMapper batchMapper;

  public InventoryService(InventoryBatchMapper batchMapper) {
    this.batchMapper = batchMapper;
  }

  public InventoryBatch create(BatchRequest req, String ownerId) {
    InventoryBatch b = toEntity(req);
    b.setId(req.getId() != null && !req.getId().isBlank() ? req.getId() : UUID.randomUUID().toString());
    b.setOwnerId(ownerId);
    LocalDateTime now = LocalDateTime.now();
    b.setCreatedAt(now);
    b.setUpdatedAt(now);
    b.setDeletedAt(null);
    batchMapper.insert(b);
    return b;
  }

  public InventoryBatch update(String id, BatchRequest req) {
    InventoryBatch b = batchMapper.selectById(id);
    if (b == null) throw new BizException(ErrorCode.NOT_FOUND, "物品不存在");
    apply(req, b);
    b.setUpdatedAt(LocalDateTime.now());
    batchMapper.updateById(b);
    return b;
  }

  public InventoryBatch get(String id) {
    InventoryBatch b = batchMapper.selectById(id);
    if (b == null) throw new BizException(ErrorCode.NOT_FOUND, "物品不存在");
    return b;
  }

  public void deleteHard(String id) {
    if (batchMapper.selectById(id) == null) throw new BizException(ErrorCode.NOT_FOUND, "物品不存在");
    batchMapper.deleteById(id);
  }

  public InventoryBatch softDelete(String id) {
    InventoryBatch b = get(id);
    b.setDeletedAt(LocalDateTime.now());
    b.setUpdatedAt(b.getDeletedAt());
    batchMapper.updateById(b);
    return b;
  }

  public InventoryBatch restore(String id) {
    InventoryBatch b = get(id);
    b.setDeletedAt(null);
    b.setUpdatedAt(LocalDateTime.now());
    batchMapper.updateById(b);
    return b;
  }

  public List<InventoryBatch> list(String filter) {
    var q = Wrappers.lambdaQuery(InventoryBatch.class);
    if ("active".equals(filter)) q.isNull(InventoryBatch::getDeletedAt);
    else if ("trashed".equals(filter)) q.isNotNull(InventoryBatch::getDeletedAt);
    q.orderByDesc(InventoryBatch::getUpdatedAt);
    return batchMapper.selectList(q);
  }

  /** 清理超过 30 天的回收站记录，返回清除数量 */
  public int purgeTrash() {
    LocalDateTime cutoff = LocalDateTime.now().minusDays(TRASH_DAYS);
    return batchMapper.delete(
        Wrappers.lambdaQuery(InventoryBatch.class)
            .isNotNull(InventoryBatch::getDeletedAt)
            .lt(InventoryBatch::getDeletedAt, cutoff));
  }

  public void importBatch(InventoryBatch b) {
    if (b.getId() == null || b.getId().isBlank()) b.setId(UUID.randomUUID().toString());
    if (b.getCreatedAt() == null) b.setCreatedAt(LocalDateTime.now());
    if (b.getUpdatedAt() == null) b.setUpdatedAt(LocalDateTime.now());
    InventoryBatch existing = batchMapper.selectById(b.getId());
    if (existing != null) batchMapper.updateById(b);
    else batchMapper.insert(b);
  }

  // ---------- 映射 ----------
  private InventoryBatch toEntity(BatchRequest req) {
    InventoryBatch b = new InventoryBatch();
    apply(req, b);
    return b;
  }
  private void apply(BatchRequest req, InventoryBatch b) {
    if (req.getName() != null) b.setName(req.getName());
    if (req.getCategory() != null) b.setCategory(req.getCategory());
    if (req.getLocation() != null) b.setLocation(req.getLocation());
    if (req.getQuantity() != null) b.setQuantity(req.getQuantity());
    if (req.getUnit() != null) b.setUnit(req.getUnit());
    if (req.getProductionDate() != null) b.setProductionDate(req.getProductionDate());
    if (req.getExpiryDate() != null) b.setExpiryDate(req.getExpiryDate());
    if (req.getShelfLifeDays() != null) b.setShelfLifeDays(req.getShelfLifeDays());
    if (req.getLowStockThreshold() != null) b.setLowStockThreshold(req.getLowStockThreshold());
    if (req.getExpiringSoonDays() != null) b.setExpiringSoonDays(req.getExpiringSoonDays());
    if (req.getBatchLabel() != null) b.setBatchLabel(req.getBatchLabel());
    if (req.getNote() != null) b.setNote(req.getNote());
    if (req.getPhoto() != null) b.setPhoto(req.getPhoto());
  }
}
