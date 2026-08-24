package com.example.inventory.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

/** 密码哈希：SHA-256(密码 + 随机 salt)，服务端存储仅存哈希 */
public class PasswordUtil {

  public static String genSalt() {
    byte[] b = new byte[16];
    new SecureRandom().nextBytes(b);
    StringBuilder sb = new StringBuilder();
    for (byte x : b) sb.append(String.format("%02x", x));
    return sb.toString();
  }

  public static String hash(String password, String salt) {
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-256");
      byte[] digest = md.digest((password + salt).getBytes(StandardCharsets.UTF_8));
      StringBuilder sb = new StringBuilder();
      for (byte x : digest) sb.append(String.format("%02x", x));
      return sb.toString();
    } catch (Exception e) {
      throw new RuntimeException("密码哈希失败", e);
    }
  }

  public static boolean verify(String password, String salt, String hash) {
    return hash(password, salt).equals(hash);
  }
}
