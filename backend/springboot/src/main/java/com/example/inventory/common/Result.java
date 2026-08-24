package com.example.inventory.common;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.HashMap;
import java.util.Map;

/** 统一返回：{ code, message, data, timestamp } */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Result<T> {
  private int code;
  private String message;
  private T data;
  private long timestamp = System.currentTimeMillis();

  public static <T> Result<T> ok(T data) {
    return new Result<>(0, "success", data, System.currentTimeMillis());
  }
  public static Result<Void> ok() {
    return new Result<>(0, "success", null, System.currentTimeMillis());
  }
  public static Result<Void> fail(int code, String message) {
    return new Result<>(code, message, null, System.currentTimeMillis());
  }
}
