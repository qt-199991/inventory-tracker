import 'package:flutter/material.dart';
import 'routes.dart';
import '../pages/login/login_page.dart';
import '../pages/dashboard/dashboard_page.dart';
// 其余页面在 Task 2 生成后按 Routes 常量补充 import 与路由表

/// 应用根组件：配置主题、路由表、初始页
class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '物品库存清单',
      theme: AppTheme.light,
      initialRoute: Routes.login,
      routes: {
        Routes.login: (ctx) => const LoginPage(),
        Routes.dashboard: (ctx) => const DashboardPage(),
        // TODO(Task2): 注册 itemList / itemDetail / inventoryAdd / batchEdit
      },
    );
  }
}
