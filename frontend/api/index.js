// Vercel Node.js entry point for the Express API.
const { app } = require('../../backend/src/server');
const db = require('../../backend/src/db');
const { ensureBootstrapUsers } = require('../../backend/src/bootstrap');

let dbReadyPromise;

function ensureDbReady() {
  if (!dbReadyPromise) {
    dbReadyPromise = Promise.resolve()
      .then(async () => {
        if (typeof db.initDb === 'function') await db.initDb();
        ensureBootstrapUsers();
        if (typeof db.flushMongoSync === 'function') await db.flushMongoSync();
      })
      .catch((err) => {
        console.error('[vercel] database/bootstrap initialization failed:', err);
      });
  }
  return dbReadyPromise;
}

module.exports = async function handler(req, res) {
  try {
    const originalUrl = req.url || '/';
    if (!originalUrl.startsWith('/api/')) {
      req.url = originalUrl === '/api' ? '/api/' : `/api${originalUrl.startsWith('/') ? originalUrl : `/${originalUrl}`}`;
    }

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

    if (typeof app !== 'function') throw new Error('Backend Express app failed to load.');

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

    if (typeof db.flushMongoSync === 'function') await db.flushMongoSync();
  } catch (err) {
    console.error('[vercel] API handler failed:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ message: 'Internal server error.' }));
    } else if (!res.writableEnded) {
      res.end();
    }
  }
};

module.exports.config = { maxDuration: 30 };
