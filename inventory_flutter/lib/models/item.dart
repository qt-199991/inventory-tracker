/// 物品主档（对应后端 item 表 + 列表聚合字段）
class Item {
  final int id;
  final String name;
  final String? category;
  final String? unit;
  final String? defaultLocation;
  final int? expiringSoonDays;     // 临期提醒天数（为空用默认 7）
  final double? lowStockThreshold; // 低库存阈值（为空不预警）
  final int totalStock;            // 聚合：SUM(quantity)
  final int batchCount;            // 聚合：批次数量
  final ItemFlags flags;           // 四区状态标志

  Item({
    required this.id,
    required this.name,
    this.category,
    this.unit,
    this.defaultLocation,
    this.expiringSoonDays,
    this.lowStockThreshold,
    this.totalStock = 0,
    this.batchCount = 0,
    this.flags = const ItemFlags(),
  });

  factory Item.fromJson(Map<String, dynamic> j) => Item(
        id: j['id'] as int,
        name: j['name'] as String,
        category: j['category'] as String?,
        unit: j['unit'] as String?,
        defaultLocation: j['defaultLocation'] as String?,
        expiringSoonDays: j['expiringSoonDays'] as int?,
        lowStockThreshold: (j['lowStockThreshold'] as num?)?.toDouble(),
        totalStock: (j['totalStock'] as num?)?.toInt() ?? 0,
        batchCount: (j['batchCount'] as num?)?.toInt() ?? 0,
        flags: ItemFlags.fromJson(j['flags'] as Map<String, dynamic>? ?? {}),
      );
}

/// 看板四区状态标志（与 backend flags 字段对应）
class ItemFlags {
  final bool expired;
  final bool expiringSoon;
  final bool lowStock;
  final bool suggestUseFirst;

  const ItemFlags({
    this.expired = false,
    this.expiringSoon = false,
    this.lowStock = false,
    this.suggestUseFirst = false,
  });

  factory ItemFlags.fromJson(Map<String, dynamic> j) => ItemFlags(
        expired: j['expired'] as bool? ?? false,
        expiringSoon: j['expiringSoon'] as bool? ?? false,
        lowStock: j['lowStock'] as bool? ?? false,
        suggestUseFirst: j['suggestUseFirst'] as bool? ?? false,
      );
}
