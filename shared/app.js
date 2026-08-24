// shared/app.js — 应用层：渲染、交互、表单（共享后端版）
import {
  initDB,
  addItem,
  updateItem,
  deleteItem,
  getAllItems,
  getActiveItems,
  getTrashedItems,
  softDeleteItem,
  restoreItem,
  purgeExpiredTrash,
  addConsumeLog,
  getConsumeLogs,
  addUser,
  findUserByUsername,
  getAllUsers,
  login,
  register,
  logout as clearToken,
} from './api.js';
import {
  getItemStatus,
  resolveExpiry,
  daysUntil,
  toLocalISO,
  groupByName,
  summarize,
  getGroupStock,
  getGroupStatus,
  isGroupLowStock,
  getGroupThreshold,
  sortBatchesForUse,
  needsUseFirstReminder,
  computeExpiry,
  consumeOne,
  deriveCategory,
} from './logic.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const state = {
  items: [],
  search: '',
  category: 'all',
  location: 'all',
  status: 'all',
  sortBy: 'updated',
  currentUser: null, // { id, username }，来自 localStorage 会话
};

// ---------- 账号与会话（多用户，纯本地） ----------
const SESSION_KEY = 'inventory_session';

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}
function setSession(user) {
  state.currentUser = { id: user.id, username: user.username };
  localStorage.setItem(SESSION_KEY, JSON.stringify(state.currentUser));
}
function clearSession() {
  state.currentUser = null;
  localStorage.removeItem(SESSION_KEY);
}

// 鉴权走后端：用户名/密码由服务端校验（SHA-256 + salt），返回 token。
async function registerUser(username, password) {
  return register(username, password);
}
async function loginUser(username, password) {
  return login(username, password);
}

// ---------- 物品照片（压缩后存 dataURL，控制本地体积） ----------
let pendingPhoto = null; // 当前表单待保存的照片 dataURL

