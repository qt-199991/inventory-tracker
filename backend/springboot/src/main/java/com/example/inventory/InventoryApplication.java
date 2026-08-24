package com.example.inventory;

import com.baomidou.mybatisplus.core.toolkit.StringUtils;
import com.example.inventory.entity.User;
import com.example.inventory.mapper.UserMapper;
import com.example.inventory.util.PasswordUtil;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class InventoryApplication {

  public static void main(String[] args) {
    SpringApplication.run(InventoryApplication.class, args);
  }

  /** 启动时确保默认 Owner 账号存在（单账号多设备共享） */
  @Bean
  public ApplicationRunner seedOwner(UserMapper userMapper,
                                     org.springframework.core.env.Environment env) {
    return (ApplicationArguments args) -> {
      String owner = env.getProperty("owner.user", "admin");
      long count = userMapper.selectCount(
          com.baomidou.mybatisplus.core.toolkit.Wrappers.lambdaQuery(User.class).eq(User::getUsername, owner));
      if (count == 0) {
        String salt = PasswordUtil.genSalt();
        User u = new User();
        u.setId(java.util.UUID.randomUUID().toString());
        u.setUsername(owner);
        u.setSalt(salt);
        u.setPasswordHash(PasswordUtil.hash(env.getProperty("owner.pass", "admin123"), salt));
        u.setIsOwner(true);
        u.setCreatedAt(java.time.LocalDateTime.now());
        userMapper.insert(u);
      }
    };
  }
}
