/// 库存批次（对应后端 stock_batch 表）
class StockBatch {
  final int id;
  final int itemId;
  final double quantity;
  final String? location;          // 实际存放位置（可覆盖主档默认）
  final String? productionDate;    // 生产日期 yyyy-MM-dd
  final int? shelfLifeDays;        // 保质期天数
  final String? expiryDate;        // 过期日期 yyyy-MM-dd（判临期/过期以它为准）
  final String? batchTag;          // 批次标签
  final String? notes;
  // —— 下列为后端派生字段（列表/详情返回时携带）——
  final int? daysLeft;             // 距过期天数
  final bool expired;              // 是否已过期
  final bool suggestUseFirst;      // 是否“先用这箱”（最早批次）

  StockBatch({
    required this.id,
    required this.itemId,
    required this.quantity,
    this.location,
    this.productionDate,
    this.shelfLifeDays,
    this.expiryDate,
    this.batchTag,
    this.notes,
    this.daysLeft,
    this.expired = false,
    this.suggestUseFirst = false,
  });

  factory StockBatch.fromJson(Map<String, dynamic> j) => StockBatch(
        id: j['id'] as int,
        itemId: j['itemId'] as int,
        quantity: (j['quantity'] as num).toDouble(),
        location: j['location'] as String?,
        productionDate: j['productionDate'] as String?,
        shelfLifeDays: j['shelfLifeDays'] as int?,
        expiryDate: j['expiryDate'] as String?,
        batchTag: j['batchTag'] as String?,
        notes: j['notes'] as String?,
        daysLeft: j['daysLeft'] as int?,
        expired: j['expired'] as bool? ?? false,
        suggestUseFirst: j['suggestUseFirst'] as bool? ?? false,
      );
}