async function readPhoto(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('读取失败'));
    fr.onload = () => resolve(fr.result);
    fr.readAsDataURL(file);
  });
  return compressImage(dataUrl, 800, 0.82);
}
function compressImage(dataUrl, maxDim, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
      else if (height >= width && height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      try { resolve(canvas.toDataURL('image/jpeg', quality)); }
      catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const STATUS_LABEL = {
  expired: '已过期',
  expiring: '即将过期',
  ok: '正常',
};

function uid() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function fmtDate(d) {
  if (!d) return '';
  return toLocalISO(new Date(d));
}

function fmtExpiry(item, now = new Date()) {
  const exp = resolveExpiry(item);
  if (!exp) return '未填';
  const dateStr = fmtDate(exp);
  const n = daysUntil(exp, now);
  if (n < 0) return `${dateStr}（已过期 ${-n} 天）`;
  if (n === 0) return `${dateStr}（今天过期）`;
  return `${dateStr}（还有 ${n} 天）`;
}

function fmtGroupStock(group) {
  const unit = group.batches[0]?.unit || '个';
  return `${getGroupStock(group)}${esc(unit)}`; // 修 BUG-E：unit 经 esc 防注入
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ---------- 加载与渲染 ----------

async function load() {
  await purgeExpiredTrash();
  // 共享后端：所有登录同一账号的设备看到同一份库存（后端按账号隔离）
  state.items = await getActiveItems();
  render();
  refreshCategoryChips();
  await checkReminders();
}

// 修 BUG-L：IndexedDB 不可用时捕获异常并提示，避免白屏
function showFatal(msg) {
  const el = document.querySelector('#emptyHint');
  if (el) { el.hidden = false; el.textContent = msg; }
}
async function safeLoad() {
  try { await load(); }
  catch (e) {
    console.error(e);
    // 登录过期 / 无网络：回到登录页，而不是白屏
    if (e && /登录|过期|无法连接服务器|401/.test(e.message)) {
      clearSession();
      state.items = [];
      render();
      showAuth();
    } else {
      showFatal('加载失败：' + (e.message || e));
    }
  }
}

function getGroups() {
  return groupByName(state.items);
}

function render() {
  const groups = getGroups();
  const filtered = applyFilters(groups);
  renderStats(groups);
  renderDashboard(groups);
  renderFilters(groups);
  renderList(filtered);
}

function applyFilters(groups) {
  const q = state.search.trim().toLowerCase();
  const now = new Date();

  let filtered = groups.filter((g) => {
    if (state.category !== 'all') {
      const cats = g.batches.map((it) => it.category || '未分类');
      if (!cats.includes(state.category)) return false;
    }
    if (state.location !== 'all') {
      const locs = g.batches.map((it) => (it.location || '').trim()).filter(Boolean);
      if (!locs.includes(state.location)) return false;
    }
    if (q) {
      const hay = [g.name, ...g.batches.flatMap((it) => [it.name, it.location, it.batchLabel, it.note])]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (state.status === 'expired' && getGroupStatus(g, now) !== 'expired') return false;
    if (state.status === 'expiring' && getGroupStatus(g, now) !== 'expiring') return false;
    if (state.status === 'low' && !isGroupLowStock(g)) return false;
    if (state.status === 'suggest' && !needsUseFirstReminder(g, now)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    if (state.sortBy === 'updated') {
      const ua = Math.max(...a.batches.map((it) => new Date(it.updatedAt || 0).getTime()));
      const ub = Math.max(...b.batches.map((it) => new Date(it.updatedAt || 0).getTime()));
      return ub - ua;
    }
    if (state.sortBy === 'created') {
      const ca = Math.min(...a.batches.map((it) => new Date(it.createdAt || Date.now()).getTime()));
      const cb = Math.min(...b.batches.map((it) => new Date(it.createdAt || Date.now()).getTime()));
      return cb - ca;
    }
    if (state.sortBy === 'expiry') {
      const ba = sortBatchesForUse(a.batches, now)[0];
      const bb = sortBatchesForUse(b.batches, now)[0];
      const ea = resolveExpiry(ba), eb = resolveExpiry(bb);
      if (!ea) return 1;
      if (!eb) return -1;
      return ea - eb;
    }
    if (state.sortBy === 'quantity') {
      return getGroupStock(a) - getGroupStock(b);
    }
    return 0;
  });

  return filtered;
}

function renderStats(groups) {
  const s = summarize(state.items);
  $('#stat-total').textContent = s.total;
  $('#stat-expiring').textContent = s.expiring;
  $('#stat-expired').textContent = s.expired;
  $('#stat-low').textContent = s.low;

  $$('.stat-card').forEach((card) => card.classList.toggle('active', card.dataset.status === state.status));
}

function renderDashboard(groups) {
  const now = new Date();
  const expiredGroups = groups.filter((g) => getGroupStatus(g, now) === 'expired');
  const expiringGroups = groups.filter((g) => getGroupStatus(g, now) === 'expiring');
  const lowGroups = groups.filter((g) => isGroupLowStock(g));
  const suggestGroups = groups.filter((g) => needsUseFirstReminder(g, now));

  const zone = (title, arr, cls, renderRow) => {
    if (!arr.length) return '';
    const rows = arr.map(renderRow).join('');
    return `<div class="zone ${cls}"><h3>${title}（${arr.length}）</h3><ul>${rows}</ul></div>`;
  };

  $('#dashboard').innerHTML = [
    zone('🔴 已过期', expiredGroups, 'z-expired', (g) => {
      const first = sortBatchesForUse(g.batches, now)[0];
      return `<li><span class="z-name">${esc(g.name)}</span><span class="z-meta">${fmtExpiry(first, now)} · ${esc(first.location || '未填位置')}</span></li>`;
    }),
    zone('🟠 即将过期', expiringGroups, 'z-expiring', (g) => {
      const first = sortBatchesForUse(g.batches, now)[0];
      return `<li><span class="z-name">${esc(g.name)}</span><span class="z-meta">${fmtExpiry(first, now)} · 总库存 ${fmtGroupStock(g)}</span></li>`;
    }),
    zone('🟡 库存不足', lowGroups, 'z-low', (g) => {
      const thresholds = g.batches
        .map((it) => it.lowStockThreshold)
        .filter((v) => v != null && v !== '');
      const threshold = thresholds.length ? Math.min(...thresholds.map(Number)) : '-';
      return `<li><span class="z-name">${esc(g.name)}</span><span class="z-meta">总库存 ${fmtGroupStock(g)} · 预警 ≤ ${threshold}</span></li>`;
    }),
    zone('🟢 建议先用', suggestGroups, 'z-suggest', (g) => {
      const sorted = sortBatchesForUse(g.batches, now);
      const first = sorted[0];
      const second = sorted[1];
      return `<li><span class="z-name">${esc(g.name)}</span><span class="z-meta">第1批（${esc(first.batchLabel || '最早批')}）剩 ${Number(first.quantity) || 0}${esc(first.unit || '')}，第2批 ${Number(second.quantity) || 0}${esc(second.unit || '')}</span></li>`;
    }),
  ].join('');
}

function renderFilters(groups) {
  // 分类下拉
  const cats = Array.from(new Set(state.items.map((it) => it.category || '未分类'))).sort();
  const catSelect = $('#categoryFilter');
  const curCat = state.category;
  catSelect.innerHTML =
    '<option value="all">全部分类</option>' +
    cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  catSelect.value = cats.includes(curCat) ? curCat : 'all';
  state.category = catSelect.value;

  // 位置下拉
  const locs = Array.from(new Set(state.items.map((it) => (it.location || '').trim()).filter(Boolean))).sort();
  const locSelect = $('#locationFilter');
  const curLoc = state.location;
  locSelect.innerHTML =
    '<option value="all">全部位置</option>' +
    locs.map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join('');
  locSelect.value = locs.includes(curLoc) ? curLoc : 'all';
  state.location = locSelect.value;

  // 排序
  $('#sortFilter').value = state.sortBy;
}

function renderList(groups) {
  const listEl = $('#list');
  const emptyEl = $('#emptyHint');
  if (!groups.length) {
    listEl.innerHTML = '';
    if (!state.items.length) {
      emptyEl.textContent = '还没有物品，点击右上角「+ 添加」开始记录吧 ✨';
      emptyEl.hidden = false;
    } else {
      emptyEl.textContent = '没有匹配的物品，换个筛选条件试试。';
      emptyEl.hidden = false;
    }
    return;
  }
  emptyEl.hidden = true;

  const now = new Date();
  listEl.innerHTML = groups
    .map((g) => {
      const groupStatus = getGroupStatus(g, now);
      const suggest = needsUseFirstReminder(g, now);
      const sortedBatches = sortBatchesForUse(g.batches, now);
      const unit = sortedBatches[0]?.unit || '个';

      const batchHtml = sortedBatches
        .map((it, idx) => {
          const st = getItemStatus(it, now);
          const isFirst = idx === 0;
          const qty = `${Number(it.quantity) || 0}${it.unit || ''}`;
          return `
          <div class="batch ${st} ${isFirst && suggest ? 'batch-first' : ''}" data-id="${it.id}">
            <div class="batch-header">
              ${it.photo ? `<img class="batch-thumb" data-act="photo" data-id="${esc(it.id)}" src="${it.photo}" alt="${esc(it.name)}照片" />` : ''}
              <div class="batch-left">
                <span class="batch-no">第 ${idx + 1} 批</span>
                ${it.name ? `<span class="batch-name">${esc(it.name)}</span>` : ''}
                ${it.batchLabel ? `<span class="batch-label">${esc(it.batchLabel)}</span>` : ''}
                ${isFirst && suggest ? `<span class="use-first-badge">先用这箱</span>` : ''}
                <span class="badge ${st}">${STATUS_LABEL[st]}</span>
              </div>
              <div class="qty-stepper">
                <button class="mini qty" data-act="minus" data-id="${it.id}" aria-label="减少1">−</button>
                <span class="batch-qty">${esc(qty)}</span>
                <button class="mini qty" data-act="plus" data-id="${it.id}" aria-label="增加1">+</button>
              </div>
            </div>
            <div class="batch-body">
              <span>📍 ${esc(it.location || '未填位置')}</span>
              <span>🛒 生产日期：${it.productionDate ? fmtDate(it.productionDate) : '未填'}</span>
              <span>⏰ 过期日期：${fmtExpiry(it, now)}</span>
              <span>⚠️ 低库存阈值：${it.lowStockThreshold != null ? esc(String(it.lowStockThreshold)) + esc(it.unit || '个') : '未设'}</span>
              ${it.note ? `<span class="batch-note">📝 ${esc(it.note)}</span>` : ''}
            </div>
            <div class="batch-actions">
              <button class="mini use" data-act="use" data-id="${it.id}">用掉</button>
              <button class="mini" data-act="edit" data-id="${it.id}">编辑</button>
              <button class="mini danger" data-act="del" data-id="${it.id}">删除</button>
            </div>
          </div>`;
        })
        .join('');

      return `
      <div class="group-card">
        <div class="group-header">
          <div class="group-left">
            <h3 class="group-title">${esc(g.name)}</h3>
            ${suggest ? '<span class="use-first-badge">先用最早批</span>' : ''}
            <span class="badge ${groupStatus}">${STATUS_LABEL[groupStatus]}</span>
          </div>
          <div class="group-right">
            <span class="group-stock">共 ${getGroupStock(g)}${unit}</span>
          </div>
        </div>
        <div class="batches">${batchHtml}</div>
      </div>`;
    })
    .join('');
}

// ---------- 表单 ----------

function openModal(item = null) {
  const form = $('#itemForm');
  form.reset();
  $('#computedHint').textContent = '';
  // 照片：编辑时回填已有照片，新增时清空
  pendingPhoto = item && item.photo ? item.photo : null;
  if (pendingPhoto) {
    $('#photoImg').src = pendingPhoto;
    $('#photoPreview').hidden = false;
    $('#photoPickBtn').textContent = '📷 重选照片';
  } else {
    $('#photoPreview').hidden = true;
    $('#photoImg').src = '';
    $('#photoPickBtn').textContent = '📷 选择照片';
  }
  $('#f_photo').value = '';
  if (item) {
    $('#modalTitle').textContent = '编辑物品';
    $('#itemId').value = item.id;
    $('#f_name').value = item.name || '';
    $('#f_category').value = item.category || '';
    $('#f_location').value = item.location || '';
    $('#f_quantity').value = item.quantity ?? '';
    $('#f_unit').value = item.unit || '个';
    $('#f_productionDate').value = fmtDate(item.productionDate);
    $('#f_expiryDate').value = fmtDate(item.expiryDate);
    $('#f_shelfLifeDays').value = item.shelfLifeDays ?? '';
    $('#f_expiringSoonDays').value = item.expiringSoonDays ?? '';
    $('#f_lowStockThreshold').value = item.lowStockThreshold ?? '';
    $('#f_batchLabel').value = item.batchLabel || '';
    $('#f_note').value = item.note || '';
    $('#deleteBtn').hidden = false;
  } else {
    $('#modalTitle').textContent = '添加物品';
    $('#itemId').value = '';
    $('#deleteBtn').hidden = true;
  }
  // 判定用哪种录入方式：有确切过期日且无生产日期+保质期组合 → 手动模式
  const manualMode = !!(item && item.expiryDate && !(item.productionDate && item.shelfLifeDays));
  setExpiryMode(manualMode ? 'manual' : 'auto', { prefill: false });
  $('#modal').hidden = false;
}

function closeModal() {
  $('#modal').hidden = true;
}

function setExpiryMode(mode, { prefill = true } = {}) {
  const auto = mode === 'auto';
  $$('.seg').forEach((s) => s.classList.toggle('active', s.dataset.mode === mode));
  $('#expiryAutoFields').hidden = !auto;
  $('#computedHint').hidden = !auto;
  $('#expiryManualField').hidden = auto;
  if (auto) {
    updateComputedHint();
  } else if (prefill) {
    // 切到手动时，把已算出的过期日带过去，方便用户微调
    const exp = computeExpiry($('#f_productionDate').value, $('#f_shelfLifeDays').value);
    $('#f_expiryDate').value = exp ? fmtDate(exp) : '';
  }
}

function updateComputedHint() {
  const d = $('#f_productionDate').value;
  const days = $('#f_shelfLifeDays').value;
  const exp = computeExpiry(d, days);
  $('#computedHint').textContent = exp
    ? `→ 预计过期日：${fmtDate(exp)}（已自动保存，无需手填）`
    : '填写生产日期与保质期后，过期日会自动算出并保存。';
}

async function submitForm(e) {
  e.preventDefault();
  const id = $('#itemId').value;
  const mode = (document.querySelector('input[name="expiryMode"]:checked') || {}).value || 'auto';

  // 保留原有归属，编辑时不改变物品的 ownerId
  const existing = id ? state.items.find((it) => it.id === id) : null;

  // 只保存一种来源的过期信息，避免两个来源互相打架
  let productionDate = null, shelfLifeDays = null, expiryDate = null;
  if (mode === 'auto') {
    productionDate = $('#f_productionDate').value || null;
    shelfLifeDays = $('#f_shelfLifeDays').value === '' ? null : Number($('#f_shelfLifeDays').value);
    // 过期日不单独存，读取时由「生产日期+保质期」自动算
  } else {
    expiryDate = $('#f_expiryDate').value || null;
  }

  const item = {
    id: id || uid(),
    name: $('#f_name').value.trim(),
    category: deriveCategory($('#f_name').value, $('#f_category').value),
    location: $('#f_location').value.trim(),
    quantity: $('#f_quantity').value === '' ? 0 : Number($('#f_quantity').value),
    unit: $('#f_unit').value.trim() || '个',
    productionDate,
    expiryDate,
    shelfLifeDays,
    lowStockThreshold: $('#f_lowStockThreshold').value === '' ? null : Number($('#f_lowStockThreshold').value),
    expiringSoonDays: $('#f_expiringSoonDays').value === '' ? null : Number($('#f_expiringSoonDays').value),
    batchLabel: $('#f_batchLabel').value.trim() || null,
    note: $('#f_note').value.trim(),
    ownerId: existing ? existing.ownerId : (state.currentUser?.id ?? null),
    photo: pendingPhoto,
    updatedAt: new Date().toISOString(),
  };
  if (id) {
    await updateItem(item);
  } else {
    item.createdAt = item.updatedAt;
    await addItem(item);
  }
  closeModal();
  await safeLoad();
}

async function doDelete() {
  const id = $('#itemId').value;
  if (!id) return;
  if (!confirm('确定删除这一批物品？\n（会进入回收站，30 天内可恢复）')) return;
  await softDeleteItem(id);
  closeModal();
  await safeLoad();
}

// 列表上直接「用掉 N」：无需进编辑页；扣完时弹窗确认是否删除
async function adjustQuantity(item, delta) {
  const qty = Number(item.quantity) || 0;
  const next = Math.max(0, qty + delta);
  if (next === 0) {
    if (confirm(`「${item.name || ''}」数量将变为 0，删除这一批？\n（取消则保留 1 个；确认后进回收站可恢复）`)) {
      await recordConsume(item, qty); // 记录本次实际消耗的数量
      await softDeleteItem(item.id);
    } else {
      return; // 取消删除，保持原数量
    }
  } else {
    const updated = { ...item, quantity: next, updatedAt: new Date().toISOString() };
    await updateItem(updated);
    if (delta < 0) await recordConsume(item, Math.abs(delta));
  }
  await safeLoad();
}

async function consumeItem(item, amount = 1) {
  const result = consumeOne(item, amount);
  if (result.action === 'none') return;
  if (result.action === 'update') {
    await updateItem(result.item);
    await recordConsume(item, amount);
    await safeLoad();
    return;
  }
  // action === 'delete'：这箱已用完，弹窗提醒后删除（进回收站）
  const label = item.name || item.category || '这条记录';
  if (confirm(`「${label}」这箱已用完，删除这条记录？\n（进回收站，30 天内可恢复）`)) {
    await recordConsume(item, Number(item.quantity) || 0);
    await softDeleteItem(item.id);
    await safeLoad();
  }
}

// 记录一次消耗事件，供「消耗趋势统计」使用
async function recordConsume(item, qty) {
  if (!(qty > 0)) return;
  await addConsumeLog({
    id: uid(),
    ownerId: state.currentUser?.id || null,
    itemId: item.id,
    name: item.name || item.category || '物品',
    qty,
    at: new Date().toISOString(),
  });
}

// ---------- 事件绑定 ----------

function bind() {
  $('#addBtn').addEventListener('click', () => openModal());
  $('#modalClose').addEventListener('click', closeModal);
  $('#cancelBtn').addEventListener('click', closeModal);
  $('#modalBackdrop').addEventListener('click', closeModal);
  $('#itemForm').addEventListener('submit', submitForm);
  $('#deleteBtn').addEventListener('click', doDelete);
  $('#userBtn').addEventListener('click', (e) => { e.stopPropagation(); openUserMenu(); });
  bindPhoto();

  $('#f_productionDate').addEventListener('input', updateComputedHint);
  $('#f_shelfLifeDays').addEventListener('input', updateComputedHint);
  $$('input[name="expiryMode"]').forEach((r) =>
    r.addEventListener('change', (e) => setExpiryMode(e.target.value))
  );

  $('#searchInput').addEventListener('input', (e) => {
    state.search = e.target.value;
    render();
  });
  $('#categoryFilter').addEventListener('change', (e) => {
    state.category = e.target.value;
    refreshCategoryChips();
    render();
  });
  $('#locationFilter').addEventListener('change', (e) => {
    state.location = e.target.value;
    render();
  });
  $('#sortFilter').addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    render();
  });

  $('.stats-row').addEventListener('click', (e) => {
    const card = e.target.closest('.stat-card');
    if (!card) return;
    state.status = card.dataset.status;
    render();
  });

  $('#list').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    const item = state.items.find((it) => it.id === id);
    if (!item) return;
    if (btn.dataset.act === 'edit') {
      openModal(item);
      return;
    }
    if (btn.dataset.act === 'photo') {
      const it = state.items.find((x) => x.id === btn.dataset.id);
      if (it && it.photo) openLightbox(it.photo);
      return;
    }
    if (btn.dataset.act === 'use') {
      openConsume(item);
      return;
    }
    if (btn.dataset.act === 'plus') {
      await adjustQuantity(item, 1);
      return;
    }
    if (btn.dataset.act === 'minus') {
      await adjustQuantity(item, -1);
      return;
    }
    if (btn.dataset.act === 'del') {
      if (confirm(`删除「${item.name || item.category}」的这一批？\n（进回收站，30 天内可恢复）`)) {
        await softDeleteItem(id);
        await safeLoad();
      }
    }
  });

  // 新增交互绑定
  $('#lightbox').addEventListener('click', (e) => {
    if (e.target.id === 'lightbox' || e.target.id === 'lightboxClose') closeLightbox();
  });
  $('#consumeOk').addEventListener('click', confirmConsume);
  $('#consumeCancel').addEventListener('click', () => { $('#consumeModal').hidden = true; consumeTarget = null; });
  $('#restockBtn').addEventListener('click', openRestock);
  $('#restockClose').addEventListener('click', () => { $('#restockModal').hidden = true; });
  $('#restockClose2').addEventListener('click', () => { $('#restockModal').hidden = true; });
  $('#restockCopy').addEventListener('click', copyRestock);
  $('#dataBtn').addEventListener('click', () => { $('#dataModal').hidden = false; });
  $('#dataClose').addEventListener('click', () => { $('#dataModal').hidden = true; });
  $('#exportBtn').addEventListener('click', exportData);
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    await importData(file);
    e.target.value = '';
  });
  $('#userMenuList').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-user]');
    if (b) await switchUser(b.dataset.user);
  });
  $('#userMenuLogout').addEventListener('click', () => { $('#userMenu').hidden = true; logout(); });

  // 分类快捷筛选条
  $('#categoryChips').addEventListener('click', (e) => {
    const chip = e.target.closest('button[data-cat]');
    if (!chip) return;
    state.category = chip.dataset.cat;
    const sel = $('#categoryFilter');
    if (sel) sel.value = state.category;
    refreshCategoryChips();
    render();
  });
  // 提醒：请求通知权限并立即检查
  $('#bellBtn').addEventListener('click', async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch { /* ignore */ }
    }
    await checkReminders(true);
  });
  // 统计
  $('#statsBtn').addEventListener('click', openStats);
  // 回收站
  $('#trashBtn').addEventListener('click', openTrash);
  $('#trashClose').addEventListener('click', () => { $('#trashModal').hidden = true; });
  $('#trashClose2').addEventListener('click', () => { $('#trashModal').hidden = true; });
  $('#trashClear').addEventListener('click', clearTrash);
  $('#trashList').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.act === 'restore') await restoreTrash(id);
    else if (btn.dataset.act === 'purge') await purgeTrash(id);
  });
  $('#statsClose').addEventListener('click', () => { $('#statsModal').hidden = true; });
  // Excel 导出
  $('#exportExcelBtn').addEventListener('click', exportExcel);

  document.addEventListener('click', (e) => {
    const menu = $('#userMenu');
    if (menu.hidden) return;
    if (!menu.contains(e.target) && e.target.id !== 'userBtn') menu.hidden = true;
  });
}

