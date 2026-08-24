import 'package:shared_preferences/shared_preferences.dart';

/// 本地存储：Token 持久化 + 用户信息
/// 用于请求拦截器自动附加 Authorization，以及 401 时清登录态。
class Storage {
  static const String _tokenKey = 'auth_token';
  static const String _usernameKey = 'username';

  static Future<void> setToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  static Future<void> setUsername(String username) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_usernameKey, username);
  }

  /// 退出登录：清空本地凭证
  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_usernameKey);
  }
}
