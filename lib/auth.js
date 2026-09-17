/**
 * lib/auth.js
 *
 * Serverless functions don't share memory between invocations, so the
 * old express-session (backed by in-memory MemoryStore) can't work
 * here reliably — a login on one instance wouldn't be recognized by
 * another. Instead: a signed JWT stored in an httpOnly cookie. Each
 * request verifies the token itself; there's nothing to look up on
 * the server, which is exactly what serverless wants.
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookie = require('cookie');
const { readDB, writeDB } = require('./db');

const COOKIE_NAME = 'asteris_token';
const TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8 hours

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Deliberately NOT falling back to a random secret: with many
    // serverless instances running concurrently, each would mint a
    // different fallback secret and logins would randomly fail to
    // verify. Better to fail loudly and force it to be configured.
    throw new Error(
      'JWT_SECRET is not set. Add it to your .env (local) or your Vercel project\'s Environment Variables (production) before logging in.'
    );
  }
  return secret;
}

function setAuthCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    cookie.serialize(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: TOKEN_TTL_SECONDS,
    })
  );
}

function clearAuthCookie(res) {
  res.setHeader(
    'Set-Cookie',
    cookie.serialize(COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
  );
}

function readTokenFromRequest(req) {
  const header = req.headers.cookie;
  if (!header) return null;
  const parsed = cookie.parse(header);
  return parsed[COOKIE_NAME] || null;
}

async function login(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const db = await readDB();
  const admin = db.admin;

  if (username !== admin.username || !bcrypt.compareSync(password, admin.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = jwt.sign({ username: admin.username, isAdmin: true }, getSecret(), {
    expiresIn: TOKEN_TTL_SECONDS,
  });
  setAuthCookie(res, token);
  res.json({ ok: true, username: admin.username });
}

function logout(req, res) {
  clearAuthCookie(res);
  res.json({ ok: true });
}

function sessionStatus(req, res) {
  const token = readTokenFromRequest(req);
  if (!token) return res.json({ loggedIn: false });

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Surface this clearly instead of quietly reporting "not logged
    // in" — that would make a misconfigured server look like a normal
    // logged-out state, hiding the real problem from whoever's debugging.
    return res.status(500).json({
      error: 'JWT_SECRET is not set on the server. Add it in your Vercel project\'s Environment Variables (or .env locally), then redeploy/restart.',
    });
  }

  try {
    const payload = jwt.verify(token, secret);
    res.json({ loggedIn: !!payload.isAdmin, username: payload.username });
  } catch (err) {
    res.json({ loggedIn: false });
  }
}

function requireAuth(req, res, next) {
  const token = readTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'Not logged in.' });

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({
      error: 'JWT_SECRET is not set on the server. Add it in your Vercel project\'s Environment Variables (or .env locally), then redeploy/restart.',
    });
  }

  try {
    const payload = jwt.verify(token, secret);
    if (!payload.isAdmin) throw new Error('not admin');
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Session expired or invalid — please log in again.' });
  }
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }

  const db = await readDB();
  if (!bcrypt.compareSync(currentPassword, db.admin.passwordHash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  db.admin.passwordHash = bcrypt.hashSync(newPassword, 10);
  await writeDB(db);
  res.json({ ok: true });
}

module.exports = { login, logout, sessionStatus, requireAuth, changePassword };
