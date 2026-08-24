import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeExpiry,
  daysUntil,
  toLocalISO,
  resolveExpiry,
  getItemStatus,
  isLowStock,
  consumeOne,
  groupByName,
  getGroupStock,
  getGroupStatus,
  isGroupLowStock,
  getGroupThreshold,
  sortBatchesForUse,
  getSuggestedFirstBatch,
  needsUseFirstReminder,
  summarize,
  deriveCategory,
} from '../js/logic.js';

// 固定“现在”以便断言可复现
const NOW = new Date('2026-08-13T12:00:00');

test('computeExpiry: 生产日期 + 天数 => 正确过期日', () => {
  const d = computeExpiry('2026-01-01', 30);
  assert.equal(d.toISOString().slice(0, 10), '2026-01-31');
});

test('computeExpiry: 跨月进位', () => {
  const d = computeExpiry('2026-01-31', 1);
  assert.equal(d.toISOString().slice(0, 10), '2026-02-01');
});

test('computeExpiry: 缺参数返回 null', () => {
  assert.equal(computeExpiry(null, 30), null);
  assert.equal(computeExpiry('2026-01-01', null), null);
  assert.equal(computeExpiry('', 30), null);
});

test('resolveExpiry: 仅生产日期+保质期 也能算出过期日（用户不知道过期日）', () => {
  const item = { productionDate: '2026-01-01', shelfLifeDays: 180 };
  const exp = resolveExpiry(item);
  assert.equal(daysUntil(exp, new Date('2026-01-01')), 180);
});

test('getItemStatus: 只填生产日期+天数，状态判定正确', () => {
  const item = { productionDate: '2026-08-01', shelfLifeDays: 30 }; // 过期日 2026-08-31
  assert.equal(getItemStatus(item, new Date('2026-08-20')), 'ok');       // 距过期 11 天
  assert.equal(getItemStatus(item, new Date('2026-08-25')), 'expiring'); // 距过期 6 天 ≤ 7
  assert.equal(getItemStatus(item, new Date('2026-09-01')), 'expired');  // 已过 1 天
});


test('daysUntil: 当天=0, 未来为正, 过去为负', () => {
  assert.equal(daysUntil('2026-08-13', NOW), 0);
  assert.equal(daysUntil('2026-08-20', NOW), 7);
  assert.equal(daysUntil('2026-08-10', NOW), -3);
});

test('resolveExpiry: 优先用直接填的过期日', () => {
  const item = { expiryDate: '2026-09-01', productionDate: '2026-01-01', shelfLifeDays: 30 };
  assert.equal(resolveExpiry(item).toISOString().slice(0, 10), '2026-09-01');
});

test('resolveExpiry: 无过期日则用生产日期+天数推算', () => {
  const item = { productionDate: '2026-01-01', shelfLifeDays: 30 };
  assert.equal(resolveExpiry(item).toISOString().slice(0, 10), '2026-01-31');
});

test('getItemStatus: 已过期', () => {
  const item = { expiryDate: '2026-08-10' };
  assert.equal(getItemStatus(item, NOW), 'expired');
});

test('getItemStatus: 临期(默认阈值7天)内 => expiring', () => {
  const item = { expiryDate: '2026-08-18' }; // 5天后
  assert.equal(getItemStatus(item, NOW), 'expiring');
});

test('getItemStatus: 超过默认阈值 => ok', () => {
  const item = { expiryDate: '2026-08-25' }; // 12天后
  assert.equal(getItemStatus(item, NOW), 'ok');
});

test('getItemStatus: 用物品自定阈值', () => {
  const item = { expiryDate: '2026-08-25', expiringSoonDays: 15 }; // 12天后 ≤15
  assert.equal(getItemStatus(item, NOW), 'expiring');
});

test('getItemStatus: 同物品可自选临期天数(默认7→ok, 设15→expiring)', () => {
  // 过期日 12 天后。牛奶可设 5/7 天认为不临期，也可设 15 天认为临期——完全由用户决定
  const base = { expiryDate: '2026-08-25' };
  assert.equal(getItemStatus(base, NOW), 'ok'); // 不填 → 默认 7 天，12>7 → ok
  assert.equal(getItemStatus({ ...base, expiringSoonDays: 15 }, NOW), 'expiring'); // 设 15 → 临期
  assert.equal(getItemStatus({ ...base, expiringSoonDays: 5 }, NOW), 'ok'); // 设 5 → 仍不临期
});

