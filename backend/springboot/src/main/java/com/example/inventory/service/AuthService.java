package com.example.inventory.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.example.inventory.common.BizException;
import com.example.inventory.common.ErrorCode;
import com.example.inventory.entity.User;
import com.example.inventory.mapper.UserMapper;
import com.example.inventory.util.JwtUtil;
import com.example.inventory.util.PasswordUtil;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class AuthService {

  private final UserMapper userMapper;
  private final JwtUtil jwtUtil;

  public AuthService(UserMapper userMapper, JwtUtil jwtUtil) {
    this.userMapper = userMapper;
    this.jwtUtil = jwtUtil;
  }

  public Map<String, Object> login(String username, String password) {
    User u = userMapper.selectOne(Wrappers.lambdaQuery(User.class).eq(User::getUsername, username));
    if (u == null || !PasswordUtil.verify(password, u.getSalt(), u.getPasswordHash())) {
      throw new BizException(ErrorCode.UNAUTHORIZED, "用户名或密码错误");
    }
    return tokenMap(u);
  }

  public Map<String, Object> register(String username, String password) {
    if (username == null || username.isBlank() || password == null || password.isBlank()) {
      throw new BizException(ErrorCode.PARAM_INVALID, "用户名和密码都要填");
    }
    if (password.length() < 4) {
      throw new BizException(ErrorCode.PARAM_INVALID, "密码至少 4 位");
    }
    if (userMapper.selectOne(Wrappers.lambdaQuery(User.class).eq(User::getUsername, username)) != null) {
      throw new BizException(ErrorCode.CONFLICT, "该用户名已被占用");
    }
    String salt = PasswordUtil.genSalt();
    User u = new User();
    u.setId(UUID.randomUUID().toString());
    u.setUsername(username);
    u.setSalt(salt);
    u.setPasswordHash(PasswordUtil.hash(password, salt));
    u.setCreatedAt(LocalDateTime.now());
    userMapper.insert(u);
    return tokenMap(u);
  }

  private Map<String, Object> tokenMap(User u) {
    String token = jwtUtil.generate(u.getId(), u.getUsername());
    Map<String, Object> m = new HashMap<>();
    m.put("token", token);
    m.put("tokenType", "Bearer");
    m.put("expiresIn", jwtUtil.getExpirationSeconds());
    m.put("username", u.getUsername());
    m.put("userId", u.getId());
    return m;
  }
}
