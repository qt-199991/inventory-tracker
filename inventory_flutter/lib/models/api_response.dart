/// 后端统一返回结构：{ code, message, data, timestamp }
class ApiResponse<T> {
  final int code;
  final String message;
  final T? data;
  final int timestamp;

  ApiResponse({
    required this.code,
    required this.message,
    this.data,
    required this.timestamp,
  });

  /// [fromData] 将 data 字段转换为具体类型（列表/对象）
  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T? Function(dynamic)? fromData,
  ) {
    return ApiResponse<T>(
      code: json['code'] as int,
      message: json['message'] as String,
      data: json['data'] == null ? null : fromData?.call(json['data']),
      timestamp: json['timestamp'] as int,
    );
  }

  /// 业务成功判定（code == 0）
  bool get success => code == 0;
}
