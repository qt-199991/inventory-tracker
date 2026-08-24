package com.example.inventory.controller;

import com.example.inventory.common.Result;
import com.example.inventory.service.UserService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {

  private final UserService userService;

  public UserController(UserService userService) {
    this.userService = userService;
  }

  @GetMapping
  public Result<Object> list() {
    return Result.ok(userService.listPublic());
  }
}
