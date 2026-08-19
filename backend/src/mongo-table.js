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

  client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
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

/**
 * Read the latest copy of one logical table from Atlas.
 * Vercel can run multiple warm serverless instances, so an in-memory JSON
 * cache can otherwise be stale immediately after another instance writes.
 */
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

module.exports = { getFreshTable };