test('getItemStatus: 生产日期+天数推算为过去 => expired', () => {
  const item = { productionDate: '2026-01-01', shelfLifeDays: 30 }; // 2026-01-31
  assert.equal(getItemStatus(item, NOW), 'expired');
});

test('getItemStatus: 无过期信息 => ok', () => {
  const item = { name: '无日期物品' };
  assert.equal(getItemStatus(item, NOW), 'ok');
});

test('isLowStock: 数量≤阈值 => true', () => {
  assert.equal(isLowStock({ quantity: 2, lowStockThreshold: 2 }), true);
  assert.equal(isLowStock({ quantity: 1, lowStockThreshold: 2 }), true);
});

test('isLowStock: 数量>阈值 => false', () => {
  assert.equal(isLowStock({ quantity: 3, lowStockThreshold: 2 }), false);
});

test('isLowStock: 未设阈值 => false', () => {
  assert.equal(isLowStock({ quantity: 0 }), false);
  assert.equal(isLowStock({ quantity: 0, lowStockThreshold: '' }), false);
});

test('consumeOne: 数量>1 减 1', () => {
  const r = consumeOne({ id: '1', quantity: 3 });
  assert.equal(r.action, 'update');
  assert.equal(r.item.quantity, 2);
});

test('consumeOne: 数量==1 提示删除', () => {
  const item = { id: '1', quantity: 1, name: '旧牛奶' };
  const r = consumeOne(item);
  assert.equal(r.action, 'delete');
  assert.equal(r.item, item);
});

test('consumeOne: 数量<=0 无需操作', () => {
  assert.equal(consumeOne({ quantity: 0 }).action, 'none');
});

test('deriveCategory: 只用于筛选，没填分类显示为「未分类」', () => {
  assert.equal(deriveCategory('牛奶', '乳制品'), '乳制品');
  assert.equal(deriveCategory('牛奶', ''), '未分类');
  assert.equal(deriveCategory('牛奶', '   '), '未分类');
  assert.equal(deriveCategory('', '  '), '未分类');
  assert.equal(deriveCategory('', ''), '未分类');
});

test('groupByName: 同名不同批次聚成一组', () => {
  const items = [
    { id: '1', name: '牛奶', batchLabel: '旧批', location: 'A' },
    { id: '2', name: '牛奶', batchLabel: '新批', location: 'B' },
    { id: '3', name: '饼干', location: 'C' },
  ];
  const groups = groupByName(items);
  assert.equal(groups.length, 2);
  const milk = groups.find((g) => g.name === '牛奶');
  assert.equal(milk.batches.length, 2);
  assert.deepEqual(milk.batches.map((b) => b.batchLabel), ['旧批', '新批']);
});

test('groupByName: 名称前后空格视为同组', () => {
  const items = [
    { id: '1', name: ' 牛奶 ' },
    { id: '2', name: '牛奶' },
  ];
  const groups = groupByName(items);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, '牛奶');
  assert.equal(groups[0].batches.length, 2);
});

test('groupByName: 无名称归到「未命名」', () => {
  const items = [
    { id: '1' },
    { id: '2', name: '' },
  ];
  const groups = groupByName(items);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, '未命名');
});

test('isGroupLowStock: 同名不同批次按总库存判断(旧2+新3=5, 阈值3 不报警)', () => {
  const group = {
    name: '牛奶',
    batches: [
      { name: '牛奶', batchLabel: '旧批', quantity: 2, lowStockThreshold: 3 },
      { name: '牛奶', batchLabel: '新批', quantity: 3, lowStockThreshold: 3 },
    ],
  };
  assert.equal(getGroupStock(group), 5);
  assert.equal(isGroupLowStock(group), false); // 5 > 3 不报警
});

