/**
 * dashboard.js
 * Powers dashboard/index.html only. This file is never loaded by the
 * public Trust Page (js/public.js is its own separate, much smaller
 * bundle) — so a visitor to "/" never even downloads the code for
 * logging in, managing deals, or the testimonial CMS.
 */

let state = {
  deals: [],
  staff: [],
  testimonials: [],
  stats: {},
};

let isLoggedIn = false;

/* ---------- fetch helpers ---------- */
async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed (${res.status})`);
  return res.json();
}

async function apiJSON(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${method} ${url} failed (${res.status})`);
  return data;
}

async function apiForm(url, method, formData) {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${method} ${url} failed (${res.status})`);
  return data;
}

function fmtIDR(n) {
  return 'Rp' + Number(n).toLocaleString('id-ID');
}

const STATUS_LABELS = { completed: 'Completed', process: 'In Progress', pending: 'Pending', dispute: 'Dispute' };
function statusLabel(s) {
  return STATUS_LABELS[s] || s;
}
function staffName(id) {
  const s = state.staff.find((x) => x.id === id);
  return s ? s.name : '—';
}
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

/* ---------- initial load ---------- */
async function loadData() {
  const [deals, staff, testimonials, stats, session] = await Promise.all([
    apiGet('/api/deals'),
    apiGet('/api/staff'),
    apiGet('/api/testimonials'),
    apiGet('/api/stats'),
    apiGet('/api/session'),
  ]);
  state.deals = deals;
  state.staff = staff;
  state.testimonials = testimonials;
  state.stats = stats;
  applyAuthUI(session);
  renderDashboard();
}

/* ---------- auth ---------- */
function updateGateVisibility() {
  document.getElementById('gate').style.display = isLoggedIn ? 'none' : 'block';
  document.getElementById('dashboard-content').style.display = isLoggedIn ? 'block' : 'none';
}

function applyAuthUI(session) {
  isLoggedIn = !!session.loggedIn;
  document.getElementById('dash-whoami').textContent = isLoggedIn ? `Signed in as ${session.username}` : '';
  updateGateVisibility();
}

async function handleLogin(e) {
  e.preventDefault();
  const errEl = document.getElementById('gate-err');
  const btn = document.getElementById('login-submit-btn');
  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    const data = await apiJSON('/api/login', 'POST', {
      username: document.getElementById('login-username').value.trim(),
      password: document.getElementById('login-password').value,
    });
    isLoggedIn = true;
    document.getElementById('dash-whoami').textContent = `Signed in as ${data.username}`;
    document.getElementById('login-form').reset();
    updateGateVisibility();
    await loadData();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

async function handleLogout() {
  try {
    await apiJSON('/api/logout', 'POST');
  } catch (err) {
    // drop client-side state regardless
  }
  isLoggedIn = false;
  updateGateVisibility();
}

/* ---------- change password modal ---------- */
function openChangePassword() {
  document.getElementById('pw-form').reset();
  document.getElementById('pw-form-err').textContent = '';
  document.getElementById('pw-modal-backdrop').classList.add('open');
}
function closeChangePassword() {
  document.getElementById('pw-modal-backdrop').classList.remove('open');
}
async function submitChangePassword(e) {
  e.preventDefault();
  const errEl = document.getElementById('pw-form-err');
  errEl.textContent = '';
  try {
    await apiJSON('/api/change-password', 'POST', {
      currentPassword: document.getElementById('pw-current').value,
      newPassword: document.getElementById('pw-new').value,
    });
    closeChangePassword();
    alert('Password updated.');
  } catch (err) {
    errEl.textContent = err.message;
  }
}

/* ---------- render: dashboard ---------- */
function renderDashboard() {
  const completed = state.deals.filter((d) => d.status === 'completed');
  const totalRevenue = completed.reduce((a, d) => a + Number(d.value), 0);
  const active = state.deals.filter((d) => d.status === 'process' || d.status === 'pending').length;
  const disputes = state.deals.filter((d) => d.status === 'dispute').length;

  const kpis = [
    { label: 'Total Revenue', val: fmtIDR(totalRevenue), icon: 'coin', color: 'var(--cyan)' },
    { label: 'Completed Deals', val: completed.length, icon: 'check', color: 'var(--violet)' },
    { label: 'Active Deals', val: active, icon: 'clock', color: 'var(--gold)' },
    { label: 'Disputes', val: disputes, icon: 'alert', color: 'var(--rose)' },
  ];
  const icons = {
    coin: '<circle cx="12" cy="12" r="9"/><path d="M9 12h6M12 9v6"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9L2.5 18a1 1 0 0 0 .9 1.5h17.2a1 1 0 0 0 .9-1.5L13.7 3.9a1 1 0 0 0-1.7 0z"/>',
  };
  document.getElementById('kpi-row').innerHTML = kpis
    .map(
      (k) => `
    <div class="kpi">
      <div class="kpi-top">
        <div class="kpi-icon" style="background:${k.color}22;color:${k.color}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icons[k.icon]}</svg></div>
      </div>
      <div class="kpi-num">${k.val}</div>
      <div class="kpi-label">${k.label}</div>
    </div>`
    )
    .join('');

  const last7 = completed.slice(-7);
  const maxV = Math.max(...last7.map((d) => d.value), 1);
  document.getElementById('revenue-chart').innerHTML = last7.length
    ? last7
        .map(
          (d) => `
    <div class="bar-col">
      <div class="bar" style="height:${Math.max((d.value / maxV) * 120, 6)}px"></div>
      <div class="bar-label">${escapeHTML(d.buyer.slice(0, 6))}</div>
    </div>`
        )
        .join('')
    : '<div class="section-note">No completed deals yet</div>';

  document.getElementById('f-staff').innerHTML = state.staff
    .map((s) => `<option value="${s.id}">${escapeHTML(s.name)}</option>`)
    .join('');

  document.getElementById('admin-deal-count').textContent = `${state.deals.length} TOTAL`;
  document.getElementById('admin-deals-body').innerHTML = [...state.deals]
    .reverse()
    .map(
      (d) => `
    <tr>
      <td>${escapeHTML(d.buyer)} ↔ ${escapeHTML(d.seller)}</td>
      <td>${escapeHTML(d.item)}</td>
      <td class="mono">${fmtIDR(d.value)}</td>
      <td>${escapeHTML(staffName(d.staff))}</td>
      <td>
        <select onchange="updateStatus('${d.id}',this.value)">
          ${['pending', 'process', 'completed', 'dispute']
            .map((s) => `<option value="${s}" ${s === d.status ? 'selected' : ''}>${statusLabel(s)}</option>`)
            .join('')}
        </select>
      </td>
      <td><button class="icon-btn" onclick="deleteDeal('${d.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6h12z"/></svg></button></td>
    </tr>`
    )
    .join('');

  document.getElementById('staff-admin-list').innerHTML = state.staff
    .map(
      (s) => `
    <div class="staff-admin-row">
      <div style="display:flex;align-items:center;gap:12px;">
        <div class="staff-avatar" style="width:38px;height:38px;font-size:14px;margin:0;">${escapeHTML(s.name.charAt(0))}</div>
        <div><div style="font-weight:600;font-size:13.5px;">${escapeHTML(s.name)}</div><div class="section-note">${escapeHTML(s.role)} · ${s.deals} completed deals</div></div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="section-note">Rating</span>
        <input class="rating-input" type="number" step="0.1" min="0" max="5" value="${s.rating}" onchange="updateRating('${s.id}',this.value)">
      </div>
    </div>`
    )
    .join('');

  renderStatsForm();
  renderTestimonialsAdmin();
}

function renderStatsForm() {
  const s = state.stats || {};
  const fields = [
    'successfulTransactions',
    'satisfactionRate',
    'yearsTrusted',
    'midmanDeals',
    'boostingCompleted',
    'accountsSold',
    'topupSocial',
  ];
  fields.forEach((field) => {
    const input = document.getElementById('stat-' + field);
    if (input && document.activeElement !== input) {
      input.value = s[field] ?? '';
    }
  });
}

function renderTestimonialsAdmin() {
  const grid = document.getElementById('testi-admin-grid');
  document.getElementById('testi-admin-count').textContent = `${state.testimonials.length} TOTAL`;

  if (!state.testimonials.length) {
    grid.innerHTML = '<div class="section-note">No testimonials added yet.</div>';
    return;
  }

  grid.innerHTML = state.testimonials
    .map((t) => {
      const thumb = t.imageUrl
        ? `<img src="${t.imageUrl}" alt="${escapeHTML(t.buyerName)}">`
        : `<div class="testi-admin-thumb-stars">${'★'.repeat(t.rating || 0)}${'☆'.repeat(5 - (t.rating || 0))}</div>`;
      return `
    <div class="testi-admin-card">
      ${thumb}
      <div class="testi-admin-card-body">
        <div class="testi-admin-card-name">${escapeHTML(t.buyerName)}</div>
        <div class="testi-admin-card-actions">
          <button onclick="editTestimonial('${t.id}')">Edit</button>
          <button class="danger" onclick="deleteTestimonial('${t.id}')">Delete</button>
        </div>
      </div>
    </div>`;
    })
    .join('');
}

/* ---------- actions: homepage stats ---------- */
async function submitStats(e) {
  e.preventDefault();
  const errEl = document.getElementById('stats-form-err');
  const btn = document.getElementById('stats-submit-btn');
  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const fields = [
    'successfulTransactions',
    'satisfactionRate',
    'yearsTrusted',
    'midmanDeals',
    'boostingCompleted',
    'accountsSold',
    'topupSocial',
  ];
  const payload = {};
  fields.forEach((f) => {
    payload[f] = document.getElementById('stat-' + f).value;
  });

  try {
    await apiJSON('/api/stats', 'PUT', payload);
    await loadData();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Stats';
  }
}

/* ---------- actions: deals ---------- */
async function addDeal(e) {
  e.preventDefault();
  const payload = {
    buyer: document.getElementById('f-buyer').value.trim(),
    seller: document.getElementById('f-seller').value.trim(),
    item: document.getElementById('f-item').value.trim(),
    value: Number(document.getElementById('f-value').value),
    status: document.getElementById('f-status').value,
    staff: document.getElementById('f-staff').value,
  };
  try {
    await apiJSON('/api/deals', 'POST', payload);
    e.target.reset();
    await loadData();
  } catch (err) {
    alert(err.message);
  }
}

async function updateStatus(id, val) {
  try {
    await apiJSON(`/api/deals/${id}`, 'PUT', { status: val });
    await loadData();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteDeal(id) {
  if (!confirm('Delete this deal? This cannot be undone.')) return;
  try {
    await apiJSON(`/api/deals/${id}`, 'DELETE');
    await loadData();
  } catch (err) {
    alert(err.message);
  }
}

/* ---------- actions: staff ---------- */
async function updateRating(id, val) {
  try {
    await apiJSON(`/api/staff/${id}`, 'PUT', { rating: Number(val) });
    await loadData();
  } catch (err) {
    alert(err.message);
  }
}

/* ---------- actions: testimonials (photo + star-rating CMS) ---------- */
function initStarPicker() {
  const picker = document.getElementById('testi-rating-picker');
  const buttons = [...picker.querySelectorAll('button')];
  const hint = picker.querySelector('.star-picker-hint');

  function paint(value) {
    buttons.forEach((btn) => btn.classList.toggle('active', Number(btn.dataset.star) <= value));
  }

  buttons.forEach((btn) => {
    btn.addEventListener('mouseenter', () => paint(Number(btn.dataset.star)));
    btn.addEventListener('click', () => {
      const current = Number(picker.dataset.value);
      const clicked = Number(btn.dataset.star);
      const next = current === clicked ? 0 : clicked;
      picker.dataset.value = next;
      paint(next);
      hint.textContent = next ? `${next} star${next > 1 ? 's' : ''}` : 'no rating — required if no photo';
    });
  });

  picker.addEventListener('mouseleave', () => paint(Number(picker.dataset.value)));
}

function setStarPicker(value) {
  const picker = document.getElementById('testi-rating-picker');
  picker.dataset.value = value || 0;
  picker.querySelectorAll('button').forEach((btn) => btn.classList.toggle('active', Number(btn.dataset.star) <= value));
  picker.querySelector('.star-picker-hint').textContent = value ? `${value} star${value > 1 ? 's' : ''}` : 'no rating — required if no photo';
}

function previewTestimonialImage(e) {
  const file = e.target.files[0];
  const preview = document.getElementById('testi-image-preview');
  const placeholder = document.getElementById('testi-upload-placeholder');
  if (!file) {
    preview.style.display = 'none';
    placeholder.style.display = 'flex';
    return;
  }
  const url = URL.createObjectURL(file);
  preview.src = url;
  preview.style.display = 'block';
  placeholder.style.display = 'none';
}

async function submitTestimonial(e) {
  e.preventDefault();
  const errEl = document.getElementById('testi-form-err');
  errEl.textContent = '';

  const editId = document.getElementById('testi-edit-id').value;
  const imageFile = document.getElementById('testi-image').files[0];
  const buyerName = document.getElementById('testi-buyer').value.trim();
  const caption = document.getElementById('testi-caption').value.trim();
  const adminReply = document.getElementById('testi-admin-reply').value.trim();
  const status = document.getElementById('testi-status').value;
  const rating = Number(document.getElementById('testi-rating-picker').dataset.value) || 0;
  const hasExistingImage = document.getElementById('testi-image-preview').style.display === 'block' && !imageFile;

  if (!imageFile && !hasExistingImage && !rating) {
    errEl.textContent = 'Add a photo, or pick a star rating, for this testimonial.';
    return;
  }

  const formData = new FormData();
  if (imageFile) formData.append('image', imageFile);
  formData.append('buyerName', buyerName);
  formData.append('caption', caption);
  formData.append('adminReply', adminReply);
  formData.append('status', status);
  formData.append('rating', rating);

  const submitBtn = document.getElementById('testi-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving…';

  try {
    if (editId) {
      await apiForm(`/api/testimonials/${editId}`, 'PUT', formData);
    } else {
      await apiForm('/api/testimonials', 'POST', formData);
    }
    resetTestimonialForm();
    await loadData();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = editId ? 'Save Changes' : '+ Add Testimonial';
  }
}

function editTestimonial(id) {
  const t = state.testimonials.find((x) => x.id === id);
  if (!t) return;

  document.getElementById('testi-edit-id').value = t.id;
  document.getElementById('testi-buyer').value = t.buyerName;
  document.getElementById('testi-caption').value = t.caption;
  document.getElementById('testi-admin-reply').value = t.adminReply || '';
  document.getElementById('testi-status').value = t.status;
  setStarPicker(t.rating || 0);

  const preview = document.getElementById('testi-image-preview');
  const placeholder = document.getElementById('testi-upload-placeholder');
  if (t.imageUrl) {
    preview.src = t.imageUrl;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    preview.style.display = 'none';
    placeholder.style.display = 'flex';
  }

  document.getElementById('testi-submit-btn').textContent = 'Save Changes';
  document.getElementById('testi-cancel-btn').style.display = 'block';
  document.getElementById('testi-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelEditTestimonial() {
  resetTestimonialForm();
}

function resetTestimonialForm() {
  document.getElementById('testi-form').reset();
  document.getElementById('testi-edit-id').value = '';
  document.getElementById('testi-image-preview').style.display = 'none';
  document.getElementById('testi-upload-placeholder').style.display = 'flex';
  document.getElementById('testi-submit-btn').textContent = '+ Add Testimonial';
  document.getElementById('testi-cancel-btn').style.display = 'none';
  document.getElementById('testi-form-err').textContent = '';
  setStarPicker(0);
}

async function deleteTestimonial(id) {
  if (!confirm('Delete this testimonial? This cannot be undone.')) return;
  try {
    await apiJSON(`/api/testimonials/${id}`, 'DELETE');
    await loadData();
  } catch (err) {
    alert(err.message);
  }
}

/* ---------- bootstrap ---------- */
document.addEventListener('DOMContentLoaded', initStarPicker);
loadData();
