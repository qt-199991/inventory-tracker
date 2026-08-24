package com.example.inventory.controller;

import com.example.inventory.common.Result;
import com.example.inventory.dto.req.LoginRequest;
import com.example.inventory.dto.req.RegisterRequest;
import com.example.inventory.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

  private final AuthService authService;

  public AuthController(AuthService authService) {
    this.authService = authService;
  }

  @PostMapping("/login")
  public Result<Object> login(@Valid @RequestBody LoginRequest req) {
    return Result.ok(authService.login(req.getUsername(), req.getPassword()));
  }

  @PostMapping("/register")
  public Result<Object> register(@Valid @RequestBody RegisterRequest req) {
    return Result.ok(authService.register(req.getUsername(), req.getPassword()));
  }
}
