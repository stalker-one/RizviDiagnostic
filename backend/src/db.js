const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const TABLES = [
  'users',
  'patients',
  'procedures',
  'referrals',
  'doctors',
  'invoices',
  'settings',
  'counters',
];

// Default department list, seeded into settings.departments the first time
// settings are read. From then on the admin-managed list in
// settings.departments (Settings > Departments) is the source of truth, so
// Doctors, Patients (which department/doctor saw the patient) and the
// Radiology Procedure List all stay in sync with whatever the admin has
// configured instead of drifting apart or requiring a code change.
const DEPARTMENTS = ['X-Ray', 'Ultrasound', 'CT Scan', 'MRI', 'Procedure', 'General'];

// Returns the current admin-managed department list, falling back to the
// default list on a fresh install where settings.departments isn't set yet.
function getDepartments() {
  const settings = readTable('settings');
  if (Array.isArray(settings.departments) && settings.departments.length > 0) {
    return settings.departments;
  }
  return DEPARTMENTS;
}

// Default shift window: Morning runs from 08:00 up to (not including) 14:00,
// Evening covers the rest of the day. Admin-configurable via Settings >
// Staff Access (settings.morningStartHour / settings.eveningStartHour).
const DEFAULT_MORNING_START_HOUR = 8;
const DEFAULT_EVENING_START_HOUR = 14;

function morningStartHour() {
  const settings = readTable('settings');
  const h = Number(settings.morningStartHour);
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : DEFAULT_MORNING_START_HOUR;
}

function eveningStartHour() {
  const settings = readTable('settings');
  // Falls back to the legacy `shiftSplitHour` field (from before Morning
  // start was separately configurable) so existing installs keep working.
  const legacy = Number(settings.shiftSplitHour);
  const h = Number(settings.eveningStartHour ?? (Number.isFinite(legacy) ? legacy : undefined));
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : DEFAULT_EVENING_START_HOUR;
}

// Returns 'Morning' or 'Evening' for a given ISO date string, based on the
// clinic's own local hour (Asia/Karachi) and the admin-configured shift
// window. Hours from Morning-start up to (not including) Evening-start are
// Morning; everything else (including before Morning-start) is Evening.
function clinicShift(isoDateStr) {
  if (!isoDateStr) return '';
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: CLINIC_TZ,
      hour: 'numeric',
      hour12: false,
    }).format(new Date(isoDateStr))
  );
  const start = morningStartHour();
  const end = eveningStartHour();
  return hour >= start && hour < end ? 'Morning' : 'Evening';
}

function filePath(table) {
  return path.join(DATA_DIR, `${table}.json`);
}

function ensureTable(table) {
  const fp = filePath(table);
  if (!fs.existsSync(fp)) {
    const initial = table === 'settings' ? {} : [];
    fs.writeFileSync(fp, JSON.stringify(initial, null, 2));
  }
}

TABLES.forEach(ensureTable);

// ---- Storage: local-first, with MongoDB Atlas as the live/cloud database ----
// readTable()/writeTable() stay fully synchronous (same as before) so every
// route in the app keeps working unchanged. Under the hood:
//   1. An in-memory copy of every table is the "hot" store every request
//      reads/writes — this is what makes readTable/writeTable synchronous.
//   2. Every write is also saved to backend/src/data/*.json immediately, so
//      the clinic can keep working with zero internet connection (e.g. as a
//      desktop app on a PC with no live site at all).
//   3. Every write is ALSO queued up to MongoDB Atlas (your live/cloud
//      database) in the background. If Atlas can't be reached the write is
//      simply skipped and logged — the app never blocks or fails because of
//      it, and the local JSON file always has the authoritative latest copy.
// On boot, initDb() tries to pull the freshest copy of every table down
// from Atlas first (so multiple PCs sharing one Atlas cluster stay in
// sync); if Atlas is unreachable it just keeps whatever is on local disk.
const memory = {};
TABLES.forEach((table) => {
  const raw = fs.readFileSync(filePath(table), 'utf-8');
  try {
    memory[table] = JSON.parse(raw || (table === 'settings' ? '{}' : '[]'));
  } catch (e) {
    memory[table] = table === 'settings' ? {} : [];
  }
});

function readTable(table) {
  if (memory[table] === undefined) {
    ensureTable(table);
    memory[table] = table === 'settings' ? {} : [];
  }
  return memory[table];
}

function writeTable(table, data) {
  memory[table] = data;
  fs.writeFileSync(filePath(table), JSON.stringify(data, null, 2));
  queueMongoSync(table, data);
  return data;
}

// ---- MongoDB Atlas connection (the "live database") ----
const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'rizvi_diagnostic_center';

let mongoClient = null;
let mongoDb = null;
let mongoConnectPromise = null;

