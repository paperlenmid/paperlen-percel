/**
 * lib/app.js
 * The Express app itself — no app.listen() here. This same app is:
 *   - wrapped by api/[...all].js for Vercel's serverless runtime
 *   - wrapped by dev-server.js for local `npm run dev`
 */

const path = require('path');
const express = require('express');

const authModule = require('./auth');
const asyncHandler = require('./asyncHandler');
const dealsRoutes = require('./routes/deals');
const staffRoutes = require('./routes/staff');
const testimonialsRoutes = require('./routes/testimonials');
const statsRoutes = require('./routes/stats');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth
app.post('/api/login', asyncHandler(authModule.login));
app.post('/api/logout', asyncHandler(authModule.logout));
app.get('/api/session', asyncHandler(authModule.sessionStatus));
app.post('/api/change-password', authModule.requireAuth, asyncHandler(authModule.changePassword));

// Data
app.use('/api/deals', dealsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/testimonials', testimonialsRoutes);
app.use('/api/stats', statsRoutes);

// Locally-stored uploads (only relevant when running without a Blob
// store configured — see lib/storage.js). Harmless no-op on Vercel.
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Catches anything thrown/rejected inside an asyncHandler-wrapped
// route (missing JWT_SECRET, no Redis connected, a Blob upload
// failure, etc). Without this, those errors would just crash the
// function with no useful message — this turns them into a normal
// JSON response the frontend already knows how to display.
app.use((err, req, res, next) => {
  console.error('[api error]', err);
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

module.exports = app;
