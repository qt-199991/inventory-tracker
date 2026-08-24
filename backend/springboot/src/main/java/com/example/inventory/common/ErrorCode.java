package com.example.inventory.common;

public final class ErrorCode {
  public static final int SUCCESS = 0;
  public static final int PARAM_INVALID = 400001;
  public static final int UNAUTHORIZED = 401001;
  public static final int NOT_FOUND = 404001;
  public static final int CONFLICT = 409001;
  public static final int SERVER_ERROR = 500000;

  private ErrorCode() {}
}
