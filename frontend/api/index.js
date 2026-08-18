// Vercel Node.js entry point for the Express API.
// Keep the health endpoint dependency-free so deployment diagnostics work even
// when an optional backend/database dependency is misconfigured.
//
// IMPORTANT: Vercel's deployed filesystem (/var/task) is read-only. The
// existing backend intentionally uses synchronous JSON files as its local
// cache/fallback, so redirect ONLY those runtime data reads/writes to /tmp on
// Vercel. MongoDB remains the durable cloud store.
const fs = require('fs');
const path = require('path');

const SOURCE_DATA_DIR = path.resolve(__dirname, '../../backend/src/data');
const RUNTIME_DATA_DIR = path.join('/tmp', 'rizvi-diagnostic-data');
const useWritableRuntimeData = Boolean(process.env.VERCEL);

if (useWritableRuntimeData && !fs.existsSync(RUNTIME_DATA_DIR)) {
  fs.mkdirSync(RUNTIME_DATA_DIR, { recursive: true });
}

function runtimePath(filePath) {
  if (!useWritableRuntimeData) return filePath;
  const absolute = path.resolve(filePath);
  if (absolute === SOURCE_DATA_DIR || absolute.startsWith(`${SOURCE_DATA_DIR}${path.sep}`)) {
    const relative = path.relative(SOURCE_DATA_DIR, absolute);
    return path.join(RUNTIME_DATA_DIR, relative);
  }
  return filePath;
}

if (useWritableRuntimeData) {
  const originalExistsSync = fs.existsSync.bind(fs);
  const originalReadFileSync = fs.readFileSync.bind(fs);
  const originalWriteFileSync = fs.writeFileSync.bind(fs);
  const originalMkdirSync = fs.mkdirSync.bind(fs);

  fs.existsSync = (filePath) => {
    const runtime = runtimePath(filePath);
    if (runtime !== filePath && originalExistsSync(runtime)) return true;
    return originalExistsSync(filePath);
  };

  fs.readFileSync = (filePath, options) => {
    const runtime = runtimePath(filePath);
    if (runtime !== filePath && originalExistsSync(runtime)) {
      return originalReadFileSync(runtime, options);
    }
    return originalReadFileSync(filePath, options);
  };

  fs.writeFileSync = (filePath, data, options) => {
    const runtime = runtimePath(filePath);
    if (runtime !== filePath) {
      const parent = path.dirname(runtime);
      if (!originalExistsSync(parent)) originalMkdirSync(parent, { recursive: true });
      return originalWriteFileSync(runtime, data, options);
    }
    return originalWriteFileSync(filePath, data, options);
  };

  fs.mkdirSync = (filePath, options) => originalMkdirSync(runtimePath(filePath), options);
}

let app = null;
let db = null;
let ensureBootstrapUsers = null;
let dbReadyPromise = null;

function loadBackend() {
  if (app) return;
  // These modules are loaded lazily. This prevents a MongoDB/backend startup
  // problem from turning /api/health into FUNCTION_INVOCATION_FAILED.
  ({ app } = require('../../backend/src/server'));
  db = require('../../backend/src/db');
  ({ ensureBootstrapUsers } = require('../../backend/src/bootstrap'));
}

function ensureDbReady() {
  loadBackend();
  if (!dbReadyPromise) {
    dbReadyPromise = Promise.resolve()
      .then(async () => {
        if (typeof db.initDb === 'function') await db.initDb();
        if (typeof ensureBootstrapUsers === 'function') ensureBootstrapUsers();
        if (typeof db.flushMongoSync === 'function') await db.flushMongoSync();
      })
      .catch((err) => {
        // Atlas is intentionally non-fatal because the application has a
        // local-file fallback. Keep the function alive and log the reason.
        console.error('[vercel] database/bootstrap initialization failed:', err);
      });
  }
  return dbReadyPromise;
}

module.exports = async function handler(req, res) {
  const originalUrl = req.url || '/';
  const pathOnly = originalUrl.split('?')[0];

  // Health is deliberately independent of Express, MongoDB and local storage.
  // It proves that the Vercel Function itself is alive.
  if (pathOnly === '/api/health' || pathOnly === '/health') {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify({
      status: 'ok',
      clinic: process.env.CLINIC_NAME || 'Rizvi Diagnostic Center',
      api: 'vercel',
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  try {
    loadBackend();

    if (!originalUrl.startsWith('/api/')) {
      req.url = originalUrl === '/api' ? '/api/' : `/api${originalUrl.startsWith('/') ? originalUrl : `/${originalUrl}`}`;
    }

    await ensureDbReady();

    if (typeof app !== 'function') {
      throw new Error('Backend Express app failed to load.');
    }

    await new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      res.once('finish', done);
      res.once('close', done);
      app(req, res);
    });

    if (db && typeof db.flushMongoSync === 'function') {
      await db.flushMongoSync();
    }
  } catch (err) {
    console.error('[vercel] API handler failed:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        message: 'Internal server error.',
        error: process.env.NODE_ENV === 'production' ? undefined : String(err.message || err),
      }));
    } else if (!res.writableEnded) {
      res.end();
    }
  }
};

module.exports.config = { maxDuration: 30 };
