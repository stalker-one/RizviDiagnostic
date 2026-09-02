const { MongoClient } = require('mongodb');

let client = null;
let db = null;
let connectPromise = null;
let changeStream = null;
let changeStreamRetryTimer = null;
const changeListeners = new Set();

function resolveMongoUri() {
  const candidates = [process.env.MONGODB_URI, process.env.MONGODB_URI_2, process.env.MONGODB_URI_3];
  for (const raw of candidates) {
    if (!raw) continue;
    const uri = String(raw).trim().replace(/^['"]|['"]$/g, '');
    if (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://')) return uri;
  }
  return '';
}

async function getDb() {
  if (db) return db;
  if (connectPromise) return connectPromise;
  const uri = resolveMongoUri();
  if (!uri) return null;
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 10000, maxPoolSize: 10, minPoolSize: 0, retryWrites: true });
  connectPromise = client.connect()
    .then(() => { db = client.db(process.env.MONGODB_DB_NAME || 'rizvi_diagnostic_center'); return db; })
    .catch((err) => { console.warn('[mongo-table] Atlas unavailable:', err.message); connectPromise = null; return null; });
  return connectPromise;
}

async function getLatestVersion() {
  try {
    const database = await getDb();
    if (!database) return 0;
    const row = await database.collection('tables').find({}, { projection: { updatedAt: 1 } }).sort({ updatedAt: -1 }).limit(1).next();
    const value = row?.updatedAt ? new Date(row.updatedAt).getTime() : 0;
    return Number.isFinite(value) ? value : 0;
  } catch (err) { console.warn('[mongo-table] Could not read latest Atlas version:', err.message); return 0; }
}

async function getFreshTable(table, fallback) {
  try {
    const database = await getDb();
    if (!database) return fallback;
    const doc = await database.collection('tables').findOne({ _id: table });
    if (doc && doc.data !== undefined) return doc.data;
  } catch (err) { console.warn(`[mongo-table] Could not refresh "${table}":`, err.message); }
  return fallback;
}

function scheduleChangeStreamRetry() {
  if (changeStreamRetryTimer || changeListeners.size === 0) return;
  changeStreamRetryTimer = setTimeout(() => {
    changeStreamRetryTimer = null;
    startChangeStream().catch((err) => console.warn('[mongo-table] Could not restart realtime watcher:', err.message));
  }, 5000);
}

async function startChangeStream() {
  if (changeStream || changeListeners.size === 0) return;
  if (!resolveMongoUri()) return;
  const database = await getDb();
  if (!database) {
    scheduleChangeStreamRetry();
    return;
  }

  let stream;
  try {
    stream = database.collection('tables').watch([], { fullDocument: 'updateLookup' });
  } catch (err) {
    console.warn('[mongo-table] Change streams are unavailable; version fallback remains active:', err.message);
    scheduleChangeStreamRetry();
    return;
  }

  changeStream = stream;
  const closeStream = () => {
    if (changeStream !== stream) return;
    changeStream = null;
    stream.close().catch(() => {});
    scheduleChangeStreamRetry();
  };

  stream.on('change', (change) => {
    const table = change.documentKey?._id || change.fullDocument?._id;
    if (!table) return;
    const document = change.fullDocument || {};
    const event = {
      table: String(table),
      sourceInstanceId: document.sourceInstanceId || null,
      version: document.updatedAt ? new Date(document.updatedAt).getTime() : Date.now(),
      at: document.updatedAt ? new Date(document.updatedAt).toISOString() : new Date().toISOString(),
    };
    for (const listener of [...changeListeners]) {
      Promise.resolve(listener(event)).catch((err) => console.warn('[mongo-table] Realtime listener failed:', err.message));
    }
  });
  stream.on('error', (err) => {
    console.warn('[mongo-table] Realtime watcher error:', err.message);
    closeStream();
  });
  stream.on('close', closeStream);
}

function watchTableChanges(listener) {
  if (typeof listener !== 'function') return () => {};
  changeListeners.add(listener);
  startChangeStream().catch((err) => console.warn('[mongo-table] Could not start realtime watcher:', err.message));
  return () => {
    changeListeners.delete(listener);
    if (changeListeners.size === 0 && changeStreamRetryTimer) {
      clearTimeout(changeStreamRetryTimer);
      changeStreamRetryTimer = null;
    }
  };
}

module.exports = { getDb, getFreshTable, getLatestVersion, watchTableChanges };
