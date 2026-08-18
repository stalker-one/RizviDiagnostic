// Single CommonJS Vercel function for the Express API.
// The vercel.json route transform preserves the original /api/* request path
// before this function is invoked.
const { app } = require('../../backend/src/server');
const db = require('../../backend/src/db');
const { ensureBootstrapUsers } = require('../../backend/src/bootstrap');

let dbReady;
function ensureDbReady() {
  if (!dbReady) {
    dbReady = Promise.resolve()
      .then(async () => {
        if (typeof db.initDb === 'function') await db.initDb();
        ensureBootstrapUsers();
        if (typeof db.flushMongoSync === 'function') await db.flushMongoSync();
      })
      .catch((err) => console.warn('[vercel] MongoDB/bootstrap init failed:', err.message));
  }
  return dbReady;
}

module.exports = async (req, res) => {
  await ensureDbReady();

  if (typeof app !== 'function') {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'Backend app failed to load.' }));
    return;
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

  if (typeof db.flushMongoSync === 'function') {
    await db.flushMongoSync();
  }
};
