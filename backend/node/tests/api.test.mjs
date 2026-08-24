// backend/node/tests/api.test.mjs
// 后端 API 集成测试：以子进程启动 server.mjs，用 fetch 走完整流程。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NODE = process.env.NODE_BIN || process.execPath;
const PORT = 8123;
const BASE = `http://localhost:${PORT}`;
const DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'inv-test-'));
process.env.DB_DIR = DB_DIR;
process.env.PORT = String(PORT);
process.env.OWNER_USER = 'admin';
process.env.OWNER_PASS = 'admin123';

let server;
let token;

function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token && !opts.noAuth) headers['Authorization'] = `Bearer ${token}`;
  return fetch(BASE + path, { ...opts, headers });
}
const j = async (r) => ({ status: r.status, body: await r.json() });

before(async () => {
  server = spawn(NODE, [path.join(__dirname, '..', 'server.mjs')], {
    env: process.env, stdio: 'ignore',
  });
  // 等待端口可用
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(BASE + '/api/batches'); if (r.status) break; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
});
after(() => { if (server) server.kill(); fs.rmSync(DB_DIR, { recursive: true, force: true }); });

// ---------- 认证 ----------
test('未登录访问受保护接口返回 401', async () => {
  const r = await api('/api/batches', { noAuth: true });
  assert.equal(r.status, 401);
});

test('默认账号登录成功并拿到 token', async () => {
  const r = await api('/api/auth/login', { method: 'POST', noAuth: true, body: JSON.stringify({ username: 'admin', password: 'admin123' }) });
  const { status, body } = await j(r);
  assert.equal(status, 200);
  assert.equal(body.code, 0);
  assert.ok(body.data.token);
  token = body.data.token;
});

test('错误密码登录失败', async () => {
  const r = await api('/api/auth/login', { method: 'POST', noAuth: true, body: JSON.stringify({ username: 'admin', password: 'wrong' }) });
  assert.equal(r.status, 401);
});

test('注册新账号并登录', async () => {
  const reg = await api('/api/auth/register', { method: 'POST', noAuth: true, body: JSON.stringify({ username: 'alice', password: 'secret1' }) });
  assert.equal((await j(reg)).status, 200);
  const login = await api('/api/auth/login', { method: 'POST', noAuth: true, body: JSON.stringify({ username: 'alice', password: 'secret1' }) });
  assert.equal((await j(login)).status, 200);
});

test('重复注册同名账号冲突 409', async () => {
  const r = await api('/api/auth/register', { method: 'POST', noAuth: true, body: JSON.stringify({ username: 'admin', password: 'x1234' }) });
  assert.equal(r.status, 409);
});

// ---------- 批次 CRUD ----------
test('新增批次：服务端补全 id/ownerId/时间戳，保留业务字段', async () => {
  const r = await api('/api/batches', { method: 'POST', body: JSON.stringify({ name: '牛奶', category: '食品', quantity: 2, unit: '瓶', lowStockThreshold: 3, productionDate: '2026-08-01', shelfLifeDays: 27 }) });
  const { status, body } = await j(r);
  assert.equal(status, 200);
  assert.ok(body.data.id);
  assert.equal(body.data.ownerId, 'admin'.length ? body.data.ownerId : null); // ownerId 已注入
  assert.equal(body.data.name, '牛奶');
  assert.equal(body.data.quantity, 2);
  assert.equal(body.data.lowStockThreshold, 3);
  assert.ok(body.data.createdAt && body.data.updatedAt);
});

test('列表仅返回活动批次', async () => {
  const r = await api('/api/batches?active=1');
  const { body } = await j(r);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length >= 1);
  assert.ok(body.data.every((b) => !b.deletedAt));
});

test('更新批次数量', async () => {
  const list = await j(await api('/api/batches?active=1'));
  const id = list.body.data[0].id;
  const r = await api(`/api/batches/${id}`, { method: 'PUT', body: JSON.stringify({ quantity: 5 }) });
  const { body } = await j(r);
  assert.equal(body.data.quantity, 5);
});

test('软删除进入回收站，可恢复', async () => {
  const list = await j(await api('/api/batches?active=1'));
  const id = list.body.data[0].id;
  const soft = await j(await api(`/api/batches/${id}/soft-delete`, { method: 'PATCH' }));
  assert.ok(soft.body.data.deletedAt);
  const trashed = await j(await api('/api/batches?trashed=1'));
  assert.ok(trashed.body.data.some((b) => b.id === id));
  const active = await j(await api('/api/batches?active=1'));
  assert.ok(!active.body.data.some((b) => b.id === id));
  const restored = await j(await api(`/api/batches/${id}/restore`, { method: 'PATCH' }));
  assert.equal(restored.body.data.deletedAt, undefined);
});

test('硬删除彻底移除', async () => {
  const created = await j(await api('/api/batches', { method: 'POST', body: JSON.stringify({ name: '临时', quantity: 1 }) }));
  const id = created.body.data.id;
  const del = await api(`/api/batches/${id}`, { method: 'DELETE' });
  assert.equal(del.status, 200);
  const after = await j(await api('/api/batches?active=1'));
  assert.ok(!after.body.data.some((b) => b.id === id));
});

// ---------- 回收站自动清理 ----------
test('超过 30 天的回收站记录被 purge 清除', async () => {
  // 直接写入一条过期 deletedAt 的记录到数据文件
  const file = path.join(DB_DIR, 'inventory.json');
  const db = JSON.parse(fs.readFileSync(file, 'utf8'));
  const old = new Date(Date.now() - 40 * 86400000).toISOString();
  db.batches.push({ id: 'old-trash-1', ownerId: 'x', name: '过期回收', quantity: 1, createdAt: old, updatedAt: old, deletedAt: old });
  fs.writeFileSync(file, JSON.stringify(db));
  const purged = await j(await api('/api/batches/trash/purge', { method: 'POST' }));
  assert.ok(purged.body.data.removed >= 1);
  const trashed = await j(await api('/api/batches?trashed=1'));
  assert.ok(!trashed.body.data.some((b) => b.id === 'old-trash-1'));
});

// ---------- 消耗日志 ----------
test('写入并读取消耗日志', async () => {
  const add = await j(await api('/api/consume-logs', { method: 'POST', body: JSON.stringify({ itemId: 'i1', name: '牛奶', qty: 2 }) }));
  assert.equal(add.body.data.qty, 2);
  const list = await j(await api('/api/consume-logs'));
  assert.ok(list.body.data.some((l) => l.itemId === 'i1' && l.qty === 2));
});

// ---------- 用户列表 ----------
test('用户列表不含密码哈希', async () => {
  const r = await j(await api('/api/users'));
  assert.ok(Array.isArray(r.body.data));
  assert.ok(r.body.data.every((u) => !('passwordHash' in u) && !('salt' in u)));
});

// ---------- 导入 ----------
test('整体导入可还原物品', async () => {
  const payload = { batches: [{ id: 'imp-1', name: '导入物品', quantity: 9, unit: '个', ownerId: 'admin' }] };
  const r = await api('/api/import', { method: 'POST', body: JSON.stringify(payload) });
  assert.equal(r.status, 200);
  const list = await j(await api('/api/batches?active=1'));
  assert.ok(list.body.data.some((b) => b.id === 'imp-1' && b.quantity === 9));
});
