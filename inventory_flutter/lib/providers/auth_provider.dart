import 'package:flutter/material.dart';

/// 鉴权状态管理（Task 4 完整实现：login / logout、Token 状态、自动登录判断）
class AuthProvider extends ChangeNotifier {
  bool _isLoggedIn = false;
  bool get isLoggedIn => _isLoggedIn;

  // TODO(Task4): 登录成功后 _isLoggedIn = true; notifyListeners();
  // TODO(Task4): 启动时读取 Storage.getToken() 恢复登录态
}
