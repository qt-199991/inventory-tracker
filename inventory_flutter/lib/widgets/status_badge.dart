import 'package:flutter/material.dart';
import '../app/theme.dart';

/// 状态徽章：根据看板四区状态渲染对应色标
/// 🔴已过期 / 🟠即将过期 / 🟡库存不足 / 🟢建议先用
class StatusBadge extends StatelessWidget {
  final String label;
  final Color color;

  const StatusBadge({super.key, required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: color.withOpacity(0.15),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color),
        ),
        child: Text(label, style: TextStyle(color: color, fontSize: 12)),
      );
}

/// 四区便捷构造
class StatusBadges {
  static StatusBadge expired() =>
      const StatusBadge(label: '已过期', color: AppTheme.expired);
  static StatusBadge expiringSoon() =>
      const StatusBadge(label: '即将过期', color: AppTheme.expiringSoon);
  static StatusBadge lowStock() =>
      const StatusBadge(label: '库存不足', color: AppTheme.lowStock);
  static StatusBadge suggestUse() =>
      const StatusBadge(label: '建议先用', color: AppTheme.suggestUse);
}