function getMongoDb() {
  if (!MONGODB_URI) return Promise.resolve(null);
  if (mongoDb) return Promise.resolve(mongoDb);
  if (!mongoConnectPromise) {
    mongoClient = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    mongoConnectPromise = mongoClient
      .connect()
      .then(() => {
        mongoDb = mongoClient.db(MONGODB_DB_NAME);
        console.log(`[mongo] Connected to Atlas database "${MONGODB_DB_NAME}" — live sync enabled.`);
        return mongoDb;
      })
      .catch((err) => {
        console.warn('[mongo] Could not connect to Atlas — continuing on local files only:', err.message);
        mongoConnectPromise = null; // allow a retry on the next write/boot
        return null;
      });
  }
  return mongoConnectPromise;
}

// Ordered queue so writes to the same table are pushed to Atlas in the same
// sequence they happened locally, even though each write "returns" instantly.
let mongoQueue = Promise.resolve();
function queueMongoSync(table, data) {
  if (!MONGODB_URI) return;
  mongoQueue = mongoQueue.then(async () => {
    try {
      const db = await getMongoDb();
      if (!db) return;
      await db
        .collection('tables')
        .updateOne({ _id: table }, { $set: { data, updatedAt: new Date() } }, { upsert: true });
    } catch (err) {
      console.warn(`[mongo] Sync failed for "${table}" (kept locally, will retry on next write):`, err.message);
    }
  });
  return mongoQueue;
}

// Called once at server boot (see server.js). Pulls the latest copy of every
// table down from Atlas so this PC starts up in sync with the shared live
// database; falls back to local files silently if Atlas is unreachable
// (no internet, first-ever run before Atlas has any data, etc.). Any table
// that has local data but nothing in Atlas yet is pushed up once, so the
// very first PC to run against a brand-new Atlas cluster seeds it.
async function initDb() {
  if (!MONGODB_URI) {
    console.log('[mongo] MONGODB_URI not set — running on local file storage only.');
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
        await db.collection('tables').updateOne(
          { _id: table },
          { $set: { data: memory[table], updatedAt: new Date() } },
          { upsert: true }
        );
      }
    } catch (err) {
      console.warn(`[mongo] Could not sync table "${table}" at boot:`, err.message);
    }
  }
}

// Simple in-process lock to avoid concurrent write corruption on rapid requests
let queue = Promise.resolve();
function transaction(table, updater) {
  queue = queue.then(() => {
    const data = readTable(table);
    const result = updater(data);
    writeTable(table, data);
    return result;
  });
  return queue;
}

function nextId(counterName) {
  const counters = readTable('counters');
  const current = counters[counterName] || 0;
  const next = current + 1;
  counters[counterName] = next;
  writeTable('counters', counters);
  return next;
}

// Default 2-letter code used for each calendar month when building invoice
// numbers (Jan=JA ... Dec=DE). Admins can override any of these from
// Settings > Numbering.
const DEFAULT_INVOICE_MONTH_CODES = ['JA', 'FE', 'MR', 'AP', 'MY', 'JN', 'JL', 'AU', 'SE', 'OC', 'NO', 'DE'];

function nextInvoiceNumber() {
  const settings = readTable('settings');
  const { year, month, key } = clinicYearMonth();

  // Resets to a fresh serial every calendar month, keyed by year+month so it
  // never continues, or collides with, a previous month's numbering.
  const counters = readTable('counters');
  const counterKey = `invoice_${key}`;
  const seq = (counters[counterKey] || 0) + 1;
  counters[counterKey] = seq;
  writeTable('counters', counters);

  const prefix = settings.invoicePrefix || 'RDC';
  const codes = settings.invoiceMonthCodes || DEFAULT_INVOICE_MONTH_CODES;
  const monthCode = codes[month - 1] || DEFAULT_INVOICE_MONTH_CODES[month - 1];
  const digits = Number(settings.invoiceDigits) || 4;
  const includeYear = settings.invoiceIncludeYear !== false;
  const yearPart = includeYear ? `${year.slice(-2)}-` : '';

  // e.g. RDC-JA-26-0001 in January, RDC-FE-26-0001 in February...
  return `${prefix}-${monthCode}-${yearPart}${String(seq).padStart(digits, '0')}`;
}

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ---- Clinic-timezone-aware date helpers ----
// The server the app runs on may be set to any timezone (often UTC), but the
// clinic operates in Pakistan. All "today" / day-range logic must be computed
// against the clinic's local calendar day, not the server's, or entries
// created in the evening (Pakistan time) can silently fall into "yesterday"
// or "tomorrow" on the server and disappear from "today" filters.
const CLINIC_TZ = 'Asia/Karachi';

function clinicDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function isSameClinicDay(isoDateStr, referenceDate = new Date()) {
  if (!isoDateStr) return false;
  return clinicDateKey(new Date(isoDateStr)) === clinicDateKey(referenceDate);
}

// True if `isoDateStr` falls within the last `days` clinic-calendar-days
// (inclusive of today). Shared by the Invoices list and Radiology Reports so
// "how much history can staff see" is defined in exactly one place.
function withinLastDays(isoDateStr, days) {
  if (!days || days <= 0) return isSameClinicDay(isoDateStr);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffKey = clinicDateKey(cutoff);
  return clinicDateKey(new Date(isoDateStr)) >= cutoffKey;
}

