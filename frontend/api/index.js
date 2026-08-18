// Vercel serverless entry point.
// The Vercel project Root Directory is `frontend`, so this file is deployed
// as the /api serverless function and receives all /api/* requests.
const serverModule = require('../../backend/src/server');
const dbModule = require('../../backend/src/db');

const app = serverModule.app;
let dbReady = null;

function ensureDbReady() {
  if (!dbReady) {
    dbReady = typeof dbModule.initDb === 'function'
      ? dbModule.initDb().catch((err) => {
          console.warn('[vercel] initDb() failed:', err.message);
        })
      : Promise.resolve();
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
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    res.once('finish', done);
    res.once('close', done);
    app(req, res);
  });

  if (typeof dbModule.flushMongoSync === 'function') {
    await dbModule.flushMongoSync();
  }
};
