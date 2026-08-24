import 'package:flutter/material.dart';
import 'app/app.dart';

/// 应用入口
/// 后续在此完成依赖初始化（Provider / SharedPreferences / Dio 实例等），
/// 例如：final prefs = await SharedPreferences.getInstance();
void main() {
  // WidgetsFlutterBinding.ensureInitialized(); // 如需异步初始化插件时开启
  runApp(const App());
}
