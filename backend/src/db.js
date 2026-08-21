const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Desktop installs live under Program Files, which is not a reliable writable
// location for application data. Electron supplies RIZVI_DATA_DIR so local
// JSON cache/database files survive updates and remain writable.
const DATA_DIR = process.env.RIZVI_DATA_DIR
  ? path.resolve(process.env.RIZVI_DATA_DIR)
  : path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const TABLES = ['users', 'patients', 'procedures', 'referrals', 'doctors', 'invoices', 'settings', 'counters'];
const DEPARTMENTS = ['X-Ray', 'Ultrasound', 'CT Scan', 'MRI', 'Procedure', 'General'];

function getDepartments() {
  const settings = readTable('settings');
  if (Array.isArray(settings.departments) && settings.departments.length > 0) return settings.departments;
  return DEPARTMENTS;
}

const DEFAULT_MORNING_START_HOUR = 8;
const DEFAULT_EVENING_START_HOUR = 14;

function morningStartHour() {
  const settings = readTable('settings');
  const h = Number(settings.morningStartHour);
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : DEFAULT_MORNING_START_HOUR;
}
function eveningStartHour() {
  const settings = readTable('settings');
  const legacy = Number(settings.shiftSplitHour);
  const h = Number(settings.eveningStartHour ?? (Number.isFinite(legacy) ? legacy : undefined));
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : DEFAULT_EVENING_START_HOUR;
}

function clinicShift(isoDateStr) {
  if (!isoDateStr) return '';
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: CLINIC_TZ, hour: 'numeric', hour12: false }).format(new Date(isoDateStr)));
  const start = morningStartHour();
  const end = eveningStartHour();
  return hour >= start && hour < end ? 'Morning' : 'Evening';
}

function filePath(table) { return path.join(DATA_DIR, `${table}.json`); }
function ensureTable(table) {
  const fp = filePath(table);
  if (!fs.existsSync(fp)) fs.writeFileSync(fp, JSON.stringify(table === 'settings' ? {} : [], null, 2));
}
TABLES.forEach(ensureTable);

const memory = {};
TABLES.forEach((table) => {
  try {
    const raw = fs.readFileSync(filePath(table), 'utf-8');
    memory[table] = JSON.parse(raw || (table === 'settings' ? '{}' : '[]'));
  } catch (_) { memory[table] = table === 'settings' ? {} : []; }
});

function readTable(table) {
  if (memory[table] === undefined) { ensureTable(table); memory[table] = table === 'settings' ? {} : []; }
  return memory[table];
}

function writeTable(table, data) {
  memory[table] = data;
  fs.writeFileSync(filePath(table), JSON.stringify(data, null, 2));
  queueMongoSync(table, data);
  return data;
}

function resolveMongoUri() {
  const candidates = [process.env.MONGODB_URI, process.env.MONGODB_URI_2, process.env.MONGODB_URI_3];
  for (const raw of candidates) {
    if (!raw) continue;
    const uri = String(raw).trim().replace(/^["']|["']$/g, '');
    if (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://')) return uri;
  }
  return '';
}

const MONGODB_URI = resolveMongoUri();
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'rizvi_diagnostic_center';
let mongoClient = null;
let mongoDb = null;
let mongoConnectPromise = null;

function getMongoDb() {
  if (!MONGODB_URI) return Promise.resolve(null);
  if (mongoDb) return Promise.resolve(mongoDb);
  if (!mongoConnectPromise) {
    mongoClient = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 10000, socketTimeoutMS: 30000, maxPoolSize: 10, minPoolSize: 0, retryWrites: true });
    mongoConnectPromise = mongoClient.connect().then(() => {
      mongoDb = mongoClient.db(MONGODB_DB_NAME);
      console.log(`[mongo] Connected to Atlas database "${MONGODB_DB_NAME}" — live sync enabled.`);
      return mongoDb;
    }).catch((err) => {
      console.warn('[mongo] Could not connect to Atlas — continuing on local files only:', err.message);
      mongoConnectPromise = null;
      return null;
    });
  }
  return mongoConnectPromise;
}

let mongoQueue = Promise.resolve();
function queueMongoSync(table, data) {
  if (!MONGODB_URI) return;
  mongoQueue = mongoQueue.then(async () => {
    try {
      const db = await getMongoDb();
      if (!db) return;
      await db.collection('tables').updateOne({ _id: table }, { $set: { data, updatedAt: new Date() } }, { upsert: true });
    } catch (err) { console.warn(`[mongo] Sync failed for "${table}" (kept locally, will retry on next write):`, err.message); }
  });
  return mongoQueue;
}
function flushMongoSync() { return mongoQueue; }

async function initDb() {
  if (!MONGODB_URI) {
    console.warn('[mongo] MONGODB_URI is not configured — desktop is running on its persistent local database cache only.');
    return;
  }
  const db = await getMongoDb();
  if (!db) return;
  for (const table of TABLES) {
    try {
      const doc = await db.collection('tables').findOne({ _id: table });
      const localHasData = Array.isArray(memory[table]) ? memory[table].length > 0 : Object.keys(memory[table] || {}).length > 0;
      if (doc && doc.data !== undefined) {
        memory[table] = doc.data;
        fs.writeFileSync(filePath(table), JSON.stringify(doc.data, null, 2));
      } else if (localHasData) {
        await db.collection('tables').updateOne({ _id: table }, { $set: { data: memory[table], updatedAt: new Date() } }, { upsert: true });
      }
    } catch (err) { console.warn(`[mongo] Could not sync table "${table}" at boot:`, err.message); }
  }
}

let queue = Promise.resolve();
function transaction(table, updater) {
  queue = queue.then(() => { const data = readTable(table); const result = updater(data); writeTable(table, data); return result; });
  return queue;
}

function nextId(counterName) {
  const counters = readTable('counters');
  const current = Number(counters[counterName] || 0) + 1;
  counters[counterName] = current;
  writeTable('counters', counters);
  return current;
}

// Export the full public DB API used by the existing route modules.
module.exports = {
  DATA_DIR,
  TABLES,
  DEPARTMENTS,
  getDepartments,
  morningStartHour,
  eveningStartHour,
  clinicShift,
  readTable,
  writeTable,
  initDb,
  flushMongoSync,
  transaction,
  nextId,
  getMongoDb,
};
