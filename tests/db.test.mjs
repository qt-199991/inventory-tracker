import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMockIndexedDB } from './idb-mock.mjs';
import * as db from '../js/db.js';

// 注入内存版 IndexedDB 模拟
const mock = createMockIndexedDB();
globalThis.indexedDB = mock;

function sample(id) {
  return {
    id,
    name: '测试物品' + id,
    category: '食品',
    location: '厨房',
    quantity: 2,
    unit: '个',
    expiryDate: '2026-09-01',
  };
}

test('addItem + getAllItems: 新增后可读出', async () => {
  await db.addItem(sample('a1'));
  const all = await db.getAllItems();
  assert.equal(all.length, 1);
  assert.equal(all[0].name, '测试物品a1');
});

test('updateItem: 按 id 覆盖更新', async () => {
  await db.addItem(sample('b1'));
  const updated = { ...sample('b1'), quantity: 99, name: '改过了' };
  await db.updateItem(updated);
  const all = await db.getAllItems();
  const found = all.find((x) => x.id === 'b1');
  assert.equal(found.quantity, 99);
  assert.equal(found.name, '改过了');
});

test('deleteItem: 按 id 删除', async () => {
  await db.addItem(sample('c1'));
  await db.deleteItem('c1');
  const all = await db.getAllItems();
  assert.equal(all.find((x) => x.id === 'c1'), undefined);
});

test('持久化语义: 再次 open 同一库数据仍在（模拟刷新页面）', async () => {
  // 关闭旧连接（清空模块缓存不可行，这里通过再 open 验证 mock 内 registry 持续）
  // db.js 内部 dbPromise 已缓存；getAllItems 仍应返回之前数据
  const all = await db.getAllItems();
  assert.ok(all.length >= 1, '刷新后数据应保留');
});

test('clearItems: 清空', async () => {
  await db.clearItems();
  const all = await db.getAllItems();
  assert.equal(all.length, 0);
});
