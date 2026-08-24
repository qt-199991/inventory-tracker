// backend/node/tests/isolation.test.mjs
// 按账户隔离测试（多账户各自独立）：Red 阶段 —— 当前后端未做 ownerId 过滤，这些断言应失败。
// 运行： node --test tests/isolation.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 8097;
const BASE = `http://localhost:${PORT}`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'inv-iso-'));

function startServer() {
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DB_DIR: TMP },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return child;
}
async function waitReady(child) {
  const started = new Promise((resolve, reject) => {
    let buf = '';
    const onData = (d) => { buf += d.toString(); if (buf.includes('已启动')) resolve(); };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    setTimeout(() => reject(new Error('server 启动超时')), 8000);
  });
  await started;
  for (let i = 0; i < 20; i++) {
    try { const r = await fetch(`${BASE}/api/batches`, { method: 'GET' }); if (r.status === 401) return; }
    catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
}
const H = (t) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });
async function regToken(username, password) {
  const r = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const j = await r.json();
  return j.data.token;
}
async function create(token, name) {
  const r = await fetch(`${BASE}/api/batches`, { method: 'POST', headers: H(token), body: JSON.stringify({ name, quantity: 1 }) });
  return (await r.json()).data;
}
async function activeList(token) {
  const r = await fetch(`${BASE}/api/batches?active=1`, { headers: H(token) });
  return (await r.json()).data;
}

let server, tA, tB;

test('isolation: 多账户各自独立 + 跨设备同步', { timeout: 30000 }, async (t) => {
  server = startServer();
  await waitReady(server);

  await t.test('注册两个独立账户 A / B', async () => {
    tA = await regToken('alice', 'aaaaaa');
    tB = await regToken('bob', 'bbbbbb');
    assert.ok(tA && tB);
  });

  await t.test('A 建物品后，B 的列表为空（互相不可见）', async () => {
    await create(tA, '牛奶');
    const a = await activeList(tA);
    const b = await activeList(tB);
    assert.equal(a.length, 1);
    assert.equal(a[0].name, '牛奶');
    assert.equal(b.length, 0, 'B 不应看到 A 的物品');
  });

  await t.test('B 建物品后，A 的列表仍为 1（各自独立）', async () => {
    await create(tB, '鸡蛋');
    const a = await activeList(tA);
    const b = await activeList(tB);
    assert.equal(a.length, 1, 'A 仍只有自己的 1 条');
    assert.equal(b.length, 1);
    assert.equal(b[0].name, '鸡蛋');
  });

  await t.test('跨设备同步：同一账号 token 在“另一设备”看到自己的数据', async () => {
    // 复用 tA 模拟另一台设备登录同一账号
    const otherDevice = await activeList(tA);
    assert.equal(otherDevice.length, 1);
    assert.equal(otherDevice[0].name, '牛奶');
  });

  await t.test('B 不能读取/操作 A 的物品（404）', async () => {
    const aList = await activeList(tA);
    const aId = aList[0].id;
    let r = await fetch(`${BASE}/api/batches/${aId}`, { headers: H(tB) });
    assert.equal(r.status, 404, 'B 用 GET 拿 A 的物品应 404');
    r = await fetch(`${BASE}/api/batches/${aId}/soft-delete`, { method: 'PATCH', headers: H(tB) });
    assert.equal(r.status, 404, 'B 软删 A 的物品应 404');
  });

  await t.test('消耗日志按账户隔离', async () => {
    await fetch(`${BASE}/api/consume-logs`, { method: 'POST', headers: H(tA), body: JSON.stringify({ name: '牛奶', qty: 1 }) });
    const bLogs = await (await fetch(`${BASE}/api/consume-logs`, { headers: H(tB) })).json();
    assert.equal(bLogs.data.length, 0, 'B 不应看到 A 的消耗日志');
  });

  await t.test('导入的物品归属到导入者本人', async () => {
    const before = (await activeList(tB)).length;
    await fetch(`${BASE}/api/import`, {
      method: 'POST', headers: H(tB),
      body: JSON.stringify({ batches: [{ id: 'imp-x', name: '进口牛肉', quantity: 3 }], users: [] }),
    });
    const b = await activeList(tB);
    const a = await activeList(tA);
    assert.equal(b.length, before + 1, 'B 导入后多 1 条');
    assert.equal(a.length, 1, 'A 不受 B 导入影响');
    assert.ok(b.some((x) => x.name === '进口牛肉'));
  });
});

test('cleanup', async () => {
  if (server) server.kill('SIGKILL');
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
});
