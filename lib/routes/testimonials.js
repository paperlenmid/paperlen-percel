/**
 * lib/routes/testimonials.js
 * The photo CMS. Files are buffered in memory by multer (Vercel
 * functions have no writable persistent disk), then handed to
 * lib/storage.js, which uploads to Vercel Blob in production or
 * writes to /uploads locally in dev.
 */

const express = require('express');
const multer = require('multer');
const { readDB, writeDB } = require('../db');
const { requireAuth } = require('../auth');
const { uploadImage, deleteImage } = require('../storage');
const asyncHandler = require('../asyncHandler');

const router = express.Router();

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, WEBP, or GIF images are allowed.'));
    }
    cb(null, true);
  },
});

router.get('/', asyncHandler(async (req, res) => {
  const db = await readDB();
  const sorted = [...db.testimonials].sort((a, b) => b.createdAt - a.createdAt);
  res.json(sorted);
}));

function parseRating(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Math.round(Number(raw));
  if (Number.isNaN(n)) return null;
  return Math.max(1, Math.min(5, n));
}

router.post('/', requireAuth, upload.single('image'), asyncHandler(async (req, res) => {
  const { buyerName, caption, status, rating, adminReply } = req.body || {};
  if (!buyerName || !caption) {
    return res.status(400).json({ error: 'Buyer name and caption are required.' });
  }

  const parsedRating = parseRating(rating);
  // A testimonial needs either a photo or a star rating to be worth showing.
  if (!req.file && !parsedRating) {
    return res.status(400).json({ error: 'Add a photo, or a star rating, for this testimonial.' });
  }

  let imageUrl = null;
  if (req.file) {
    const { url } = await uploadImage(req.file.buffer, req.file.mimetype, req.file.originalname);
    imageUrl = url;
  }

  const db = await readDB();
  const testimonial = {
    id: 't' + Date.now(),
    imageUrl,
    buyerName: String(buyerName).trim(),
    caption: String(caption).trim(),
    rating: parsedRating,
    adminReply: adminReply ? String(adminReply).trim() : null,
    status: status === 'pending' ? 'pending' : 'completed',
    createdAt: Date.now(),
  };
  db.testimonials.push(testimonial);
  await writeDB(db);
  res.status(201).json(testimonial);
}));

router.put('/:id', requireAuth, upload.single('image'), asyncHandler(async (req, res) => {
  const db = await readDB();
  const testimonial = db.testimonials.find((t) => t.id === req.params.id);
  if (!testimonial) return res.status(404).json({ error: 'Testimonial not found.' });

  const { buyerName, caption, status, rating, adminReply, removeImage } = req.body || {};
  if (buyerName) testimonial.buyerName = String(buyerName).trim();
  if (caption) testimonial.caption = String(caption).trim();
  if (status) testimonial.status = status === 'pending' ? 'pending' : 'completed';
  if (rating !== undefined) testimonial.rating = parseRating(rating);
  if (adminReply !== undefined) testimonial.adminReply = adminReply ? String(adminReply).trim() : null;

  if (req.file) {
    const { url } = await uploadImage(req.file.buffer, req.file.mimetype, req.file.originalname);
    await deleteImage(testimonial.imageUrl);
    testimonial.imageUrl = url;
  } else if (removeImage === 'true' && testimonial.imageUrl) {
    await deleteImage(testimonial.imageUrl);
    testimonial.imageUrl = null;
  }

  if (!testimonial.imageUrl && !testimonial.rating) {
    return res.status(400).json({ error: 'This testimonial needs either a photo or a star rating.' });
  }

  await writeDB(db);
  res.json(testimonial);
}));

router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const db = await readDB();
  const testimonial = db.testimonials.find((t) => t.id === req.params.id);
  if (!testimonial) return res.status(404).json({ error: 'Testimonial not found.' });

  await deleteImage(testimonial.imageUrl);
  db.testimonials = db.testimonials.filter((t) => t.id !== req.params.id);
  await writeDB(db);
  res.json({ ok: true });
}));

// Multer errors (bad file type, too large) land here instead of crashing.
router.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message });
  next();
});

module.exports = router;
