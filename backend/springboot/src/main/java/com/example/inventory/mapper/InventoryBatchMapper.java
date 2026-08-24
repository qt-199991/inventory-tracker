package com.example.inventory.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.inventory.entity.InventoryBatch;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface InventoryBatchMapper extends BaseMapper<InventoryBatch> {
}
