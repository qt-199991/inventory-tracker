// backend/node/server.mjs
// 零依赖 Node 服务：REST API（/api）+ 托管前端静态文件（shared/）。
// 运行：node server.mjs  （可选环境变量 PORT / OWNER_USER / OWNER_PASS）

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadDB, hashPassword, verifyPassword, signToken, verifyToken,
  findUserByUsername, createUser, listUsers,
  createBatch, updateBatch, getBatch, deleteBatchHard,
  softDeleteBatch, restoreBatch, listBatches, purgeTrash,
  createConsumeLog, listConsumeLogs, importAll,
} from './db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'shared');
const PORT = Number(process.env.PORT) || 8080;

loadDB();

// ---------- 工具 ----------
function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 25 * 1024 * 1024) reject(new Error('请求体过大')); // 25MB（照片 base64 较大）
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('JSON 解析失败')); }
    });
    req.on('error', reject);
  });
}
function getToken(req) {
  const h = req.headers['authorization'] || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return null;
}
function authUser(req, res) {
  const token = getToken(req);
  const payload = verifyToken(token);
  if (!payload) { send(res, 401, { code: 401001, message: '未登录或登录已过期', data: null }); return null; }
  return payload;
}
function publicUser(u) {
  if (!u) return null;
  const { passwordHash, salt, ...rest } = u;
  return rest;
}

// ---------- API 路由 ----------
const api = http.createServer(async (req, res) => {
  // CORS 预检
  if (req.method === 'OPTIONS') { send(res, 204, {}); return; }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;
  const isApi = p.startsWith('/api/');

  if (!isApi) return serveStatic(req, res, p);

  try {
    // 公开接口：登录 / 注册
    if (p === '/api/auth/login' && req.method === 'POST') {
      const body = await readBody(req);
      const username = (body.username || '').trim();
      const password = body.password || '';
      const user = findUserByUsername(username);
      if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
        return send(res, 401, { code: 401001, message: '用户名或密码错误', data: null });
      }
      const token = signToken({ sub: user.id, username: user.username });
      return send(res, 200, {
        code: 0, message: 'success',
        data: { token, tokenType: 'Bearer', expiresIn: 86400 * 7, username: user.username, userId: user.id },
      });
    }
    if (p === '/api/auth/register' && req.method === 'POST') {
      const body = await readBody(req);
      const username = (body.username || '').trim();
      const password = body.password || '';
      if (!username || !password) return send(res, 400, { code: 400001, message: '用户名和密码都要填', data: null });
      if (password.length < 4) return send(res, 400, { code: 400001, message: '密码至少 4 位', data: null });
      if (findUserByUsername(username)) return send(res, 409, { code: 409001, message: '该用户名已被占用', data: null });
      const user = createUser(username, password);
      const token = signToken({ sub: user.id, username: user.username });
      return send(res, 200, {
        code: 0, message: 'success',
        data: { token, tokenType: 'Bearer', expiresIn: 86400 * 7, username: user.username, userId: user.id },
      });
    }

    // 以下接口需要登录
    const me = authUser(req, res);
    if (!me) return;

    // 批次
    if (p === '/api/batches' && req.method === 'GET') {
      let filter = {};
      if (url.searchParams.get('active') === '1') filter = { active: true };
      else if (url.searchParams.get('trashed') === '1') filter = { trashed: true };
      return send(res, 200, { code: 0, message: 'success', data: listBatches(filter, me.sub) });
    }
    if (p === '/api/batches' && req.method === 'POST') {
      const body = await readBody(req);
      const batch = createBatch({ ...body, ownerId: me.sub });
      return send(res, 200, { code: 0, message: 'success', data: batch });
    }
    if (p === '/api/batches/trash/purge' && req.method === 'POST') {
      const removed = purgeTrash();
      return send(res, 200, { code: 0, message: 'success', data: { removed } });
    }

    // /api/batches/:id[/sub]
    const m = p.match(/^\/api\/batches\/([^/]+)(\/soft-delete|\/restore)?$/);
    if (m && req.method === 'GET') {
      const b = getBatch(m[1], me.sub);
      if (!b) return send(res, 404, { code: 404001, message: '物品不存在', data: null });
      return send(res, 200, { code: 0, message: 'success', data: b });
    }
    if (m && req.method === 'PUT') {
      const body = await readBody(req);
      const updated = updateBatch(m[1], { ...body, ownerId: me.sub }, me.sub);
      if (!updated) return send(res, 404, { code: 404001, message: '物品不存在', data: null });
      return send(res, 200, { code: 0, message: 'success', data: updated });
    }
    if (m && req.method === 'DELETE') {
      const ok = deleteBatchHard(m[1], me.sub);
      if (!ok) return send(res, 404, { code: 404001, message: '物品不存在', data: null });
      return send(res, 200, { code: 0, message: 'success', data: null });
    }
    if (m && m[2] === '/soft-delete' && req.method === 'PATCH') {
      const b = softDeleteBatch(m[1], me.sub);
      if (!b) return send(res, 404, { code: 404001, message: '物品不存在', data: null });
      return send(res, 200, { code: 0, message: 'success', data: b });
    }
    if (m && m[2] === '/restore' && req.method === 'PATCH') {
      const b = restoreBatch(m[1], me.sub);
      if (!b) return send(res, 404, { code: 404001, message: '物品不存在', data: null });
      return send(res, 200, { code: 0, message: 'success', data: b });
    }

    // 消耗日志
    if (p === '/api/consume-logs' && req.method === 'GET') {
      return send(res, 200, { code: 0, message: 'success', data: listConsumeLogs(me.sub) });
    }
    if (p === '/api/consume-logs' && req.method === 'POST') {
      const body = await readBody(req);
      const log = createConsumeLog({ ...body, ownerId: me.sub });
      return send(res, 200, { code: 0, message: 'success', data: log });
    }

    // 用户
    if (p === '/api/users' && req.method === 'GET') {
      return send(res, 200, { code: 0, message: 'success', data: listUsers() });
    }

    // 整体导入（备份还原）
    if (p === '/api/import' && req.method === 'POST') {
      const body = await readBody(req);
      importAll(body, me.sub);
      return send(res, 200, { code: 0, message: 'success', data: null });
    }

    return send(res, 404, { code: 404001, message: '接口不存在', data: null });
  } catch (e) {
    console.error('[api] 处理出错：', e);
    return send(res, 500, { code: 500000, message: e.message || '服务器错误', data: null });
  }
});

// ---------- 静态文件托管 ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};
function serveStatic(req, res, p) {
  let rel = decodeURIComponent(p);
  if (rel === '/' || rel === '') rel = '/index.html';
  // 防目录穿越
  const safe = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safe);
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA 兜底：未知路径回 index.html
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, html) => {
        if (e2) { res.writeHead(404); res.end('Not Found'); return; }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(html);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

api.listen(PORT, () => {
  console.log(`✅ 库存后端已启动： http://localhost:${PORT}`);
  console.log(`   前端页面：         http://localhost:${PORT}/`);
  console.log(`   默认账号：         ${process.env.OWNER_USER || 'admin'} / ${process.env.OWNER_PASS || 'admin123'}`);
  console.log(`   数据文件：         ${path.join(__dirname, 'data', 'inventory.json')}`);
});
