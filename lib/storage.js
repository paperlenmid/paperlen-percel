/**
 * lib/storage.js
 *
 * Where testimonial photos actually live:
 *
 *  - On Vercel: uploaded straight to Vercel Blob (public access) via
 *    the @vercel/blob SDK. Returns a permanent public URL.
 *
 *  - Locally (no BLOB_READ_WRITE_TOKEN set): saved to an /uploads
 *    folder on disk instead, so `npm run dev` doesn't need a Blob
 *    store configured just to test the upload flow.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const usingBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

function randomFilename(originalName) {
  const ext = path.extname(originalName || '').toLowerCase() || '.jpg';
  return crypto.randomBytes(16).toString('hex') + ext;
}

/**
 * @param {Buffer} buffer  raw file bytes (multer memoryStorage gives us this)
 * @param {string} mimetype
 * @param {string} originalName
 * @returns {Promise<{ url: string }>}
 */
async function uploadImage(buffer, mimetype, originalName) {
  const filename = randomFilename(originalName);

  if (usingBlob) {
    const { put } = require('@vercel/blob');
    const blob = await put(`testimonials/${filename}`, buffer, {
      access: 'public',
      contentType: mimetype,
      addRandomSuffix: false,
    });
    return { url: blob.url };
  }

  if (process.env.VERCEL) {
    throw new Error(
      'No Blob store connected. On Vercel, local file storage does not work in production. ' +
      'Go to your project\'s Storage tab, create a Blob store, click "Connect Project", then redeploy.'
    );
  }

  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, filename), buffer);
  return { url: `/uploads/${filename}` };
}

/**
 * Best-effort delete — used when a testimonial is removed/replaced.
 * Never throws; a failed cleanup shouldn't block the API response.
 */
async function deleteImage(url) {
  if (!url) return;

  if (usingBlob && url.includes('blob.vercel-storage.com')) {
    try {
      const { del } = require('@vercel/blob');
      await del(url);
    } catch (err) {
      console.error('[storage] failed to delete blob:', err.message);
    }
    return;
  }

  if (url.startsWith('/uploads/')) {
    const filePath = path.join(LOCAL_UPLOAD_DIR, path.basename(url));
    fs.unlink(filePath, () => {});
  }
}

module.exports = { uploadImage, deleteImage, usingBlob };
