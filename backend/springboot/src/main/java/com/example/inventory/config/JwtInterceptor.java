package com.example.inventory.config;

import com.example.inventory.common.BizException;
import com.example.inventory.common.ErrorCode;
import com.example.inventory.util.JwtUtil;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/** 拦截 /api/**（白名单 /api/auth/login、/api/auth/register），校验 Bearer Token */
@Component
public class JwtInterceptor implements HandlerInterceptor {

  private final JwtUtil jwtUtil;

  public JwtInterceptor(JwtUtil jwtUtil) { this.jwtUtil = jwtUtil; }

  @Override
  public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
    String uri = request.getRequestURI();
    if (uri.equals("/api/auth/login") || uri.equals("/api/auth/register")) return true;

    String auth = request.getHeader("Authorization");
    if (auth == null || !auth.startsWith("Bearer ")) {
      writeUnauthorized(response);
      return false;
    }
    try {
      Claims claims = jwtUtil.parse(auth.substring(7).trim());
      request.setAttribute("userId", claims.getSubject());
      request.setAttribute("username", claims.get("username", String.class));
      return true;
    } catch (Exception e) {
      writeUnauthorized(response);
      return false;
    }
  }

  private void writeUnauthorized(HttpServletResponse response) throws Exception {
    response.setStatus(401);
    response.setContentType("application/json;charset=utf-8");
    response.getWriter().write("{\"code\":401001,\"message\":\"未登录或登录已过期\",\"data\":null,\"timestamp\":" + System.currentTimeMillis() + "}");
  }
}
