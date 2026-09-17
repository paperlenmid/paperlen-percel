/**
 * public.js
 * Powers index.html only: the Trust Page and Procedure page. No login,
 * no admin data — just two public, read-only endpoints (/api/stats and
 * /api/testimonials). The dashboard has its own separate bundle
 * (js/dashboard.js) loaded only on /dashboard, so this file — and the
 * page that loads it — never even mentions how to log in.
 */

let state = {
  stats: {},
  testimonials: [],
};

/* ---------- data loading ---------- */
async function loadData() {
  const [stats, testimonials] = await Promise.all([
    fetch('/api/stats').then((r) => r.json()),
    fetch('/api/testimonials').then((r) => r.json()),
  ]);
  state.stats = stats;
  state.testimonials = testimonials;
  renderStatsCards();
  renderPublicTestimonials();
}

/* ---------- render: hero stat cards ---------- */
function renderStatsCards() {
  const s = state.stats || {};
  const n = (v) => Number(v || 0).toLocaleString('en-US');

  document.getElementById('stats-cards').innerHTML = `
    <div class="stat-highlight">
      <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></svg></div>
      <div class="stat-big-num">${n(s.successfulTransactions)}</div>
      <div class="stat-big-label">Successful Transactions</div>
    </div>
    <div class="stats-secondary-row">
      <div class="stat-secondary">
        <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.8 1.4 6.8L12 17.3l-6.1 3.4 1.4-6.8-5.1-4.8 6.9-.8z"/></svg></div>
        <div class="stat-big-num">${s.satisfactionRate || 0}%</div>
        <div class="stat-big-label">Satisfaction Rate</div>
      </div>
      <div class="stat-secondary">
        <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l7 4v6c0 5-3.4 8.5-7 10-3.6-1.5-7-5-7-10V6l7-4z"/></svg></div>
        <div class="stat-big-num">${s.yearsTrusted || 0}+</div>
        <div class="stat-big-label">Years Trusted</div>
      </div>
    </div>
    <div class="stats-grid-2x2">
      <div class="stat-mini"><div class="stat-mini-num">${n(s.midmanDeals)}</div><div class="stat-mini-label">Midman Deals</div></div>
      <div class="stat-mini"><div class="stat-mini-num">${n(s.boostingCompleted)}</div><div class="stat-mini-label">Boosting Completed</div></div>
      <div class="stat-mini"><div class="stat-mini-num">${n(s.accountsSold)}</div><div class="stat-mini-label">Accounts Sold</div></div>
      <div class="stat-mini"><div class="stat-mini-num">${n(s.topupSocial)}</div><div class="stat-mini-label">Top-Up &amp; Social</div></div>
    </div>
  `;
}

/* ---------- render: testimonials (photo card or star-review card) ---------- */
function renderPublicTestimonials() {
  const grid = document.getElementById('testi-grid');
  if (!state.testimonials.length) {
    grid.innerHTML = `
      <div class="testi-empty">
        No testimonials yet — check back soon.
      </div>`;
    return;
  }
  grid.innerHTML = state.testimonials.map(renderTestimonialCard).join('');
}

function renderTestimonialCard(t) {
  const statusBadge = `<span class="status-pill status-${t.status}">${t.status === 'completed' ? 'Completed' : 'Pending'}</span>`;

  if (t.imageUrl) {
    return `
    <div class="testi-photo-card">
      <img src="${t.imageUrl}" alt="Testimonial from ${escapeHTML(t.buyerName)}" loading="lazy">
      <div class="testi-photo-body">
        <div class="testi-photo-name">~ ${escapeHTML(t.buyerName)}</div>
        <div class="testi-photo-caption">${escapeHTML(t.caption)}</div>
        ${statusBadge}
      </div>
    </div>`;
  }

  const stars = '★'.repeat(t.rating || 0) + '☆'.repeat(5 - (t.rating || 0));
  const reply = t.adminReply
    ? `<div class="review-reply">
         <div class="review-reply-label">Reply from Alen Asteris</div>
         <div class="review-reply-text">${escapeHTML(t.adminReply)}</div>
       </div>`
    : '';

  return `
    <div class="review-card">
      <div class="review-head">
        <div class="review-avatar">${escapeHTML(t.buyerName.charAt(0).toUpperCase())}</div>
        <div>
          <div class="review-name">${escapeHTML(t.buyerName)}</div>
          <div class="review-stars">${stars}</div>
        </div>
      </div>
      <div class="review-text">${escapeHTML(t.caption)}</div>
      ${reply}
      ${statusBadge}
    </div>`;
}

/* ---------- tab switching (Trust Page / Procedure only) ---------- */
function showView(v) {
  document.getElementById('trust-view').style.display = v === 'trust' ? 'block' : 'none';
  document.getElementById('prosedur-view').style.display = v === 'prosedur' ? 'block' : 'none';
  document.getElementById('tab-trust').classList.toggle('active', v === 'trust');
  document.getElementById('tab-prosedur').classList.toggle('active', v === 'prosedur');
  window.scrollTo({ top: 0 });
}

/* ---------- tiny safety helper ---------- */
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

/* ---------- bootstrap ---------- */
document.getElementById('prosedur-view').style.display = 'none';
loadData();
