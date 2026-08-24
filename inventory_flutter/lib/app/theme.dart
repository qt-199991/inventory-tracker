import 'package:flutter/material.dart';

/// 全局主题：状态色标与 PWA 版、看板四区保持一致
/// 🔴已过期 / 🟠即将过期 / 🟡库存不足 / 🟢建议先用
class AppTheme {
  // 状态色
  static const Color expired = Color(0xFFE53935);        // 红 - 已过期
  static const Color expiringSoon = Color(0xFFFF9800);   // 橙 - 即将过期
  static const Color lowStock = Color(0xFFFBC02D);       // 黄 - 库存不足
  static const Color suggestUse = Color(0xFF43A047);     // 绿 - 建议先用

  static ThemeData get light => ThemeData(
        useMaterial3: true,
        primarySwatch: Colors.teal,
        scaffoldBackgroundColor: const Color(0xFFF5F5F5),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.teal,
          foregroundColor: Colors.white,
        ),
      );
}
