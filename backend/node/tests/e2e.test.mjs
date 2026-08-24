// backend/node/tests/e2e.test.mjs
// 端到端冒烟测试：用临时数据目录拉起真实 server，跑通"多设备共享"整条链路。
// 运行： node --test tests/e2e.test.mjs   （或 node --test tests/*.test.mjs）

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 8099;
const BASE = `http://localhost:${PORT}`;

// 临时数据目录，隔离污染
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'inv-e2e-'));

function startServer() {
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DB_DIR: TMP, OWNER_USER: 'admin', OWNER_PASS: 'admin123' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return child;
}

async function waitReady(child) {
  const started = new Promise((resolve, reject) => {
    let buf = '';
    const onData = (d) => {
      buf += d.toString();
      if (buf.includes('已启动')) resolve();
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    setTimeout(() => reject(new Error('server 启动超时')), 8000);
  });
  await started;
  // 再 ping 一次接口确保端口可连
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch(`${BASE}/api/batches`, { method: 'GET' });
      if (r.status === 401) return; // 401 说明接口已通（缺 token）
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 150));
  }
}

function authHeader(token) { return { Authorization: `Bearer ${token}` }; }

let server;
let token;

test('e2e: 多设备共享全链路', { timeout: 30000 }, async (t) => {
  server = startServer();
  await waitReady(server);

  await t.test('静态托管：首页可访问', async () => {
    const r = await fetch(`${BASE}/`);
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.match(html, /库存/);
  });

  await t.test('未授权访问 API 返回 401', async () => {
    const r = await fetch(`${BASE}/api/batches`);
    assert.equal(r.status, 401);
    const j = await r.json();
    assert.equal(j.code, 401001);
  });

  await t.test('默认账号登录成功', async () => {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.code, 0);
    assert.ok(j.data.token, '应返回 token');
    token = j.data.token;
  });

  await t.test('鉴权后可创建物品（牛奶，数量2，阈值3）', async () => {
    const r = await fetch(`${BASE}/api/batches`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({ name: '牛奶', category: '食品', quantity: 2, unit: '盒', lowStockThreshold: 3 }),
    });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.code, 0);
    assert.equal(j.data.quantity, 2);
    assert.equal(j.data.lowStockThreshold, 3);
  });

  await t.test('物品列表含 1 条（活跃）', async () => {
    const r = await fetch(`${BASE}/api/batches?active=1`, { headers: authHeader(token) });
    const j = await r.json();
    assert.equal(j.data.length, 1);
    assert.equal(j.data[0].name, '牛奶');
  });

  await t.test('消耗日志：记录 -1', async () => {
    const r = await fetch(`${BASE}/api/consume-logs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({ itemId: null, name: '牛奶', qty: 1 }),
    });
    assert.equal(r.status, 200);
    const list = await (await fetch(`${BASE}/api/consume-logs`, { headers: authHeader(token) })).json();
    assert.equal(list.data.length, 1);
  });

  await t.test('软删除 → 进入回收站 → 恢复', async () => {
    const list = await (await fetch(`${BASE}/api/batches?active=1`, { headers: authHeader(token) })).json();
    const id = list.data[0].id;
    let r = await fetch(`${BASE}/api/batches/${id}/soft-delete`, { method: 'PATCH', headers: authHeader(token) });
    assert.equal(r.status, 200);
    let trashed = await (await fetch(`${BASE}/api/batches?trashed=1`, { headers: authHeader(token) })).json();
    assert.equal(trashed.data.length, 1);
    r = await fetch(`${BASE}/api/batches/${id}/restore`, { method: 'PATCH', headers: authHeader(token) });
    assert.equal(r.status, 200);
    const active = await (await fetch(`${BASE}/api/batches?active=1`, { headers: authHeader(token) })).json();
    assert.equal(active.data.length, 1);
  });

  await t.test('用户列表不含密码哈希', async () => {
    const r = await fetch(`${BASE}/api/users`, { headers: authHeader(token) });
    const j = await r.json();
    assert.equal(j.data.length, 1);
    assert.equal(j.data[0].username, 'admin');
    assert.ok(!('passwordHash' in j.data[0]));
  });

  await t.test('整体导入可还原物品', async () => {
    const payload = { batches: [{ id: 'imp-1', name: '鸡蛋', quantity: 10, lowStockThreshold: 6 }], users: [] };
    const r = await fetch(`${BASE}/api/import`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader(token) }, body: JSON.stringify(payload),
    });
    assert.equal(r.status, 200);
    const list = await (await fetch(`${BASE}/api/batches?active=1`, { headers: authHeader(token) })).json();
    assert.ok(list.data.some((b) => b.name === '鸡蛋'));
  });

  await t.test('清空回收站（30天内无数据，移除0）', async () => {
    const r = await fetch(`${BASE}/api/batches/trash/purge`, { method: 'POST', headers: authHeader(token) });
    const j = await r.json();
    assert.equal(j.code, 0);
    assert.equal(j.data.removed, 0);
  });
});

// 收尾：杀进程 + 删临时目录
test('cleanup', async () => {
  if (server) server.kill('SIGKILL');
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ }
});
