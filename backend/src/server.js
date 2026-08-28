// Load & normalize environment before anything that reads process.env.
require('./env');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { initDb, readTable } = require('./db');
const { getFreshTable, getLatestVersion } = require('./mongo-table');
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const patientsRoutes = require('./routes/patients.routes');
const proceduresRoutes = require('./routes/procedures.routes');
const referralsRoutes = require('./routes/referrals.routes');
const doctorsRoutes = require('./routes/doctors.routes');
const invoicesRoutes = require('./routes/invoices.routes');
const closingRoutes = require('./routes/closing.routes');
const reportsRoutes = require('./routes/reports.routes');
const settingsRoutes = require('./routes/settings.routes');
const siteRoutes = require('./routes/site.routes');
const syncRoutes = require('./routes/sync.routes');
const pushRoutes = require('./routes/push.routes');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
// Morgan is useful during development but is synchronous console I/O on every
// request. Keep production API requests free of that logging overhead.
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', clinic: process.env.CLINIC_NAME }));

// Atlas is the shared source of truth, while route handlers intentionally use
// the synchronous in-memory tables for very fast reads. The old implementation
// downloaded ALL tables from Atlas before EVERY API request. A dashboard load
// could therefore perform 4 requests x 8 table reads before rendering.
//
// Instead, requests only start a non-blocking refresh when the shared change
// token has changed. The current request is never held up by synchronization.
const SYNC_TABLES = ['users', 'patients', 'procedures', 'referrals', 'doctors', 'invoices', 'settings', 'counters'];
let refreshPromise = null;
let knownVersion = 0;
let versionCheckPromise = null;
let lastVersionCheckAt = 0;
const VERSION_CHECK_INTERVAL_MS = 2000;

async function refreshRuntimeTables() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = Promise.all(SYNC_TABLES.map(async (table) => {
    try {
      const fresh = await getFreshTable(table, null);
      if (fresh === null || fresh === undefined) return;
      const local = readTable(table);
      if (Array.isArray(local) && Array.isArray(fresh)) {
        local.splice(0, local.length, ...fresh);
      } else if (local && typeof local === 'object' && fresh && typeof fresh === 'object') {
        Object.keys(local).forEach((key) => delete local[key]);
        Object.assign(local, fresh);
      }
    } catch (err) {
      console.warn(`[sync] Could not refresh ${table}:`, err.message);
    }
  })).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

function scheduleRuntimeRefresh() {
  const now = Date.now();
  if (versionCheckPromise || now - lastVersionCheckAt < VERSION_CHECK_INTERVAL_MS) return;
  lastVersionCheckAt = now;
  versionCheckPromise = getLatestVersion()
    .then((version) => {
      const nextVersion = Number(version || 0);
      if (nextVersion > 0 && nextVersion !== knownVersion) {
        knownVersion = nextVersion;
        return refreshRuntimeTables();
      }
      if (knownVersion === 0 && nextVersion > 0) knownVersion = nextVersion;
      return null;
    })
    .catch((err) => console.warn('[sync] background version check failed:', err.message))
    .finally(() => { versionCheckPromise = null; });
}

// Do not await this middleware. It only schedules an occasional lightweight
// version check, so CRUD/report responses can reach the UI immediately.
app.use((req, res, next) => {
  if (req.path !== '/api/health' && req.path !== '/health' && !req.path.startsWith('/api/sync/version')) {
    scheduleRuntimeRefresh();
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/procedures', proceduresRoutes);
app.use('/api/referrals', referralsRoutes);
app.use('/api/doctors', doctorsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/closing', closingRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/site', siteRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/push', pushRoutes);

const FRONTEND_DIST = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(path.join(FRONTEND_DIST, 'index.html'))) {
  app.use(express.static(FRONTEND_DIST, {
    etag: true,
    lastModified: true,
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  }));
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'), {
      maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
    });
  });
}

app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server.' });
});

const PORT = process.env.PORT || 5000;

function start() {
  return initDb().finally(() => new Promise((resolve) => {
    // Prime the version asynchronously after boot. It does not delay opening
    // the server or the Electron window.
    scheduleRuntimeRefresh();
    app.listen(PORT, () => {
      console.log(`✔ ${process.env.CLINIC_NAME || 'Rizvi Diagnostic Center'} API running on http://localhost:${PORT}`);
      resolve();
    });
  }));
}

module.exports = { app, start, PORT };

if (require.main === module) start();
