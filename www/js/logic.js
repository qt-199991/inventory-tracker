// js/logic.js — 纯逻辑函数（无 DOM / 无 IndexedDB 依赖，可在 Node 中测试）

const DAY_MS = 86400000;
const DEFAULT_EXPIRING_SOON_DAYS = 7;

// 返回本地日期的 YYYY-MM-DD，避免 toISOString() 在正时区把午夜前后的数据算到前一天 UTC
export function toLocalISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 由生产日期/购买日期 + 保质期天数 算出过期日期
export function computeExpiry(productionDate, shelfLifeDays) {
  if (!productionDate || shelfLifeDays == null || shelfLifeDays === '') return null;
  const d = new Date(productionDate);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + Number(shelfLifeDays));
  return d;
}

// 把 YYYY-MM-DD 字符串按本地时间解析为 Date（避免 new Date('YYYY-MM-DD') 被当作 UTC 导致时区偏移）
function parseLocalDate(str) {
  const [y, m, day] = String(str).split('-').map(Number);
  if (!y || !m || !day) return null;
  const d = new Date(y, m - 1, day);
  return isNaN(d.getTime()) ? null : d;
}

// 距今天数（负数表示已过期）；忽略时分秒，按本地日期计算
export function daysUntil(date, now = new Date()) {
  if (!date) return null;
  const d = date instanceof Date ? parseLocalDate(toLocalISO(date)) : parseLocalDate(date);
  if (!d) return null;
  const n = parseLocalDate(toLocalISO(now));
  if (!n) return null;
  return Math.round((d.getTime() - n.getTime()) / DAY_MS);
}

// 解析有效过期日：优先用直接填的，否则用购买日期+天数推算
export function resolveExpiry(item) {
  if (item.expiryDate) {
    const d = new Date(item.expiryDate);
    if (!isNaN(d.getTime())) return d;
  }
  return computeExpiry(item.productionDate, item.shelfLifeDays);
}

// 状态判定：expired / expiring / ok（用物品自定阈值，默认 7 天）
export function getItemStatus(item, now = new Date()) {
  const exp = resolveExpiry(item);
  if (!exp) return 'ok'; // 无过期信息
  const days = daysUntil(exp, now);
  if (days < 0) return 'expired';
  const threshold = item.expiringSoonDays != null && item.expiringSoonDays !== ''
    ? Number(item.expiringSoonDays)
    : DEFAULT_EXPIRING_SOON_DAYS;
  if (days <= threshold) return 'expiring';
  return 'ok';
}

// 单批次库存是否不足
export function isLowStock(item) {
  if (item.lowStockThreshold == null || item.lowStockThreshold === '') return false;
  return Number(item.quantity) <= Number(item.lowStockThreshold);
}

// 推断分类：只用于筛选，没填分类则归为「未分类」
// 物品分组聚合始终按「名称（name）」进行，这样「牛奶」「面包」各自成卡
export function deriveCategory(name, category) {
  const c = (category || '').trim();
  return c || '未分类';
}

// 消费若干件/瓶：决定接下来该执行什么操作
// amount 默认 1；支持一次用掉 N 个（V1.1 需求）
// 返回 { action: 'update', item } | { action: 'delete', item } | { action: 'none' }
// - 数量 <= 0 或 amount <= 0：无需操作
// - 数量 <= amount：这箱已用完（或扣完），提示删除（由 UI 在确认后执行）
// - 数量 > amount：扣减 amount 后更新
export function consumeOne(item, amount = 1, now = new Date()) {
  const qty = Number(item.quantity) || 0;
  const n = Number(amount) || 0;
  if (qty <= 0 || n <= 0) return { action: 'none', item };
  // 修 BUG-A：扣完即删，杜绝小数(0.5)或超额扣减成负库存
  if (qty <= n) return { action: 'delete', item };
  return { action: 'update', item: { ...item, quantity: qty - n, updatedAt: now.toISOString() } };
}

