import 'package:dio/dio.dart';
import '../utils/constants.dart';
import '../utils/storage.dart';
import '../models/api_response.dart';

/// 通用网络请求封装（对接后端 REST，Task 3 完整实现）
///
/// 职责：
/// 1. 统一 baseUrl、超时、JSON 头
/// 2. 请求拦截器自动附加 Bearer Token
/// 3. 统一解析后端 { code, message, data, timestamp } 结构
/// 4. 统一异常处理：401 跳登录、业务码非 0 抛 ApiException
class ApiClient {
  late final Dio _dio;

  ApiClient() {
    _dio = Dio(BaseOptions(
      baseUrl: Constants.baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      contentType: 'application/json',
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await Storage.getToken();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (DioException e, handler) {
        // TODO(Task3): 统一异常 -> 401 清除 Token 并跳登录页
        handler.next(e);
      },
    ));
  }

  /// GET 请求，[fromData] 负责把 data 反序列化为具体类型
  Future<ApiResponse<T>> get<T>(
    String path, {
    Map<String, dynamic>? query,
    T? Function(dynamic)? fromData,
  }) async {
    final res = await _dio.get(path, queryParameters: query);
    return ApiResponse.fromJson(res.data, fromData);
  }

  Future<ApiResponse<T>> post<T>(
    String path, {
    dynamic body,
    T? Function(dynamic)? fromData,
  }) async {
    final res = await _dio.post(path, data: body);
    return ApiResponse.fromJson(res.data, fromData);
  }

  Future<ApiResponse<T>> put<T>(
    String path, {
    dynamic body,
    T? Function(dynamic)? fromData,
  }) async {
    final res = await _dio.put(path, data: body);
    return ApiResponse.fromJson(res.data, fromData);
  }

  Future<ApiResponse<T>> delete<T>(
    String path, {
    T? Function(dynamic)? fromData,
  }) async {
    final res = await _dio.delete(path);
    return ApiResponse.fromJson(res.data, fromData);
  }
}

/// 统一业务异常（code != 0 时抛出）
class ApiException implements Exception {
  final int code;
  final String message;
  ApiException(this.code, this.message);
  @override
  String toString() => 'ApiException($code): $message';
}
