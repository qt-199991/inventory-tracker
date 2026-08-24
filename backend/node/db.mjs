// backend/node/db.mjs
// 嵌入式持久层：以 JSON 文件作为"数据库"（个人量级完全够用，零依赖、零安装）。
// 若日后要换成真正的 SQLite/MySQL，只需替换本文件暴露的这几个函数，API 与前端无需改动。
//
// 数据结构（一个文件 inventory.json）：
// {
//   users:       [{ id, username, salt, passwordHash, createdAt }],
//   batches:     [ 物品批次（前端的一条"物品"记录），含 ownerId / deletedAt ],
//   consumeLogs: [{ id, ownerId, itemId, name, qty, at }]
// }

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DB_DIR 可覆盖（测试隔离用）；默认 backend/node/data
const DATA_DIR = process.env.DB_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'inventory.json');
const SECRET_FILE = path.join(DATA_DIR, '.jwtsecret');

const TRASH_DAYS = 30;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function defaultData() {
  return { users: [], batches: [], consumeLogs: [] };
}

// 进程内缓存 + 同步落盘（Node 单线程，写串行即可保证一致）
let cache = null;

export function loadDB() {
  ensureDir();
  if (cache) return cache;
  try {
    if (fs.existsSync(DB_FILE)) {
      cache = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } else {
      cache = defaultData();
      saveDB();
    }
  } catch (e) {
    console.error('[db] 读取数据库失败，使用空库：', e.message);
    cache = defaultData();
  }
  seedOwner();
  return cache;
}

export function saveDB() {
  ensureDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2));
}

