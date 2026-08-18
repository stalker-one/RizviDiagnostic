// Vercel serverless entry point. Wraps the same Express `app` used by the
// desktop app (backend/src/server.js) so both deployments share one set of
// routes/business logic — nothing route-related is duplicated here.
//
// Two things a normal always-running server doesn't need to worry about,
// that a serverless function does:
//
//   1. There's no long-lived boot step. `initDb()` (which pulls the latest
//      data down from MongoDB Atlas) normally runs once when the desktop
//      app's `start()` is called. Here, we run it once per cold start
//      instead — memoized, so a warm/reused function instance doesn't
//      re-fetch from Atlas on every single request.
//
//   2. The function's process can be frozen the moment the HTTP response is
//      sent. db.js queues its MongoDB Atlas sync as a background write
//      *after* responding (so requests aren't slowed down waiting on
//      Atlas) — fine for a normal server, but on Vercel that write could
//      get cut off before it finishes. So here we explicitly wait for the
//      response to finish, then await any still-in-flight sync via
//      flushMongoSync() before this handler itself resolves.
const path = require('path');
const { app } = require('../src/server');
const dbModule = require(path.join(__dirname, '..', 'src', 'db'));

let dbReady = null;
function ensureDbReady() {
  if (!dbReady) {
    if (typeof dbModule.initDb !== 'function') {
      // Something about how this got bundled/deployed isn't what we
      // expect locally — log exactly what we actually got instead of
      // crashing every single request with an opaque TypeError, and
      // continue serving requests against whatever data is already
      // bundled rather than hard-failing.
      console.error(
        '[vercel] db module did not export initDb as expected. Got keys:',
        Object.keys(dbModule || {}),
        '— typeof initDb:', typeof (dbModule && dbModule.initDb)
      );
      dbReady = Promise.resolve();
    } else {
      dbReady = dbModule.initDb().catch((err) => {
        console.warn('[vercel] initDb() failed — continuing on whatever data is bundled:', err.message);
      });
    }
  }
  return dbReady;
}

module.exports = async (req, res) => {
  await ensureDbReady();
  await new Promise((resolve) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    app(req, res);
  });
  if (typeof dbModule.flushMongoSync === 'function') {
    await dbModule.flushMongoSync();
  }
};
