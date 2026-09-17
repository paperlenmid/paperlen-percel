/**
 * lib/routes/deals.js
 * GET is public. Mutations require an admin session (JWT cookie).
 */

const express = require('express');
const { readDB, writeDB } = require('../db');
const { requireAuth } = require('../auth');
const asyncHandler = require('../asyncHandler');

const router = express.Router();

function recalcStaffDeals(db) {
  db.staff.forEach((s) => {
    s.deals = db.deals.filter((d) => d.staff === s.id && d.status === 'completed').length;
  });
}

router.get('/', asyncHandler(async (req, res) => {
  const db = await readDB();
  res.json(db.deals);
}));

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { buyer, seller, item, value, status, staff } = req.body || {};
  if (!buyer || !seller || !item || value === undefined || !status || !staff) {
    return res.status(400).json({ error: 'Missing required deal fields.' });
  }

  const db = await readDB();
  const deal = {
    id: 'd' + Date.now(),
    buyer: String(buyer).trim(),
    seller: String(seller).trim(),
    item: String(item).trim(),
    value: Number(value) || 0,
    status,
    staff,
    date: new Date().toISOString().slice(0, 10),
  };
  db.deals.push(deal);
  recalcStaffDeals(db);
  await writeDB(db);
  res.status(201).json(deal);
}));

router.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  const db = await readDB();
  const deal = db.deals.find((d) => d.id === req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found.' });

  const { status } = req.body || {};
  if (status) deal.status = status;

  recalcStaffDeals(db);
  await writeDB(db);
  res.json(deal);
}));

router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const db = await readDB();
  const before = db.deals.length;
  db.deals = db.deals.filter((d) => d.id !== req.params.id);
  if (db.deals.length === before) return res.status(404).json({ error: 'Deal not found.' });

  recalcStaffDeals(db);
  await writeDB(db);
  res.json({ ok: true });
}));

module.exports = router;
