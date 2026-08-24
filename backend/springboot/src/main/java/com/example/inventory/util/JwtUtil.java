package com.example.inventory.util;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/** HS256 JWT 工具（jjwt 0.12.x） */
@Component
public class JwtUtil {

  @Value("${jwt.secret}")
  private String secret;

  @Value("${jwt.expiration:604800}")
  private long expirationSeconds;

  private SecretKey key() {
    return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
  }

  public String generate(String userId, String username) {
    long now = System.currentTimeMillis();
    return Jwts.builder()
        .subject(userId)
        .claim("username", username)
        .issuedAt(new Date(now))
        .expiration(new Date(now + expirationSeconds * 1000L))
        .signWith(key())
        .compact();
  }

  public Claims parse(String token) {
    return Jwts.parser().verifyWith(key()).build().parseSignedClaims(token).getPayload();
  }

  public long getExpirationSeconds() { return expirationSeconds; }
}
