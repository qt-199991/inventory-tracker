/// 全局常量：接口地址、默认参数
class Constants {
  /// 后端基础地址。
  /// 注意：Android 模拟器访问本机后端需用 10.0.2.2 而非 localhost；
  /// 真机需用电脑局域网 IP。建议按 flavor / 环境变量区分。
  static const String baseUrl = 'http://10.0.2.2:8080/api';

  // —— 接口路径（与 backend_api_design.md 一一对应）——
  static const String login = '/auth/login';        // POST 登录
  static const String inventory = '/inventory';     // POST 新增/入库
  static const String items = '/items';             // GET 列表 / DELETE 删主档
  static const String itemDetail = '/items/';       // GET/PUT 前缀: /items/{id}
  static const String batches = '/batches/';        // PUT/DELETE 前缀: /batches/{id}
  static const String consume = '/consume';         // POST: /batches/{id}/consume
  static const String dashboard = '/dashboard';     // GET 看板

  // 分页默认
  static const int defaultPage = 1;
  static const int defaultSize = 20;
}
