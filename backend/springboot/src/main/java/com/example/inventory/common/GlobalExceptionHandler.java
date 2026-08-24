package com.example.inventory.common;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(BizException.class)
  public Result<Void> handleBiz(BizException e) {
    return Result.fail(e.getCode(), e.getMessage());
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public Result<Void> handleValid(MethodArgumentNotValidException e) {
    String msg = e.getBindingResult().getFieldErrors().stream()
        .findFirst().map(f -> f.getField() + " " + f.getDefaultMessage()).orElse("参数校验失败");
    return Result.fail(ErrorCode.PARAM_INVALID, msg);
  }

  @ExceptionHandler(Exception.class)
  public Result<Void> handleOther(Exception e, HttpServletRequest req) {
    return Result.fail(ErrorCode.SERVER_ERROR, e.getMessage() == null ? "服务器错误" : e.getMessage());
  }
}
