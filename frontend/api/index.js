// Vercel serverless entry point — classic auto-detected location.
//
// Vercel automatically deploys any file under <Root Directory>/api/ as a
// serverless function, with zero vercel.json needed for that part. Since
// Root Directory is set to `frontend` (so Vercel's zero-config Vite preset
// can build+serve the site with correct SPA routing, which it does far
// more reliably than any hand-written rewrite rule), this file lives at
// frontend/api/index.js so it lands in exactly the spot Vercel expects.
//
// It reaches back into ../../backend for the actual Express app — nothing
// route-related is duplicated here, this is purely a thin adapter. That
// only works because "Include files outside the Root Directory in the
// Build Step" is enabled in the Vercel project settings.
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
const serverModule = require('../../backend/src/server');
const dbModule = require('../../backend/src/db');

if (typeof serverModule.app !== 'function') {
  console.error(
    '[vercel] server module did not export a callable app. Got keys:',
    Object.keys(serverModule || {}),
    '— typeof app:', typeof (serverModule && serverModule.app)
  );
}
const app = serverModule.app;

let dbReady = null;
function ensureDbReady() {
  if (!dbReady) {
    if (typeof dbModule.initDb !== 'function') {
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
  if (typeof app !== 'function') {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'Backend app failed to load. Check function logs for details.' }));
    return;
  }
  await new Promise((resolve) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    app(req, res);
  });
  if (typeof dbModule.flushMongoSync === 'function') {
    await dbModule.flushMongoSync();
  }
};
