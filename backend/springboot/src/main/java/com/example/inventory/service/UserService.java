package com.example.inventory.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.example.inventory.entity.User;
import com.example.inventory.mapper.UserMapper;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserService {

  private final UserMapper userMapper;

  public UserService(UserMapper userMapper) {
    this.userMapper = userMapper;
  }

  /** 用户列表（隐藏密码哈希与 salt） */
  public List<User> listPublic() {
    return userMapper.selectList(Wrappers.lambdaQuery(User.class).orderByAsc(User::getUsername))
        .stream().peek(u -> { u.setPasswordHash(null); u.setSalt(null); }).collect(Collectors.toList());
  }

  public void importUser(User u) {
    if (u == null || u.getUsername() == null || u.getUsername().isBlank()) return;
    if (userMapper.selectOne(Wrappers.lambdaQuery(User.class).eq(User::getUsername, u.getUsername())) != null) return;
    if (u.getId() == null || u.getId().isBlank()) u.setId(java.util.UUID.randomUUID().toString());
    if (u.getCreatedAt() == null) u.setCreatedAt(java.time.LocalDateTime.now());
    if (u.getSalt() == null) u.setSalt(com.example.inventory.util.PasswordUtil.genSalt());
    if (u.getPasswordHash() == null) u.setPasswordHash(com.example.inventory.util.PasswordUtil.hash(u.getPassword() != null ? u.getPassword() : "changeme123", u.getSalt()));
    userMapper.insert(u);
  }
}