// ---------- 照片上传交互 ----------

function bindPhoto() {
  $('#photoPickBtn').addEventListener('click', () => $('#f_photo').click());
  $('#f_photo').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      pendingPhoto = await readPhoto(file);
      $('#photoImg').src = pendingPhoto;
      $('#photoPreview').hidden = false;
      $('#photoPickBtn').textContent = '📷 重选照片';
    } catch (err) {
      alert('照片读取失败：' + (err.message || err));
    }
  });
  $('#photoRemoveBtn').addEventListener('click', () => {
    pendingPhoto = null;
    $('#f_photo').value = '';
    $('#photoPreview').hidden = true;
    $('#photoImg').src = '';
    $('#photoPickBtn').textContent = '📷 选择照片';
  });
}

// ---------- 新增交互：看大图 / 用掉N / 切换账号 / 补货 / 数据 ----------
let consumeTarget = null;

function openLightbox(photo) {
  $('#lightboxImg').src = photo;
  $('#lightbox').hidden = false;
}
function closeLightbox() {
  $('#lightbox').hidden = true;
  $('#lightboxImg').src = '';
}
function openConsume(item) {
  consumeTarget = item;
  $('#consumeQty').value = '1';
  $('#consumeModal').hidden = false;
  try { $('#consumeQty').focus(); } catch { /* ignore */ }
}
async function confirmConsume() {
  const n = Math.max(1, Math.floor(Number($('#consumeQty').value) || 1));
  const item = consumeTarget;
  $('#consumeModal').hidden = true;
  consumeTarget = null;
  if (item) await consumeItem(item, n);
}

