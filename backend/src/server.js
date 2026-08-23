// Load & normalize environment (with safe fallbacks) BEFORE anything that
// reads process.env — notably ./db, which resolves the MongoDB URI at require
// time, and the auth routes, which sign JWTs with process.env.JWT_SECRET.
require('./env');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { initDb, readTable } = require('./db');
const { getFreshTable } = require('./mongo-table');
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const patientsRoutes = require('./routes/patients.routes');
const proceduresRoutes = require('./routes/procedures.routes');
const referralsRoutes = require('./routes/referrals.routes');
const doctorsRoutes = require('./routes/doctors.routes');
const invoicesRoutes = require('./routes/invoices.routes');
const reportsRoutes = require('./routes/reports.routes');
const settingsRoutes = require('./routes/settings.routes');
const siteRoutes = require('./routes/site.routes');
const syncRoutes = require('./routes/sync.routes');
const pushRoutes = require('./routes/push.routes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', clinic: process.env.CLINIC_NAME }));

// Keep the in-memory/local fallback copy synchronized with Atlas before every
// application request. Each Vercel/Electron process can have its own memory,
// so boot-time synchronization is not enough when another device changes the
// shared database. Objects are updated in place so existing readTable() users
// immediately see the fresh data without changing the synchronous DB API.
const SYNC_TABLES = ['users', 'patients', 'procedures', 'referrals', 'doctors', 'invoices', 'settings', 'counters'];
let refreshPromise = null;
let refreshAt = 0;
async function refreshRuntimeTables() {
  const now = Date.now();
  if (refreshPromise && now - refreshAt < 250) return refreshPromise;
  refreshAt = now;
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

// Change-token requests are intentionally lightweight and must not trigger the
// full table refresh themselves. A normal data request immediately following
// a changed token performs the full Atlas refresh before reading the table.
app.use('/api/sync', async (req, res, next) => {
  if (req.path === '/version') return next();
  try {
    await refreshRuntimeTables();
  } catch (err) {
    console.warn('[sync] runtime refresh failed:', err.message);
  }
  next();
});

app.use(async (req, res, next) => {
  if (req.path === '/api/health' || req.path === '/health' || req.path === '/api/sync/version') return next();
  try {
    await refreshRuntimeTables();
  } catch (err) {
    console.warn('[sync] request refresh failed:', err.message);
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
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/site', siteRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/push', pushRoutes);

const FRONTEND_DIST = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(path.join(FRONTEND_DIST, 'index.html'))) {
  app.use(express.static(FRONTEND_DIST));
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server.' });
});

const PORT = process.env.PORT || 5000;

function start() {
  return initDb().finally(
    () =>
      new Promise((resolve) => {
        app.listen(PORT, () => {
          console.log(`✔ ${process.env.CLINIC_NAME || 'Rizvi Diagnostic Center'} API running on http://localhost:${PORT}`);
          resolve();
        });
      })
  );
}

module.exports = { app, start, PORT };

if (require.main === module) {
  start();
}