test('isGroupLowStock: 同名总库存降到阈值以下才报警', () => {
  const group = {
    name: '牛奶',
    batches: [
      { name: '牛奶', batchLabel: '旧批', quantity: 1, lowStockThreshold: 3 },
      { name: '牛奶', batchLabel: '新批', quantity: 1, lowStockThreshold: 3 },
    ],
  };
  assert.equal(getGroupStock(group), 2);
  assert.equal(isGroupLowStock(group), true); // 2 <= 3 报警
});

test('getGroupStock: 总库存聚合', () => {
  const group = {
    name: '牛奶',
    batches: [
      { quantity: 1 },
      { quantity: 3 },
      { quantity: '2' }, // 字符串也兼容
    ],
  };
  assert.equal(getGroupStock(group), 6);
});

test('getGroupStatus: 任一过期 => expired', () => {
  const group = {
    name: '牛奶',
    batches: [
      { expiryDate: '2026-09-30' },
      { expiryDate: '2026-08-10' },
    ],
  };
  assert.equal(getGroupStatus(group, NOW), 'expired');
});

test('getGroupStatus: 无过期 => ok', () => {
  const group = {
    name: '抽纸',
    batches: [{ quantity: 5 }],
  };
  assert.equal(getGroupStatus(group, NOW), 'ok');
});

test('isGroupLowStock: 总库存按组内最小阈值判断', () => {
  const group = {
    name: '牛奶',
    batches: [
      { quantity: 2, lowStockThreshold: 3 },
      { quantity: 1, lowStockThreshold: 5 }, // 阈值最低 3
    ],
  };
  assert.equal(isGroupLowStock(group), true); // 总库存 3 ≤ 3
});

test('isGroupLowStock: 总库存充足 => false', () => {
  const group = {
    name: '牛奶',
    batches: [
      { quantity: 5, lowStockThreshold: 3 },
    ],
  };
  assert.equal(isGroupLowStock(group), false);
});

test('sortBatchesForUse: 过期日早的排前面', () => {
  const batches = [
    { id: 'new', expiryDate: '2026-09-30' },
    { id: 'old', expiryDate: '2026-08-15' },
  ];
  const sorted = sortBatchesForUse(batches, NOW);
  assert.equal(sorted[0].id, 'old');
  assert.equal(sorted[1].id, 'new');
});

test('getSuggestedFirstBatch: 返回应先用的一批', () => {
  const group = {
    name: '牛奶',
    batches: [
      { id: 'new', expiryDate: '2026-09-30' },
      { id: 'old', expiryDate: '2026-08-15' },
    ],
  };
  const first = getSuggestedFirstBatch(group, NOW);
  assert.equal(first.id, 'old');
});

test('needsUseFirstReminder: 多批次且旧批有库存 => true', () => {
  const group = {
    name: '牛奶',
    batches: [
      { id: 'new', expiryDate: '2026-09-30', quantity: 4 },
      { id: 'old', expiryDate: '2026-08-15', quantity: 1 },
    ],
  };
  assert.equal(needsUseFirstReminder(group, NOW), true);
});

test('needsUseFirstReminder: 单批次 => false', () => {
  const group = {
    name: '牛奶',
    batches: [{ id: 'only', expiryDate: '2026-08-15', quantity: 1 }],
  };
  assert.equal(needsUseFirstReminder(group, NOW), false);
});

test('getGroupThreshold: 取组内最小的设置阈值', () => {
  const group = {
    name: '牛奶',
    batches: [
      { quantity: 2, lowStockThreshold: 3 },
      { quantity: 3, lowStockThreshold: 5 },
    ],
  };
  assert.equal(getGroupThreshold(group), 3);
});

test('summarize: 按名称聚合统计正确(牛奶旧2+新3=总5, 阈值3 不低库存但需先用)', () => {
  const items = [
    // 牛奶（阈值3）：旧2 + 新3 = 5 > 3 → 不低库存，但有两批 → 需先用提醒
    { id: '1', category: '食品', name: '牛奶', batchLabel: '旧批', quantity: 2, lowStockThreshold: 3, productionDate: '2026-08-01', shelfLifeDays: 30 },
    { id: '2', category: '食品', name: '牛奶', batchLabel: '新批', quantity: 3, lowStockThreshold: 3, productionDate: '2026-08-10', shelfLifeDays: 30 },
    // 药类：已过期
    { id: '3', category: '药品', name: '感冒药', quantity: 1, expiryDate: '2026-08-10' },
    // 纸巾：充足
    { id: '4', category: '日用品', name: '抽纸', quantity: 10, lowStockThreshold: 2 },
  ];
  const s = summarize(items, NOW);
  assert.equal(s.total, 3); // 牛奶、感冒药、抽纸
  assert.equal(s.expired, 1); // 感冒药
  assert.equal(s.expiring, 0);
  assert.equal(s.low, 0); // 牛奶 5>3，抽纸 10>2
  assert.equal(s.suggest, 1); // 牛奶有两批
});

