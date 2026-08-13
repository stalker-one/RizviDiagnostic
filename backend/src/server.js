require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { initDb } = require('./db');
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

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' })); // raised so base64-encoded clinic logo uploads (Settings page) aren't rejected
app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', clinic: process.env.CLINIC_NAME }));

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

// Serves the built frontend (frontend/dist, from `npm run build`) so the
// whole app — API + UI — can run as a single process on one port. This is
// what makes it possible to run the site "like a Windows application" (via
// the Electron wrapper in /electron) or on any PC with just Node.js and no
// separately hosted/live site at all. If the frontend hasn't been built yet
// (e.g. plain `npm run dev` during development, where Vite serves the UI on
// its own port instead), this block is simply skipped.
const FRONTEND_DIST = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(path.join(FRONTEND_DIST, 'index.html'))) {
  app.use(express.static(FRONTEND_DIST));
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server.' });
});

const PORT = process.env.PORT || 5000;

// Pull the latest data down from MongoDB Atlas (if configured/reachable)
// before accepting requests, then start listening either way — the app
// never waits forever on a slow/absent internet connection. Exported as a
// promise-returning function (rather than just running at require-time) so
// the Electron desktop wrapper (electron/main.js) can `await` the exact
// moment the server is actually ready before opening its window.
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

// Only auto-start when this file is run directly (`node src/server.js` /
// `npm start`) — not when it's `require()`d as a module, e.g. by the
// Electron wrapper, which calls start() itself once it's ready to.
if (require.main === module) {
  start();
}
