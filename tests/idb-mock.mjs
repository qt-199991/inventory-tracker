// tests/idb-mock.mjs — 极简 IndexedDB 内存模拟（仅覆盖本应用使用的 API）
// 用于在无浏览器的 Node 环境中测试 db.js 的读写语义。
// 注意：这是模拟实现，浏览器端真实 IndexedDB 仍建议打开 App 实测。

function makeRequest(result, async = true) {
  const req = {
    result: undefined,
    error: null,
    onsuccess: null,
    onerror: null,
  };
  const fire = () => {
    if (req.error) {
      req.onerror && req.onerror();
    } else {
      req.result = result;
      req.onsuccess && req.onsuccess();
    }
  };
  if (async) queueMicrotask(fire);
  else fire();
  return req;
}

export function createMockIndexedDB() {
  // dbName -> { version, stores: { storeName -> Map(key -> record) } }
  const registry = new Map();

  function getOrCreateDB(name, version) {
    let entry = registry.get(name);
    const isNew = !entry;
    if (isNew) {
      entry = { version: 0, stores: {} };
      registry.set(name, entry);
    }
    const needUpgrade = version > entry.version;
    if (needUpgrade) entry.version = version;
    const db = {
      name,
      version: version,
      objectStoreNames: {
        contains: (s) => !!entry.stores[s],
      },
      createObjectStore: (storeName, opts) => {
        const map = new Map();
        entry.stores[storeName] = { map, keyPath: opts && opts.keyPath };
        return makeStore(entry.stores[storeName]);
      },
      transaction: (storeName, mode) => {
        const storeEntry = entry.stores[storeName];
        if (!storeEntry) throw new Error('store not found: ' + storeName);
        const tx = {
          objectStore: () => makeStore(storeEntry),
          oncomplete: null,
          onerror: null,
        };
        // 模拟事务异步完成
        queueMicrotask(() => tx.oncomplete && tx.oncomplete());
        return tx;
      },
    };
    return { db, isNew, needUpgrade };
  }

  function makeStore(storeEntry) {
    const { map, keyPath } = storeEntry;
    return {
      createIndex: (name, keyPath, opts) => ({ name, keyPath, opts }),
      add: (record) => {
        const key = record[keyPath];
        map.set(key, structuredCloneSafe(record));
        return makeRequest(key);
      },
      put: (record) => {
        const key = record[keyPath];
        map.set(key, structuredCloneSafe(record));
        return makeRequest(key);
      },
      get: (key) => makeRequest(map.get(key) ? structuredCloneSafe(map.get(key)) : undefined),
      getAll: () => makeRequest([...map.values()].map(structuredCloneSafe)),
      delete: (key) => {
        map.delete(key);
        return makeRequest(undefined);
      },
      clear: () => {
        map.clear();
        return makeRequest(undefined);
      },
    };
  }

  const open = (name, version) => {
    const { db, needUpgrade } = getOrCreateDB(name, version);
    const req = {
      result: db,
      error: null,
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
    };
    queueMicrotask(() => {
      if (needUpgrade) {
        if (req.onupgradeneeded) req.onupgradeneeded();
      }
      if (req.onsuccess) req.onsuccess();
    });
    return req;
  };

  return { open, _registry: registry };
}

function structuredCloneSafe(obj) {
  try {
    return structuredClone(obj);
  } catch {
    return JSON.parse(JSON.stringify(obj));
  }
}