// ---------- 新增：分类筛选条 / 回收站 / 通知 / 统计 / Excel ----------

// 分类快捷筛选条：依当前数据动态生成
function refreshCategoryChips() {
  const chips = $('#categoryChips');
  if (!chips) return;
  const cats = Array.from(new Set(state.items.map((it) => (it.category || '未分类').trim()).filter(Boolean)));
  const all = [{ key: 'all', label: '全部' }].concat(cats.map((c) => ({ key: c, label: c })));
  chips.innerHTML = all
    .map((c) => `<button class="chip ${state.category === c.key ? 'active' : ''}" data-cat="${esc(c.key)}">${esc(c.label)}</button>`)
    .join('');
  chips.hidden = cats.length === 0;
}

// D. 回收站（软删除恢复）
async function openTrash() {
  await renderTrashList();
  $('#trashModal').hidden = false;
}
async function renderTrashList() {
  const items = await getTrashedItems(state.currentUser?.id || null);
  const list = $('#trashList');
  if (!items.length) {
    list.innerHTML = '<li class="trash-empty">回收站是空的 ✨</li>';
    return;
  }
  list.innerHTML = items
    .map((it) => {
      const days = Math.max(0, Math.ceil((Date.now() - new Date(it.deletedAt).getTime()) / 86400000));
      const left = Math.max(0, 30 - days);
      return `<li class="trash-item">
        <div class="trash-info">
          <span class="trash-name">${esc(it.name || it.category || '物品')}</span>
          <span class="trash-meta">${esc(it.location || '')} · 剩 ${Number(it.quantity) || 0}${esc(it.unit || '')} · ${left} 天后彻底删除</span>
        </div>
        <div class="trash-actions">
          <button class="mini" data-act="restore" data-id="${esc(it.id)}">恢复</button>
          <button class="mini danger" data-act="purge" data-id="${esc(it.id)}">彻底删除</button>
        </div>
      </li>`;
    })
    .join('');
}
async function restoreTrash(id) {
  await restoreItem(id);
  await renderTrashList();
  await safeLoad();
}
async function purgeTrash(id) {
  if (!confirm('彻底删除后无法恢复，确定？')) return;
  await deleteItem(id);
  await renderTrashList();
  await safeLoad();
}
async function clearTrash() {
  if (!confirm('清空回收站？所有删除的物品将永久消失。')) return;
  const items = await getTrashedItems(state.currentUser?.id || null);
  for (const it of items) await deleteItem(it.id);
  await renderTrashList();
  await safeLoad();
}

