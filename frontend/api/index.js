// Vercel serverless adapter for the Express API.
const serverModule = require('../../backend/src/server');
const dbModule = require('../../backend/src/db');

const app = serverModule.app;
let dbReady;

function ensureDbReady() {
  if (!dbReady) {
    dbReady = typeof dbModule.initDb === 'function'
      ? dbModule.initDb().catch((err) => {
          console.error('[vercel] MongoDB initialization failed:', err.message);
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
    try {
      await dbModule.flushMongoSync();
    } catch (err) {
      console.error('[vercel] MongoDB sync flush failed:', err.message);
    }
  }
};
