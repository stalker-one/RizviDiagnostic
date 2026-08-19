const express = require('express');
const { MongoClient } = require('mongodb');

const router = express.Router();

function resolveMongoUri() {
  const candidates = [process.env.MONGODB_URI, process.env.MONGODB_URI_2, process.env.MONGODB_URI_3];
  for (const raw of candidates) {
    if (!raw) continue;
    const uri = String(raw).trim().replace(/^["']|["']$/g, '');
    if (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://')) return uri;
  }
  return '';
}

let client = null;
let db = null;
let connectPromise = null;

async function getDb() {
  if (db) return db;
  if (connectPromise) return connectPromise;
  const uri = resolveMongoUri();
  if (!uri) return null;
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  connectPromise = client.connect()
    .then(() => {
      db = client.db(process.env.MONGODB_DB_NAME || 'rizvi_diagnostic_center');
      return db;
    })
    .catch((err) => {
      console.warn('[sync] Atlas version check unavailable:', err.message);
      connectPromise = null;
      return null;
    });
  return connectPromise;
}

// Lightweight cross-device change token. It never exposes application data;
// clients only learn that something changed in the shared Atlas database.
router.get('/version', async (req, res) => {
  try {
    const database = await getDb();
    if (!database) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      return res.json({ version: 0 });
    }

    const rows = await database.collection('tables')
      .find({}, { projection: { _id: 1, updatedAt: 1 } })
      .toArray();

    let latest = 0;
    for (const row of rows) {
      const time = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
      if (Number.isFinite(time) && time > latest) latest = time;
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.json({ version: latest });
  } catch (err) {
    console.error('[sync] version check failed:', err.message);
    res.set('Cache-Control', 'no-store');
    res.json({ version: 0 });
  }
});

module.exports = router;