// 浏览器通知：临期 / 已过期 / 低库存（每天最多弹一次，force 可忽略节流）
async function checkReminders(force = false) {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const today = new Date().toISOString().slice(0, 10);
    if (!force && localStorage.getItem('inv_reminder_date') === today) return;
    const groups = getGroups();
    const now = new Date();
    const expired = groups.filter((g) => getGroupStatus(g, now) === 'expired').length;
    const expiring = groups.filter((g) => getGroupStatus(g, now) === 'expiring').length;
    const low = groups.filter((g) => isGroupLowStock(g)).length;
    const parts = [];
    if (expired) parts.push(`${expired} 件已过期`);
    if (expiring) parts.push(`${expiring} 件即将过期`);
    if (low) parts.push(`${low} 件库存不足`);
    if (parts.length) {
      new Notification('📦 库存提醒', { body: parts.join('，') + '，记得处理～' });
      localStorage.setItem('inv_reminder_date', today);
    }
  } catch { /* 通知失败不影响主流程 */ }
}

// E. 消耗趋势统计（近 30 天）
async function openStats() {
  const logs = await getConsumeLogs();
  const me = state.currentUser?.id;
  const mine = logs.filter((l) => !me || l.ownerId == null || l.ownerId === me);
  const days = 30;
  const today = new Date();
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.push({ date: d, key: toLocalISO(d), total: 0, byName: {} });
  }
  const map = Object.fromEntries(buckets.map((b) => [b.key, b]));
  for (const l of mine) {
    const b = map[toLocalISO(new Date(l.at))];
    if (b) { b.total += l.qty; b.byName[l.name] = (b.byName[l.name] || 0) + l.qty; }
  }
  const max = Math.max(1, ...buckets.map((b) => b.total));
  $('#statsChart').innerHTML = buckets
    .map((b) => {
      const h = Math.round((b.total / max) * 100);
      const detail = Object.entries(b.byName).map(([n, q]) => `${n}×${q}`).join('、');
      return `<div class="bar-col" title="${b.key}${b.total ? '：' + detail : ''}">
        <div class="bar ${b.total ? '' : 'empty'}" style="height:${h}px"></div>
        <span class="bar-day">${b.date.getDate()}</span>
      </div>`;
    })
    .join('');
  const totalQty = buckets.reduce((s, b) => s + b.total, 0);
  const agg = {};
  for (const l of mine) agg[l.name] = (agg[l.name] || 0) + l.qty;
  const top = Object.entries(agg).sort((a, b) => b[1] - a[1])[0];
  $('#statsSummary').textContent = `近 30 天共消耗 ${totalQty} 个；消耗最多的是 ${top ? top[0] + `（${top[1]} 个）` : '暂无'}。`;
  $('#statsModal').hidden = false;
}

