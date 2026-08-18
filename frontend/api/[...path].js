// Vercel catch-all Node function for the Express API.
// The catch-all keeps /api/auth/login, /api/patients, etc. on their original
// request path so Express can match its /api/* routes correctly.
const { app } = require('../../backend/src/server');
const db = require('../../backend/src/db');

let dbReady;
function ensureDbReady() {
  if (!dbReady) {
    dbReady = Promise.resolve()
      .then(() => (typeof db.initDb === 'function' ? db.initDb() : undefined))
      .catch((err) => console.warn('[vercel] MongoDB init failed:', err.message));
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
