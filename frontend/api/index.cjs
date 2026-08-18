// Vercel Node.js entry point for the Express API.
// Keep this adapter deliberately small: Vercel owns the HTTP lifecycle and
// Express owns routing/authentication/business logic.
const { app } = require('../../backend/src/server');
const db = require('../../backend/src/db');
const { ensureBootstrapUsers } = require('../../backend/src/bootstrap');

let dbReadyPromise;

function ensureDbReady() {
  if (!dbReadyPromise) {
    dbReadyPromise = Promise.resolve()
      .then(async () => {
        if (typeof db.initDb === 'function') {
          await db.initDb();
        }
        ensureBootstrapUsers();
        if (typeof db.flushMongoSync === 'function') {
          await db.flushMongoSync();
        }
      })
      .catch((err) => {
        // Atlas is intentionally non-fatal because the application has a
        // local-file fallback. Keep the function alive and log the real
        // reason so Vercel Runtime Logs can diagnose configuration issues.
        console.error('[vercel] database/bootstrap initialization failed:', err);
      });
  }
  return dbReadyPromise;
}

module.exports = async function handler(req, res) {
  try {
    // Vercel routing normally preserves the path, but some routing setups can
    // hand a function a path without the /api prefix. Normalize it here so
    // Express always sees the same paths in local, preview and production.
    const originalUrl = req.url || '/';
    if (!originalUrl.startsWith('/api/')) {
      req.url = originalUrl === '/api' ? '/api/' : `/api${originalUrl.startsWith('/') ? originalUrl : `/${originalUrl}`}`;
    }

    // Health must remain useful even when Atlas is temporarily unavailable.
    // It still initializes the database in the background for subsequent API
    // requests, but does not make a simple health check wait for Atlas.
    const healthPath = (req.url || '').split('?')[0];
    if (healthPath === '/api/health') {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        status: 'ok',
        clinic: process.env.CLINIC_NAME || 'Rizvi Diagnostic Center',
        databaseConfigured: Boolean(
          process.env.MONGODB_URI || process.env.MONGODB_URI_2 || process.env.MONGODB_URI_3
        ),
      }));
      void ensureDbReady();
      return;
    }

    await ensureDbReady();

    if (typeof app !== 'function') {
      throw new Error('Backend Express app failed to load.');
    }

    await new Promise((resolve, reject) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const failed = (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      };

      res.once('finish', done);
      res.once('close', done);
      app(req, res);

      // Express normally handles synchronous errors through its own error
      // middleware. This catches the rare adapter-level synchronous throw.
      if (res.destroyed) failed(new Error('Response was destroyed before Express completed.'));
    });

    if (typeof db.flushMongoSync === 'function') {
      await db.flushMongoSync();
    }
  } catch (err) {
    console.error('[vercel] API handler failed:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        message: 'Internal server error.',
      }));
    } else if (!res.writableEnded) {
      res.end();
    }
  }
};

// MongoDB-backed API calls can legitimately need more than Vercel's short
// default duration while Atlas establishes a connection. Keep this explicit
// and within normal Vercel limits; health checks remain immediate.
module.exports.config = {
  maxDuration: 30,
};
