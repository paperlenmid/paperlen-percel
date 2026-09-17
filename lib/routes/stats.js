/**
 * lib/routes/stats.js
 * The big trust numbers on the hero ("12,376 Successful Transactions",
 * satisfaction rate, years trusted, and the 4 category counters).
 * These are admin-editable brand numbers, not strictly computed from
 * the deals list — real shops usually report bigger lifetime totals
 * than what's individually logged.
 */

const express = require('express');
const { readDB, writeDB } = require('../db');
const { requireAuth } = require('../auth');
const asyncHandler = require('../asyncHandler');

const router = express.Router();

const NUMERIC_FIELDS = [
  'successfulTransactions',
  'satisfactionRate',
  'yearsTrusted',
  'midmanDeals',
  'boostingCompleted',
  'accountsSold',
  'topupSocial',
];

router.get('/', asyncHandler(async (req, res) => {
  const db = await readDB();
  res.json(db.stats);
}));

router.put('/', requireAuth, asyncHandler(async (req, res) => {
  const db = await readDB();
  const body = req.body || {};

  NUMERIC_FIELDS.forEach((field) => {
    if (body[field] !== undefined && body[field] !== '') {
      const n = Number(body[field]);
      if (!Number.isNaN(n)) db.stats[field] = n;
    }
  });

  await writeDB(db);
  res.json(db.stats);
}));

module.exports = router;
