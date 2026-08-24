import 'package:flutter/material.dart';

/// 看板首页
/// Task 2 完整实现：四区统计卡片 + 各分区列表，调用 DashboardService.getDashboard()
class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('物品库存清单')),
        body: const Center(child: Text('看板首页（Task 2 实现）')),
      );
}
