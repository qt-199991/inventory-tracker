/// 路由名称常量（集中管理，避免硬编码字符串散落各处）
class Routes {
  static const String login = '/login';            // 登录
  static const String dashboard = '/dashboard';     // 看板首页
  static const String itemList = '/items';          // 物品列表
  static const String itemDetail = '/items/detail'; // 物品详情 + 批次
  static const String inventoryAdd = '/inventory/add'; // 新增/入库表单
  static const String batchEdit = '/batch/edit';    // 批次编辑
}