// 按【物品名称】归组：同一规范名称下的不同批次聚合为一张卡片
// 例如 name 都填「牛奶」，批次标签分别写「旧批」「新批」，就会合并成「牛奶」一张卡
export function groupByName(items) {
  const map = new Map();
  for (const it of items) {
    const key = (it.name || '未命名').trim() || '未命名';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(it);
  }
  return [...map.entries()].map(([name, batches]) => ({ name, batches }));
}

// 分组总库存（同一类所有批次数量之和）
export function getGroupStock(group) {
  return group.batches.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
}

// 分组总体状态：任一过期 > 任一临期 > ok
export function getGroupStatus(group, now = new Date()) {
  const statuses = group.batches.map((it) => getItemStatus(it, now));
  if (statuses.includes('expired')) return 'expired';
  if (statuses.includes('expiring')) return 'expiring';
  return 'ok';
}

// 分组是否低库存：用该类总库存 与 组内设置的阈值（取最小值，最不易误报）比较
// 阈值按「同一类物品」共用：旧牛奶2 + 新牛奶3 = 总5，阈值3，5>3 不报警
export function isGroupLowStock(group) {
  const thresholds = group.batches
    .map((it) => it.lowStockThreshold)
    .filter((v) => v != null && v !== '');
  if (!thresholds.length) return false;
  const threshold = Math.min(...thresholds.map(Number));
  return getGroupStock(group) <= threshold;
}

// 分组预警阈值（取组内最小值，便于展示）
export function getGroupThreshold(group) {
  const thresholds = group.batches
    .map((it) => it.lowStockThreshold)
    .filter((v) => v != null && v !== '');
  if (!thresholds.length) return null;
  return Math.min(...thresholds.map(Number));
}

// 按「先用」顺序排序批次：过期日早 → 购买日期早 → 创建时间早
export function sortBatchesForUse(batches, now = new Date()) {
  return [...batches].sort((a, b) => {
    const ea = resolveExpiry(a), eb = resolveExpiry(b);
    if (ea && eb) return ea - eb;
    if (ea) return -1;
    if (eb) return 1;
    // 都没过期信息，按购买日期或创建时间
    const pa = a.productionDate || a.createdAt || '', pb = b.productionDate || b.createdAt || '';
    if (pa && pb) return new Date(pa) - new Date(pb);
    if (pa) return -1;
    if (pb) return 1;
    return 0;
  });
}

// 返回建议先用的那一批（多批次时才需要提醒）
export function getSuggestedFirstBatch(group, now = new Date()) {
  if (!group.batches.length) return null;
  return sortBatchesForUse(group.batches, now)[0];
}

// 是否需要在首页提醒"先吃旧批"：多批次、且最该先用那批还有库存
export function needsUseFirstReminder(group, now = new Date()) {
  const sorted = sortBatchesForUse(group.batches, now);
  if (sorted.length < 2) return false;
  const first = sorted[0];
  // 修 BUG-B：最早批已过期应「丢弃」而非「建议先用」，与后端契约一致
  const exp = resolveExpiry(first);
  const d = daysUntil(exp, now);
  const usable = exp == null || (d != null && d >= 0);
  // 最该先用的旧批仍可食用才建议先用（别动新批）
  return usable && Number(first.quantity) > 0;
}

// 看板统计（按物品名称聚合）
export function summarize(items, now = new Date()) {
  const groups = groupByName(items);
  const total = groups.length;
  let expired = 0, expiring = 0, low = 0, suggest = 0;
  for (const g of groups) {
    const st = getGroupStatus(g, now);
    if (st === 'expired') expired++;
    else if (st === 'expiring') expiring++;
    if (isGroupLowStock(g)) low++;
    if (needsUseFirstReminder(g, now)) suggest++;
  }
  return { total, expired, expiring, low, suggest };
}