// 导出 Excel（CSV，带 BOM 让 Excel 正确识别中文）
function exportExcel() {
  const me = state.currentUser?.id;
  const items = (!me ? state.items : state.items.filter((it) => it.ownerId == null || it.ownerId === me));
  const header = ['名称', '分类', '位置', '数量', '单位', '生产日期', '过期日期', '临期天数', '低库存阈值', '批次标签', '备注'];
  const rows = items.map((it) => [
    it.name || '', it.category || '', it.location || '', it.quantity ?? '', it.unit || '',
    it.productionDate || '', it.expiryDate || '', it.expiringSoonDays ?? '', it.lowStockThreshold ?? '',
    it.batchLabel || '', it.note || '',
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `库存清单_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// B. 切换账号（本地多账号，免密快捷切换）
async function openUserMenu() {
  const list = $('#userMenuList');
  const u = state.currentUser;
  list.innerHTML = `<div class="user-menu-item active">${esc(u ? u.username : '')}</div>`;
  $('#userMenu').hidden = false;
}
// 共享后端下不支持免密切换；点菜单项即退出到登录页
async function switchUser() {
  logout();
}

// C2. 待补货清单
function buildRestockList() {
  const groups = getGroups();
  const now = new Date();
  const rows = [];
  for (const g of groups) {
    if (isGroupLowStock(g)) {
      const threshold = getGroupThreshold(g) || 0;
      const stock = getGroupStock(g);
      const need = Math.max(1, Math.ceil(threshold - stock) + 1);
      rows.push({ name: g.name, need, reason: `库存不足（剩 ${stock}${g.batches[0]?.unit || ''} ≤ 阈值 ${threshold}）` });
    } else {
      const st = getGroupStatus(g, now);
      if (st === 'expired') rows.push({ name: g.name, need: 1, reason: '已过期，需处理 / 补货' });
      else if (st === 'expiring') rows.push({ name: g.name, need: 1, reason: '即将过期，按需补货' });
    }
  }
  return rows;
}
function openRestock() {
  const rows = buildRestockList();
  const ul = $('#restockList');
  if (!rows.length) ul.innerHTML = '<li class="restock-empty">🎉 暂无需补货的物品</li>';
  else ul.innerHTML = rows.map((r) => `<li><b>${esc(r.name)}</b> ×${r.need} — ${esc(r.reason)}</li>`).join('');
  $('#restockModal').hidden = false;
}
function copyRestock() {
  const text = Array.from($$('#restockList li')).map((li) => li.textContent).join('\n');
  if (navigator.clipboard && text) {
    navigator.clipboard.writeText(text).then(() => alert('已复制补货清单')).catch(() => {});
  }
}

// C3. 数据导出 / 导入（换机 / 重装不丢）
async function exportData() {
  try {
    const items = await getAllItems();
    const users = await getAllUsers();
    const payload = { app: 'inventory', version: 1, exportedAt: new Date().toISOString(), items, users };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    alert('已导出备份文件');
  } catch (e) { alert('导出失败：' + (e.message || e)); }
}
async function importData(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const items = Array.isArray(data.items) ? data.items : [];
    const users = Array.isArray(data.users) ? data.users : [];
    if (!items.length && !users.length) throw new Error('备份文件为空或格式不正确');
    if (!confirm(`即将导入：${items.length} 件物品、${users.length} 个账号。\n同名物品 / 账号将被覆盖，确定继续？`)) return;
    await importBackup({ items, users });
    $('#dataModal').hidden = true;
    await safeLoad();
    alert('导入完成');
  } catch (e) { alert('导入失败：' + (e.message || e)); }
}

// ---------- 登录 / 注册 交互 ----------

let authTab = 'login';

function showAuth() { $('#auth').hidden = false; resetAuthForm(); }
function hideAuth() { $('#auth').hidden = true; }

function resetAuthForm() {
  $('#authMsg').hidden = true;
  $('#authForm').reset();
}
function setAuthTab(tab) {
  authTab = tab;
  $$('.auth-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  $('#authConfirmWrap').hidden = tab !== 'register';
  $('#authSubmit').textContent = tab === 'register' ? '注册并进入' : '登录';
  $('#authPassword').setAttribute('autocomplete', tab === 'register' ? 'new-password' : 'current-password');
}
function updateUserChip() {
  const on = !!state.currentUser;
  const chip = $('#userBtn');
  chip.hidden = !on;
  if (on) chip.textContent = `👤 ${state.currentUser.username}`;
  ['#dataBtn', '#restockBtn', '#bellBtn', '#statsBtn', '#trashBtn'].forEach((s) => { $(s).hidden = !on; });
}
async function logout() {
  if (!confirm('退出当前账号？用同一账号登录的其他设备仍能看到这份库存。')) return;
  clearToken();      // 清除后端 JWT
  clearSession();
  state.items = [];
  updateUserChip();
  render();
  showAuth();
}

function bindAuth() {
  $$('.auth-tab').forEach((t) => t.addEventListener('click', () => setAuthTab(t.dataset.tab)));
  $('#authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('#authUsername').value.trim();
    const password = $('#authPassword').value;
    const msg = $('#authMsg');
    msg.hidden = false;
    msg.classList.remove('error');
    try {
      if (authTab === 'register' && $('#authConfirm').value !== password) {
        throw new Error('两次密码不一致');
      }
      const user = authTab === 'register'
        ? await registerUser(username, password)
        : await loginUser(username, password);
      setSession(user);
      updateUserChip();
      hideAuth();
      await safeLoad();
    } catch (err) {
      msg.textContent = err.message || '操作失败';
      msg.classList.add('error');
    }
  });
}

// ---------- 启动 ----------

async function start() {
  try { await initDB(); }
  catch (e) {
    console.error(e);
    showFatal('初始化失败，请刷新页面后重试。');
    return;
  }
  bind();
  bindAuth();
  updateUserChip();
  const session = getSession();
  if (session && session.id) {
    state.currentUser = session;
    updateUserChip();
    hideAuth();
    await safeLoad();
  } else {
    showAuth();
  }
  // 共享后端模式不注册 Service Worker：应用必须联网访问后端，避免缓存旧页面
}

start();
