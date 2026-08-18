// Vercel serverless entry point for the Express backend.
//
// The project's Vercel "Root Directory" is `frontend`, so this file lives at
// frontend/api/index.js and Vercel deploys it as a serverless function that
// answers every request routed to `/api` (see frontend/vercel.json, which
// rewrites `/api/:path*` -> `/api`). The whole repo is checked out at build
// time and `installCommand` runs `cd ../backend && npm install`, so we can
// import the real Express app that lives one level up in ../../backend. This
// is what actually puts the API online in production — without it every
// /api/* call 404s and the app can't log in or load any data.
//
// NOTE: frontend/package.json has "type": "module", so THIS file is ESM.
// The backend is CommonJS ("type": "commonjs"), so we import it with a
// default import (which resolves to its module.exports) and destructure.
// Static ESM imports also give Vercel's file tracer the most reliable signal
// to bundle the backend source + its node_modules into the function.
import serverModule from '../../backend/src/server.js';
import dbModule from '../../backend/src/db.js';

const { app } = serverModule;
const { initDb, flushMongoSync } = dbModule;

// initDb() pulls the latest copy of every table down from MongoDB Atlas into
// the in-memory store the route handlers read from. On serverless we must do
// this on cold start before serving traffic, or the first requests would run
// against empty tables (no users -> every login fails). The promise is cached
// on the module so warm invocations skip straight past it; a failure clears
// the cache so the next request can retry instead of being stuck empty.
let initPromise = null;
function ensureInit() {
  if (!initPromise) {
    initPromise = Promise.resolve(initDb()).catch((err) => {
      initPromise = null;
      console.error('[api] initDb failed:', err && err.message);
    });
  }
  return initPromise;
}

export default async function handler(req, res) {
  await ensureInit();

  // A serverless function can be frozen the instant the HTTP response is
  // flushed. writeTable() queues its MongoDB Atlas sync in the background, so
  // without this the very write a request just made (e.g. a new patient, or
  // the login `lastSignedIn` stamp) could be cut off before it reaches Atlas.
  // Flushing on 'finish' lets those queued writes complete first.
  res.on('finish', () => {
    Promise.resolve(flushMongoSync()).catch(() => {});
  });

  return app(req, res);
}