test('consumeOne: 小数数量(0.5)用掉1 应直接删除而非负库存(BUG-A回归)', () => {
  const r = consumeOne({ id: 'x', name: '大米', quantity: 0.5, unit: 'kg' });
  assert.equal(r.action, 'delete'); // 0.5 <= 1 → 视为用完删除，杜绝 -0.5
});

test('needsUseFirstReminder: 最早批已过期不应建议先用(BUG-B回归)', () => {
  const group = {
    name: '牛奶',
    batches: [
      { id: '1', name: '牛奶', quantity: 1, expiryDate: '2026-08-10' }, // 已过期
      { id: '2', name: '牛奶', quantity: 2, expiryDate: '2026-09-30' },
    ],
  };
  const NOW = new Date('2026-08-20');
  assert.equal(needsUseFirstReminder(group, NOW), false);
});

test('consumeOne: 用掉N个-库存大于N则递减N', () => {
  const r = consumeOne({ id: 'x', name: '大米', quantity: 10, unit: 'kg' }, 3);
  assert.equal(r.action, 'update');
  assert.equal(r.item.quantity, 7);
});

test('consumeOne: 用掉N个-库存等于N则删除', () => {
  const r = consumeOne({ id: 'x', name: '鸡蛋', quantity: 4 }, 4);
  assert.equal(r.action, 'delete');
});

test('consumeOne: 用掉N个-库存小于N则删除(不出现负库存)', () => {
  const r = consumeOne({ id: 'x', name: '鸡蛋', quantity: 2 }, 5);
  assert.equal(r.action, 'delete');
});

test('consumeOne: 默认 amount=1 保持原语义(BUG-A回归)', () => {
  const r = consumeOne({ id: 'x', name: '盐', quantity: 2 });
  assert.equal(r.action, 'update');
  assert.equal(r.item.quantity, 1);
});

// V1.2 修复回归：低库存阈值默认值与边界
test('isLowStock: 阈值=数量 仍应视为低库存', () => {
  assert.equal(isLowStock({ quantity: 2, lowStockThreshold: 2 }), true);
});

test('isGroupLowStock: 单批次数量等于阈值 应报警', () => {
  const group = { name: '牛奶', batches: [{ quantity: 2, lowStockThreshold: 2 }] };
  assert.equal(isGroupLowStock(group), true);
});

// V1.2 修复回归：空分类统一显示为「未分类」，与筛选一致
test('deriveCategory: 空分类返回未分类，用于筛选一致性', () => {
  assert.equal(deriveCategory('牛奶', ''), '未分类');
});

// V1.2 修复回归：日期按本地时间解析，避免 UTC 偏移导致天数差一
test('daysUntil: 正时区午夜前后不应差一天', () => {
  // 模拟东八区 8月15日 00:30，到 8月28日 应为 13 天
  const beijing = new Date('2026-08-15T00:30:00+08:00');
  assert.equal(daysUntil('2026-08-28', beijing), 13);
});

test('toLocalISO: 返回本地日期 YYYY-MM-DD', () => {
  const d = new Date('2026-08-15T00:30:00+08:00');
  assert.equal(toLocalISO(d), '2026-08-15');
});

test('toLocalISO: UTC 午夜时间在东八区仍返回正确本地日期', () => {
  const d = new Date('2026-08-14T16:30:00Z'); // UTC 8月14日 16:30 = 东八区 8月15日 00:30
  assert.equal(d.getDate(), 15); // 验证测试假设：本地日期是15号
  assert.equal(toLocalISO(d), '2026-08-15');
});
