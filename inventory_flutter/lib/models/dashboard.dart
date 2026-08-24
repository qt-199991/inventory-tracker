/// 看板数据（对应 GET /api/dashboard 返回）
class DashboardData {
  final DashboardCounts counts;
  final List<DashboardItem> expired;
  final List<DashboardItem> expiringSoon;
  final List<DashboardItem> lowStock;
  final List<DashboardItem> suggestUseFirst;

  DashboardData({
    required this.counts,
    required this.expired,
    required this.expiringSoon,
    required this.lowStock,
    required this.suggestUseFirst,
  });

  factory DashboardData.fromJson(Map<String, dynamic> j) => DashboardData(
        counts: DashboardCounts.fromJson(j['counts'] as Map<String, dynamic>),
        expired: (j['expired'] as List)
            .map((e) => DashboardItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        expiringSoon: (j['expiringSoon'] as List)
            .map((e) => DashboardItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        lowStock: (j['lowStock'] as List)
            .map((e) => DashboardItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        suggestUseFirst: (j['suggestUseFirst'] as List)
            .map((e) => DashboardItem.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class DashboardCounts {
  final int totalItems;
  final int totalBatches;
  final int expired;
  final int expiringSoon;
  final int lowStock;
  final int suggestUseFirst;

  DashboardCounts({
    required this.totalItems,
    required this.totalBatches,
    required this.expired,
    required this.expiringSoon,
    required this.lowStock,
    required this.suggestUseFirst,
  });

  factory DashboardCounts.fromJson(Map<String, dynamic> j) => DashboardCounts(
        totalItems: j['totalItems'] as int,
        totalBatches: j['totalBatches'] as int,
        expired: j['expired'] as int,
        expiringSoon: j['expiringSoon'] as int,
        lowStock: j['lowStock'] as int,
        suggestUseFirst: j['suggestUseFirst'] as int,
      );
}

/// 看板四区中的单条物品摘要
class DashboardItem {
  final int id;
  final String name;
  final String? earliestExpiry;
  final int? daysLeft;
  final int? totalStock;
  final int? threshold;

  DashboardItem({
    required this.id,
    required this.name,
    this.earliestExpiry,
    this.daysLeft,
    this.totalStock,
    this.threshold,
  });

  factory DashboardItem.fromJson(Map<String, dynamic> j) => DashboardItem(
        id: j['id'] as int,
        name: j['name'] as String,
        earliestExpiry: j['earliestExpiry'] as String?,
        daysLeft: j['daysLeft'] as int?,
        totalStock: j['totalStock'] as int?,
        threshold: j['threshold'] as int?,
      );
}
