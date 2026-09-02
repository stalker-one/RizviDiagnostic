const express = require('express');
const { authenticate } = require('../middleware/auth');
const { readTable } = require('../db');
const { getLatestVersion, getFreshTable, watchTableChanges } = require('../mongo-table');
const { INSTANCE_ID, publishDataChange, subscribe, subscriberCount } = require('../realtime');

const router = express.Router();
const REFRESHABLE_TABLES = new Set(['users', 'patients', 'procedures', 'referrals', 'doctors', 'invoices', 'settings', 'counters', 'biometricSessions', 'pushTokens']);
let mongoBridgeStarted = false;
let refreshQueue = Promise.resolve();

function replaceLocalTable(table, fresh) {
  if (fresh === null || fresh === undefined) return false;
  const local = readTable(table);
  if (Array.isArray(local) && Array.isArray(fresh)) {
    local.splice(0, local.length, ...fresh);
    return true;
  }
  if (local && typeof local === 'object' && fresh && typeof fresh === 'object') {
    Object.keys(local).forEach((key) => delete local[key]);
    Object.assign(local, fresh);
    return true;
  }
  return false;
}

function startMongoRealtimeBridge() {
  if (mongoBridgeStarted) return;
  mongoBridgeStarted = true;
  watchTableChanges(async (change) => {
    const table = String(change.table || '');
    if (!REFRESHABLE_TABLES.has(table) || change.sourceInstanceId === INSTANCE_ID) return;

    // Serialize remote table replacements so a burst of writes cannot expose
    // partially applied snapshots to a request or emit stale refresh events.
    refreshQueue = refreshQueue.then(async () => {
      const fresh = await getFreshTable(table, null);
      if (!replaceLocalTable(table, fresh)) return;
      publishDataChange(table, {
        sourceInstanceId: change.sourceInstanceId || null,
        remote: true,
        version: change.version,
        at: change.at,
      });
    }).catch((err) => console.warn(`[sync] Could not apply remote ${table} change:`, err.message));
    return refreshQueue;
  });
}

router.get('/version', async (req, res) => {
  try {
    const version = await getLatestVersion();
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.json({ version });
  } catch (err) {
    console.error('[sync] version check failed:', err.message);
    res.set('Cache-Control', 'no-store');
    res.json({ version: 0 });
  }
});

router.get('/events', authenticate, (req, res) => {
  startMongoRealtimeBridge();
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const send = (payload, eventName = 'data.changed') => {
    if (res.writableEnded || res.destroyed) return;
    res.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
  };
  const unsubscribe = subscribe((event) => send(event));
  const heartbeat = setInterval(() => {
    if (res.writableEnded || res.destroyed) return;
    res.write(`: heartbeat ${Date.now()} subscribers=${subscriberCount()}\n\n`);
  }, 15000);
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    clearInterval(heartbeat);
    unsubscribe();
  };
  req.on('close', cleanup);
  res.on('error', cleanup);
  send({ type: 'ready', instanceId: INSTANCE_ID, at: new Date().toISOString() }, 'ready');
});

module.exports = router;
