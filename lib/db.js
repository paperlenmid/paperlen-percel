/**
 * lib/db.js
 *
 * Two storage backends behind one API (readDB/writeDB):
 *
 *  - On Vercel: Upstash Redis (via a "Redis" integration from the
 *    Vercel Marketplace — the free tier is plenty for this app). The
 *    whole app state (deals, staff, testimonials, stats, admin) is
 *    stored as one JSON value under a single key.
 *
 *  - Locally (no Redis env vars set): falls back to a JSON file at
 *    data/db.json, so `npm run dev` works out of the box with zero
 *    cloud setup while you're building.
 *
 * Every route file only calls readDB()/writeDB() — they never touch
 * Redis or the filesystem directly.
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const REDIS_KEY = 'alen-asteris:db';
const LOCAL_DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

// Vercel's Redis (Upstash) integration doesn't always name the env
// vars UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN — depending
// on how it was connected (or a custom variable prefix), it can show
// up as KV_REST_API_URL / KV_REST_API_TOKEN instead (the older
// Vercel KV naming). Check both pairs so a working connection isn't
// missed just because of the variable name Vercel picked.
function resolveRedisCredentials() {
  const candidates = [
    ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
    ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
  ];
  for (const [urlKey, tokenKey] of candidates) {
    const url = process.env[urlKey];
    const token = process.env[tokenKey];
    if (url && token) return { url, token };
  }
  return null;
}

const redisCredentials = resolveRedisCredentials();
const usingRedis = !!redisCredentials;

let redis = null;
if (usingRedis) {
  const { Redis } = require('@upstash/redis');
  redis = new Redis({ url: redisCredentials.url, token: redisCredentials.token });
}

/* ---------- seed data (used only when nothing is stored yet) ---------- */

const seedStaff = [
  { id: 's1', name: 'Rangga', role: 'Senior Midman', deals: 0, rating: 4.9 },
  { id: 's2', name: 'Dinda', role: 'Midman', deals: 0, rating: 4.8 },
  { id: 's3', name: 'Bima', role: 'Midman', deals: 0, rating: 4.7 },
  { id: 's4', name: 'Sekar', role: 'Junior Midman', deals: 0, rating: 4.6 },
];

const seedDeals = [
  { id: 'd1', buyer: 'kevin_ml', seller: 'toko_akunpro', item: 'Mobile Legends Mythic Immortal Account', value: 850000, status: 'completed', staff: 's1', date: '2026-08-20' },
  { id: 'd2', buyer: 'ariska99', seller: 'gacha_house', item: 'Genshin Impact Account AR58 + 12 5-star characters', value: 2100000, status: 'completed', staff: 's2', date: '2026-08-19' },
  { id: 'd3', buyer: 'zenkun', seller: 'rafi_store', item: '1200 PUBG Mobile UC', value: 280000, status: 'completed', staff: 's3', date: '2026-08-19' },
  { id: 'd4', buyer: 'lunaaa', seller: 'valo_smurf_id', item: 'Valorant Immortal Account + Reaver skin', value: 960000, status: 'process', staff: 's1', date: '2026-08-21' },
  { id: 'd5', buyer: 'dimasgg', seller: 'topupmurah_id', item: '8000 Robux', value: 190000, status: 'completed', staff: 's4', date: '2026-08-18' },
  { id: 'd6', buyer: 'wildan_x', seller: 'akunff_official', item: 'Free Fire Grandmaster Account', value: 430000, status: 'pending', staff: 's2', date: '2026-08-22' },
  { id: 'd7', buyer: 'citra.k', seller: 'sea_store88', item: '2011 Mobile Legends Diamonds', value: 520000, status: 'completed', staff: 's3', date: '2026-08-17' },
  { id: 'd8', buyer: 'ogyy', seller: 'lapak_hades', item: 'Honkai Star Rail Account AR70', value: 1750000, status: 'dispute', staff: 's1', date: '2026-08-16' },
  { id: 'd9', buyer: 'fani_rb', seller: 'gudang_akun', item: 'Roblox Account rare bundle', value: 310000, status: 'completed', staff: 's4', date: '2026-08-15' },
  { id: 'd10', buyer: 'yoga.p', seller: 'midlane_shop', item: 'Mobile Legends Epic Account full skins', value: 670000, status: 'completed', staff: 's2', date: '2026-08-14' },
];

// The homepage "stat cards" — these are editable brand/trust numbers
// from the dashboard, not strictly derived from the deals list above
// (real shops usually report bigger aggregate lifetime numbers here).
const seedStats = {
  successfulTransactions: 12376,
  satisfactionRate: 100,
  yearsTrusted: 7,
  midmanDeals: 8975,
  boostingCompleted: 503,
  accountsSold: 978,
  topupSocial: 1920,
};

function defaultAdminPasswordHash() {
  const plain = process.env.ADMIN_DEFAULT_PASSWORD || 'asteris123';
  return bcrypt.hashSync(plain, 10);
}

function seedDatabase() {
  return {
    deals: seedDeals,
    staff: seedStaff,
    testimonials: [],
    stats: seedStats,
    admin: {
      username: process.env.ADMIN_DEFAULT_USERNAME || 'admin',
      passwordHash: defaultAdminPasswordHash(),
    },
  };
}

/* ---------- local JSON fallback (dev only) ---------- */

function ensureLocalDB() {
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(seedDatabase(), null, 2));
    console.log('[db] local mode — created data/db.json with seed data.');
  }
}

function readLocalDB() {
  ensureLocalDB();
  return JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf-8'));
}

function writeLocalDB(data) {
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
}

/* ---------- public API ---------- */

// On Vercel, the deployed filesystem is read-only outside /tmp — the
// local-file fallback below would crash with a cryptic EROFS error if
// we let it try. Fail loudly and clearly instead, so the actual fix
// (connect a Redis integration) is obvious from the API response.
function assertStorageIsUsable() {
  if (process.env.VERCEL && !usingRedis) {
    throw new Error(
      'No Redis connected. On Vercel, local file storage does not work in production. ' +
      'Go to your project\'s Storage tab, create a Redis database, click "Connect Project", then redeploy.'
    );
  }
}

async function readDB() {
  assertStorageIsUsable();
  if (usingRedis) {
    const data = await redis.get(REDIS_KEY);
    if (data) return data; // @upstash/redis auto-parses JSON
    const seeded = seedDatabase();
    await redis.set(REDIS_KEY, seeded);
    console.log('[db] redis mode — seeded initial data in Upstash Redis.');
    return seeded;
  }
  return readLocalDB();
}

async function writeDB(data) {
  assertStorageIsUsable();
  if (usingRedis) {
    await redis.set(REDIS_KEY, data);
    return;
  }
  writeLocalDB(data);
}

module.exports = { readDB, writeDB, usingRedis };