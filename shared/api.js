// shared/api.js — 后端数据层（替代 db.js，函数签名保持一致，app.js 改动最小）
// 所有数据唯一真源在后端数据库，所有登录同一账号的设备看到同一份库存。

// 若前端与后端不同源（如前端放 GitHub Pages、后端另起），在此设后端地址，例如：
//   window.API_BASE = 'https://your-backend.example.com';
const API_BASE = (typeof window !== 'undefined' && window.API_BASE) || '';
const TOKEN_KEY = 'inv_token';

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
export function setToken(t) {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch {}
}
export function getTokenValue() { return getToken(); }

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (auth && token) headers['Authorization'] = 'Bearer ' + token;
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error('无法连接服务器，请确认后端已启动并能访问');
  }
  // 未登录 / token 过期
  if (res.status === 401) {
    setToken('');
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth:expired'));
    throw new Error('登录已过期，请重新登录');
  }
  const data = await res.json().catch(() => ({}));
  if (data && data.code && data.code !== 0) throw new Error(data.message || '请求失败');
  return data.data;
}

// ---------- 鉴权 ----------
export async function login(username, password) {
  const d = await request('/api/auth/login', { method: 'POST', auth: false, body: { username, password } });
  setToken(d.token);
  return { id: d.userId, username: d.username };
}
export async function register(username, password) {
  const d = await request('/api/auth/register', { method: 'POST', auth: false, body: { username, password } });
  setToken(d.token);
  return { id: d.userId, username: d.username };
}
export function logout() { setToken(''); }

// ---------- 初始化（后端无需本地初始化） ----------
export function initDB() { return Promise.resolve(); }

// ---------- 批次（前端的一条"物品"记录） ----------
export async function addItem(item) {
  return request('/api/batches', { method: 'POST', body: item });
}
export async function updateItem(item) {
  return request(`/api/batches/${encodeURIComponent(item.id)}`, { method: 'PUT', body: item });
}
export async function deleteItem(id) {
  return request(`/api/batches/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
export async function getAllItems() {
  return request('/api/batches');
}
export async function getActiveItems() {
  return request('/api/batches?active=1');
}
export async function getTrashedItems() {
  return request('/api/batches?trashed=1');
}
export async function softDeleteItem(id) {
  return request(`/api/batches/${encodeURIComponent(id)}/soft-delete`, { method: 'PATCH' });
}
export async function restoreItem(id) {
  return request(`/api/batches/${encodeURIComponent(id)}/restore`, { method: 'PATCH' });
}
export async function purgeExpiredTrash() {
  return request('/api/batches/trash/purge', { method: 'POST' });
}
export async function addConsumeLog(entry) {
  return request('/api/consume-logs', { method: 'POST', body: entry });
}
export async function getConsumeLogs() {
  return request('/api/consume-logs');
}

// ---------- 用户 ----------
// 仅用于备份导入时的兼容；正常流程不使用本地建号
export async function addUser(user) {
  try {
    return await request('/api/auth/register', { method: 'POST', auth: false, body: { username: user.username, password: user.password || 'changeme123' } });
  } catch { return null; }
}
export async function findUserByUsername(username) {
  const users = await getAllUsers();
  return users.find((u) => u.username === username) || null;
}
export async function getAllUsers() {
  return request('/api/users');
}

// ---------- 整体导入（备份还原） ----------
export async function importBackup(payload) {
  return request('/api/import', { method: 'POST', body: payload });
}
