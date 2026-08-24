package com.example.inventory.common;

/** 业务异常：携带错误码与消息 */
public class BizException extends RuntimeException {
  private final int code;

  public BizException(int code, String message) {
    super(message);
    this.code = code;
  }
  public BizException(String message) {
    this(ErrorCode.SERVER_ERROR, message);
  }

  public int getCode() { return code; }
}