// 从磁盘重新载入（用于 purge 等需要"看到最新文件"的场景）
export function reloadDB() {
  if (fs.existsSync(DB_FILE)) {
    try { cache = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { /* 损坏则保留内存副本 */ }
  }
  return cache;
}

export function genId() {
  return crypto.randomUUID();
}

// ---------- 默认账号（单账号多设备共享） ----------
// 通过环境变量 OWNER_USER / OWNER_PASS 自定义；未设置时默认为 admin / admin123。
export function seedOwner() {
  const user = process.env.OWNER_USER || 'admin';
  const pass = process.env.OWNER_PASS || 'admin123';
  const exists = cache.users.find((u) => u.username === user);
  if (!exists) {
    const { salt, passwordHash } = hashPassword(pass);
    cache.users.push({
      id: genId(),
      username: user,
      salt,
      passwordHash,
      createdAt: new Date().toISOString(),
      isOwner: true,
    });
    saveDB();
  }
}

// ---------- 密码哈希（服务端 SHA-256 + 随机 salt） ----------
export function hashPassword(password, salt = crypto.randomUUID().slice(0, 16)) {
  const h = crypto.createHash('sha256').update(password + salt).digest('hex');
  return { salt, passwordHash: h };
}

export function verifyPassword(password, salt, passwordHash) {
  const { passwordHash: h } = hashPassword(password, salt);
  return h === passwordHash;
}

// ---------- JWT（HS256，无第三方依赖） ----------
export function getJwtSecret() {
  ensureDir();
  if (fs.existsSync(SECRET_FILE)) return fs.readFileSync(SECRET_FILE, 'utf8').trim();
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
  return secret;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

export function signToken(payload, expiresInSeconds = 86400 * 7) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSeconds };
  const secret = getJwtSecret();
  const data = `${b64urlJson(header)}.${b64urlJson(body)}`;
  const sig = b64url(crypto.createHmac('sha256', secret).update(data).digest());
  return `${data}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const secret = getJwtSecret();
  const data = `${parts[0]}.${parts[1]}`;
  const sig = b64url(crypto.createHmac('sha256', secret).update(data).digest());
  if (sig !== parts[2]) return null;
  let body;
  try {
    body = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
  } catch {
    return null;
  }
  if (!body.exp || body.exp < Math.floor(Date.now() / 1000)) return null;
  return body;
}

// ---------- 用户 ----------
export function findUserByUsername(username) {
  return cache.users.find((u) => u.username === username) || null;
}
export function findUserById(id) {
  return cache.users.find((u) => u.id === id) || null;
}
export function createUser(username, password) {
  const { salt, passwordHash } = hashPassword(password);
  const user = { id: genId(), username, salt, passwordHash, createdAt: new Date().toISOString() };
  cache.users.push(user);
  saveDB();
  return user;
}
export function listUsers() {
  return cache.users.map(({ passwordHash, salt, ...u }) => u);
}

// ---------- 批次（前端的一条"物品"记录） ----------
function normalizeBatch(b) {
  // 仅保留已知字段，避免脏数据；server 管理 id/时间戳
  const out = { ...b };
  delete out.passwordHash;
  return out;
}

export function createBatch(data) {
  const now = new Date().toISOString();
  const batch = normalizeBatch({
    id: data.id || genId(),
    ownerId: data.ownerId || null,
    name: data.name || '未命名',
    category: data.category || '未分类',
    location: data.location ?? '',
    quantity: Number(data.quantity) || 0,
    unit: data.unit || '个',
    productionDate: data.productionDate ?? null,
    expiryDate: data.expiryDate ?? null,
    shelfLifeDays: data.shelfLifeDays ?? null,
    lowStockThreshold: data.lowStockThreshold ?? null,
    expiringSoonDays: data.expiringSoonDays ?? null,
    batchLabel: data.batchLabel ?? null,
    note: data.note ?? '',
    photo: data.photo ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
  cache.batches.push(batch);
  saveDB();
  return batch;
}

export function updateBatch(id, data, ownerId = null) {
  const idx = cache.batches.findIndex((b) => b.id === id);
  if (idx < 0) return null;
  if (ownerId && cache.batches[idx].ownerId !== ownerId) return null; // 非本人不可改
  const prev = cache.batches[idx];
  const updated = {
    ...prev,
    name: data.name ?? prev.name,
    category: data.category ?? prev.category,
    location: data.location ?? prev.location,
    quantity: data.quantity != null ? Number(data.quantity) : prev.quantity,
    unit: data.unit ?? prev.unit,
    productionDate: data.productionDate ?? prev.productionDate,
    expiryDate: data.expiryDate ?? prev.expiryDate,
    shelfLifeDays: data.shelfLifeDays ?? prev.shelfLifeDays,
    lowStockThreshold: data.lowStockThreshold ?? prev.lowStockThreshold,
    expiringSoonDays: data.expiringSoonDays ?? prev.expiringSoonDays,
    batchLabel: data.batchLabel ?? prev.batchLabel,
    note: data.note ?? prev.note,
    photo: data.photo !== undefined ? data.photo : prev.photo,
    ownerId: data.ownerId !== undefined ? data.ownerId : prev.ownerId,
    updatedAt: new Date().toISOString(),
  };
  cache.batches[idx] = updated;
  saveDB();
  return updated;
}

export function getBatch(id, ownerId = null) {
  const b = cache.batches.find((x) => x.id === id) || null;
  if (!b) return null;
  if (ownerId && b.ownerId !== ownerId) return null; // 按账户隔离
  return b;
}

export function deleteBatchHard(id, ownerId = null) {
  const b = cache.batches.find((x) => x.id === id);
  if (!b) return false;
  if (ownerId && b.ownerId !== ownerId) return false; // 非本人不可删
  const before = cache.batches.length;
  cache.batches = cache.batches.filter((x) => x.id !== id);
  const changed = cache.batches.length !== before;
  if (changed) saveDB();
  return changed;
}

export function softDeleteBatch(id, ownerId = null) {
  const b = getBatch(id, ownerId);
  if (!b) return null;
  b.deletedAt = new Date().toISOString();
  b.updatedAt = b.deletedAt;
  saveDB();
  return b;
}

export function restoreBatch(id, ownerId = null) {
  const b = getBatch(id, ownerId);
  if (!b) return null;
  delete b.deletedAt;
  b.updatedAt = new Date().toISOString();
  saveDB();
  return b;
}

// filter: {} | {active:true} | {trashed:true}；ownerId 提供时只返回该账户数据
export function listBatches(filter = {}, ownerId = null) {
  let arr = cache.batches;
  if (ownerId) arr = arr.filter((b) => b.ownerId === ownerId);
  if (filter.active) arr = arr.filter((b) => !b.deletedAt);
  else if (filter.trashed) arr = arr.filter((b) => b.deletedAt);
  return arr
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function purgeTrash() {
  // 先与磁盘同步，确保手动编辑/其他进程写入的回收站记录也能被清理
  reloadDB();
  const cutoff = Date.now() - TRASH_DAYS * 86400000;
  const before = cache.batches.length;
  cache.batches = cache.batches.filter((b) => !(b.deletedAt && new Date(b.deletedAt).getTime() < cutoff));
  const removed = before - cache.batches.length;
  if (removed) saveDB();
  return removed;
}

// ---------- 消耗日志 ----------
export function createConsumeLog(data) {
  const log = {
    id: data.id || genId(),
    ownerId: data.ownerId ?? null,
    itemId: data.itemId ?? null,
    name: data.name || '物品',
    qty: Number(data.qty) || 0,
    at: data.at || new Date().toISOString(),
  };
  cache.consumeLogs.push(log);
  saveDB();
  return log;
}
export function listConsumeLogs(ownerId = null) {
  let arr = cache.consumeLogs;
  if (ownerId) arr = arr.filter((l) => l.ownerId === ownerId);
  return arr.slice().sort((a, b) => new Date(b.at) - new Date(a.at));
}

// ---------- 整体导入（备份还原） ----------
export function importAll({ batches = [], users = [] } = {}, ownerId = null) {
  if (Array.isArray(batches)) {
    for (const b of batches) {
      const existing = b.id ? cache.batches.find((x) => x.id === b.id) : null;
      const owned = { ...b, ownerId: ownerId || b.ownerId || null, deletedAt: b.deletedAt ?? null };
      if (existing) {
        if (ownerId && existing.ownerId !== ownerId) continue; // 不覆盖他人数据
        updateBatch(b.id, owned);
      } else {
        createBatch(owned);
      }
    }
  }
  // 用户导入：仅当账号名不存在时创建（密码以明文对待，按服务端哈希重算）
  if (Array.isArray(users)) {
    for (const u of users) {
      if (!u.username) continue;
      if (findUserByUsername(u.username)) continue;
      createUser(u.username, u.password || 'changeme123');
    }
  }
  saveDB();
}
