// js/db.js — IndexedDB 封装（纯本地持久化）
// 使用全局 indexedDB（浏览器原生；测试时由 mock 注入）

const DB_NAME = 'inventoryDB';
const DB_VERSION = 3;            // v3：新增 consume_logs 消耗日志（v2 的 users/items 数据自动保留）
const STORE = 'items';
const USERS_STORE = 'users';
const STORE_LOG = 'consume_logs';
const TRASH_DAYS = 30;           // 回收站保留天数

let dbPromise = null;

// ---------- IndexedDB 不可用时的 localStorage 兜底层 ----------
// 某些预览/沙箱环境会禁用 IndexedDB，此时降级到 localStorage，保证页面始终能打开、能演示。
// 仅实现本应用用到的最小子集（add/put/get/getAll/delete + users 的 by_username 索引）。

function idbAvailable() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function makeRequest(result, error = null) {
  let _success = null;
  let _error = null;
  const req = {
    get onsuccess() { return _success; },
    set onsuccess(fn) {
      _success = fn;
      // 模拟 IndexedDB 的异步触发：赋完回调后在下一个微任务调用
      Promise.resolve().then(() => { if (_success) _success(); });
    },
    get onerror() { return _error; },
    set onerror(fn) { _error = fn; },
    result,
    error,
  };
  return req;
}

function createLocalStorageDB() {
  const PREFIX = 'inv_ls_';
  const KEYS = { items: PREFIX + 'items', users: PREFIX + 'users', logs: PREFIX + 'logs' };

  function readAll(store) {
    try {
      return JSON.parse(localStorage.getItem(KEYS[store]) || '[]');
    } catch {
      return [];
    }
  }
  function writeAll(store, arr) {
    try {
      localStorage.setItem(KEYS[store], JSON.stringify(arr));
    } catch {
      /* 存储不可用时静默降级为纯内存（仅本次会话可用） */
    }
  }

  function makeObjectStore(storeName) {
    return {
      add(item) {
        const all = readAll(storeName);
        all.push(item);
        writeAll(storeName, all);
        return makeRequest(item);
      },
      put(item) {
        const all = readAll(storeName);
        const idx = all.findIndex((r) => r.id === item.id);
        if (idx >= 0) all[idx] = item; else all.push(item);
        writeAll(storeName, all);
        return makeRequest(item);
      },
      delete(id) {
        const all = readAll(storeName);
        writeAll(storeName, all.filter((r) => r.id !== id));
        return makeRequest(undefined);
      },
      get(id) {
        const all = readAll(storeName);
        return makeRequest(all.find((r) => r.id === id));
      },
      getAll() {
        const all = readAll(storeName);
        return makeRequest(all.map((r) => ({ ...r })));
      },
      index() {
        // 仅 users 表用到 by_username
        return {
          get(key) {
            const all = readAll(storeName);
            return makeRequest(all.find((r) => r.username === key));
          },
        };
      },
    };
  }

  return {
    transaction: (storeName) => ({ objectStore: () => makeObjectStore(storeName) }),
  };
}

export function initDB() {
  if (dbPromise) return dbPromise;
  // 环境不支持 IndexedDB（如部分预览 iframe）：降级到 localStorage
  if (!idbAvailable()) {
    dbPromise = Promise.resolve(createLocalStorageDB());
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
      // 用户表：用户名唯一，支持按用户名快速查登录
      if (!db.objectStoreNames.contains(USERS_STORE)) {
        const us = db.createObjectStore(USERS_STORE, { keyPath: 'id' });
        us.createIndex('by_username', 'username', { unique: true });
      }
      // 消耗日志：记录每次「用掉/减少」事件，用于消耗趋势统计
      if (!db.objectStoreNames.contains(STORE_LOG)) {
        db.createObjectStore(STORE_LOG, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      // 打开失败（隐私模式/配额/沙箱限制）：降级到 localStorage，避免白屏
      dbPromise = Promise.resolve(createLocalStorageDB());
      resolve(createLocalStorageDB());
    };
  });
  return dbPromise;
}

function store(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function userStore(db, mode) {
  return db.transaction(USERS_STORE, mode).objectStore(USERS_STORE);
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------- 物品 ----------

export async function addItem(item) {
  const db = await initDB();
  return reqToPromise(store(db, 'readwrite').add(item));
}

export async function updateItem(item) {
  const db = await initDB();
  return reqToPromise(store(db, 'readwrite').put(item));
}

export async function deleteItem(id) {
  const db = await initDB();
  return reqToPromise(store(db, 'readwrite').delete(id));
}

export async function getAllItems() {
  const db = await initDB();
  return reqToPromise(store(db, 'readonly').getAll());
}

export async function clearItems() {
  const db = await initDB();
  return reqToPromise(store(db, 'readwrite').clear());
}

// ---------- 回收站（软删除） ----------
// 普通删除只打 deletedAt 标记，不真正删；回收站可恢复，超过 TRASH_DAYS 自动清理。

export async function getActiveItems(ownerId) {
  const all = await getAllItems();
  return all.filter((it) => !it.deletedAt && (!ownerId || it.ownerId === ownerId));
}

export async function getTrashedItems(ownerId) {
  const all = await getAllItems();
  return all
    .filter((it) => it.deletedAt && (!ownerId || it.ownerId === ownerId))
    .sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
}

export async function softDeleteItem(id) {
  const db = await initDB();
  const item = await reqToPromise(store(db, 'readonly').get(id));
  if (!item) return;
  item.deletedAt = new Date().toISOString();
  return reqToPromise(store(db, 'readwrite').put(item));
}

export async function restoreItem(id) {
  const db = await initDB();
  const item = await reqToPromise(store(db, 'readonly').get(id));
  if (!item) return;
  delete item.deletedAt;
  return reqToPromise(store(db, 'readwrite').put(item));
}

export async function purgeExpiredTrash() {
  const all = await getAllItems();
  const cutoff = Date.now() - TRASH_DAYS * 86400000;
  const expired = all.filter((it) => it.deletedAt && new Date(it.deletedAt).getTime() < cutoff);
  if (!expired.length) return;
  const db = await initDB();
  await Promise.all(expired.map((it) => reqToPromise(store(db, 'readwrite').delete(it.id))));
}

// ---------- 消耗日志 ----------

export async function addConsumeLog(entry) {
  const db = await initDB();
  try {
    return await reqToPromise(db.transaction(STORE_LOG, 'readwrite').objectStore(STORE_LOG).add(entry));
  } catch {
    // 日志写入失败不应影响主流程
  }
}

export async function getConsumeLogs() {
  const db = await initDB();
  try {
    return await reqToPromise(db.transaction(STORE_LOG, 'readonly').objectStore(STORE_LOG).getAll());
  } catch {
    return [];
  }
}

// ---------- 用户（多账号登录） ----------

export async function addUser(user) {
  const db = await initDB();
  return reqToPromise(userStore(db, 'readwrite').add(user));
}

export async function findUserByUsername(username) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(USERS_STORE, 'readonly');
    const req = tx.objectStore(USERS_STORE).index('by_username').get(username);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllUsers() {
  const db = await initDB();
  return reqToPromise(userStore(db, 'readonly').getAll());
}
