/**
 * api/[...all].js
 * Vercel's file-based routing treats this catch-all filename as the
 * handler for every request under /api/*, without needing a
 * vercel.json rewrite. Express apps are callable as (req, res), which
 * is exactly the signature Vercel's Node.js runtime invokes — so we
 * can export the app directly.
 */

require('dotenv').config();

module.exports = require('../lib/app');
