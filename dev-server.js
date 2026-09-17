/**
 * dev-server.js
 * Only used for local development (`npm run dev`). Vercel itself
 * never runs this file — in production, api/[...all].js handles API
 * requests and Vercel's static file server handles everything else
 * automatically. This file exists purely so you can test the whole
 * app on your own machine before deploying, without needing the
 * Vercel CLI.
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const apiApp = require('./lib/app');
const { usingRedis } = require('./lib/db');
const { usingBlob } = require('./lib/storage');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(apiApp); // everything under /api/* and /uploads/*
app.use(express.static(path.join(__dirname))); // index.html, css/, js/

app.listen(PORT, () => {
  console.log(`Alen Asteris (dev) running at http://localhost:${PORT}`);
  console.log(`  data store : ${usingRedis ? 'Upstash Redis' : 'local file (data/db.json)'}`);
  console.log(`  photo store: ${usingBlob ? 'Vercel Blob' : 'local folder (uploads/)'}`);
  if (!process.env.JWT_SECRET) {
    console.log('  ⚠ JWT_SECRET is not set — logging in will fail until you set it in .env');
  }
});