// True if `isoDateStr` falls on the clinic-calendar-day immediately before
// `referenceDate` (defaults to today). Used by the "Yesterday" filter preset
// shared by Radiology Reports, Invoices, and Patients.
function isYesterdayClinicDay(isoDateStr, referenceDate = new Date()) {
  if (!isoDateStr) return false;
  const yesterday = new Date(referenceDate);
  yesterday.setDate(yesterday.getDate() - 1);
  return clinicDateKey(new Date(isoDateStr)) === clinicDateKey(yesterday);
}

// Inclusive from/to check against a date-only or ISO date string.
function inDateRange(isoDateStr, from, to) {
  if (!isoDateStr) return false;
  const d = new Date(isoDateStr).getTime();
  if (from && d < new Date(from).getTime()) return false;
  if (to && d > new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1) return false;
  return true;
}

// Shared "Today / Yesterday / Last 3 Days / All / custom range" filter, used
// by Radiology Reports, Invoices, and Patients so the presets behave
// identically everywhere in the app. `dateField` defaults to `createdAt`.
// Explicit `from`/`to` always take priority over a `range` preset.
function applyDateRange(list, { range, from, to, dateField = 'createdAt' } = {}) {
  if (from || to) {
    return list.filter((item) => inDateRange(item[dateField], from, to));
  }
  switch (range) {
    case 'today':
      return list.filter((item) => isSameClinicDay(item[dateField]));
    case 'yesterday':
      return list.filter((item) => isYesterdayClinicDay(item[dateField]));
    case 'last3':
      return list.filter((item) => withinLastDays(item[dateField], 3));
    case 'all':
    default:
      return list;
  }
}

// Admin-configurable "how much of today's data can staff see" limit.
// Settings > Staff Access lets the admin pick a mode:
//   'all'     - staff see every entry scoped to today (legacy/default).
//   'count'   - staff only see the most recent N entries (5/10/20/30/50/100).
//   'percent' - staff only see the most recent X% of today's entries.
// Always applied AFTER a list has already been scoped to "today" (or
// whatever range) for the staff role — never changes what admins/
// superadmins see. Sorts newest-first internally so "most recent" is well
// defined regardless of the order the caller passed the list in.
function applyStaffEntryLimit(list, settings, dateField = 'createdAt') {
  if (!Array.isArray(list) || list.length === 0) return list;
  const mode = settings.staffEntryLimitMode || 'all';
  if (mode === 'all') return list;

  const sorted = [...list].sort((a, b) => new Date(b[dateField]) - new Date(a[dateField]));

  if (mode === 'count') {
    const n = Number(settings.staffEntryLimitCount) || 20;
    return sorted.slice(0, Math.max(1, n));
  }
  if (mode === 'percent') {
    const pct = Number(settings.staffEntryLimitPercent);
    const safePct = Number.isFinite(pct) && pct > 0 && pct <= 100 ? pct : 30;
    const n = Math.max(1, Math.ceil(sorted.length * (safePct / 100)));
    return sorted.slice(0, n);
  }
  return sorted;
}

// Small metadata object the frontend uses to show a "staff view limited to
// X of Y today" banner. `totalAvailable` is the count BEFORE the limit was
// applied (i.e. everything that actually exists for today); `shown` is the
// count AFTER.
function staffLimitInfo(settings, totalAvailable, shown) {
  const mode = settings.staffEntryLimitMode || 'all';
  if (mode === 'all') return null;
  return {
    mode,
    count: settings.staffEntryLimitCount || 20,
    percent: settings.staffEntryLimitPercent || 30,
    totalAvailable,
    shown,
  };
}

// Simple page-based pagination shared across list endpoints. Returns the
// page slice plus enough metadata for the frontend to render page controls.
function paginate(list, page, pageSize) {
  const p = Math.max(1, Number(page) || 1);
  const size = Math.min(1000, Math.max(1, Number(pageSize) || 20));
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(p, totalPages);
  const start = (safePage - 1) * size;
  return {
    rows: list.slice(start, start + size),
    total,
    page: safePage,
    pageSize: size,
    totalPages,
  };
}

// year/month key in the clinic's own timezone, e.g. "2026-07" — used to key
// counters that must reset every calendar month (MR# numbering).
function clinicYearMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year').value;
  const month = parts.find((p) => p.type === 'month').value;
  return { year, month: Number(month), key: `${year}-${month}` };
}

module.exports = {
  readTable,
  writeTable,
  initDb,
  transaction,
  nextId,
  nextInvoiceNumber,
  generateId,
  CLINIC_TZ,
  clinicDateKey,
  isSameClinicDay,
  isYesterdayClinicDay,
  inDateRange,
  applyDateRange,
  applyStaffEntryLimit,
  staffLimitInfo,
  paginate,
  withinLastDays,
  clinicYearMonth,
  DEPARTMENTS,
  getDepartments,
  morningStartHour,
  eveningStartHour,
  clinicShift,
};
