/**
 * lib/routes/staff.js
 */

const express = require('express');
const { readDB, writeDB } = require('../db');
const { requireAuth } = require('../auth');
const asyncHandler = require('../asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const db = await readDB();
  res.json(db.staff);
}));

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { name, role } = req.body || {};
  if (!name || !role) return res.status(400).json({ error: 'Name and role are required.' });

  const db = await readDB();
  const staff = { id: 's' + Date.now(), name: String(name).trim(), role: String(role).trim(), deals: 0, rating: 5 };
  db.staff.push(staff);
  await writeDB(db);
  res.status(201).json(staff);
}));

router.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  const db = await readDB();
  const staff = db.staff.find((s) => s.id === req.params.id);
  if (!staff) return res.status(404).json({ error: 'Staff member not found.' });

  const { rating, role, name } = req.body || {};
  if (rating !== undefined) staff.rating = Math.max(0, Math.min(5, Number(rating) || 0));
  if (role) staff.role = role;
  if (name) staff.name = name;

  await writeDB(db);
  res.json(staff);
}));

router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const db = await readDB();
  const before = db.staff.length;
  db.staff = db.staff.filter((s) => s.id !== req.params.id);
  if (db.staff.length === before) return res.status(404).json({ error: 'Staff member not found.' });

  await writeDB(db);
  res.json({ ok: true });
}));

module.exports = router;
