package com.example.inventory.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.inventory.entity.User;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMapper extends BaseMapper<User> {
}
