const { MongoClient } = require('mongodb');

let client = null;
let db = null;
let connectPromise = null;

function resolveMongoUri() {
  const candidates = [process.env.MONGODB_URI, process.env.MONGODB_URI_2, process.env.MONGODB_URI_3];
  for (const raw of candidates) {
    if (!raw) continue;
    const uri = String(raw).trim().replace(/^["']|["']$/g, '');
    if (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://')) return uri;
  }
  return '';
}

async function getDb() {
  if (db) return db;
  if (connectPromise) return connectPromise;
  const uri = resolveMongoUri();
  if (!uri) return null;
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 8000, maxPoolSize: 10, minPoolSize: 0, retryWrites: true });
  connectPromise = client.connect()
    .then(() => {
      db = client.db(process.env.MONGODB_DB_NAME || 'rizvi_diagnostic_center');
      return db;
    })
    .catch((err) => {
      console.warn('[mongo-table] Atlas refresh unavailable:', err.message);
      connectPromise = null;
      return null;
    });
  return connectPromise;
}

async function getLatestVersion() {
  try {
    const database = await getDb();
    if (!database) return 0;
    const row = await database.collection('tables')
      .find({}, { projection: { updatedAt: 1 } })
      .sort({ updatedAt: -1 })
      .limit(1)
      .next();
    const value = row?.updatedAt ? new Date(row.updatedAt).getTime() : 0;
    return Number.isFinite(value) ? value : 0;
  } catch (err) {
    console.warn('[mongo-table] Could not read latest Atlas version:', err.message);
    return 0;
  }
}

async function getFreshTable(table, fallback) {
  try {
    const database = await getDb();
    if (!database) return fallback;
    const doc = await database.collection('tables').findOne({ _id: table });
    if (doc && doc.data !== undefined) return doc.data;
  } catch (err) {
    console.warn(`[mongo-table] Could not refresh "${table}":`, err.message);
  }
  return fallback;
}

module.exports = { getFreshTable, getLatestVersion };
