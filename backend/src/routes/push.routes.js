const express = require('express');
const { readTable, writeTable } = require('../db');
const { authenticate } = require('../middleware/auth');
const { sendPushToVariant, sendPushToAll, isEnabled } = require('../services/push.service');
const { getFreshTable } = require('../mongo-table');

const router = express.Router();

// Called by the Android release GitHub Actions workflows right after a new
// version is published, so the update-available notification reaches every
// device instantly instead of waiting for the next ~6-hourly background
// poll. This is CI calling the backend directly (no logged-in user
// involved), so it's protected by a shared secret header instead of the
// normal user JWT auth used by every other route here.
router.post('/notify-update', (req, res) => {
  const secret = process.env.PUSH_TRIGGER_SECRET;
  if (!secret) return res.status(503).json({ message: 'Update push notifications are not configured on this server.' });
  if (req.get('X-Push-Secret') !== secret) return res.status(401).json({ message: 'Invalid push trigger secret.' });
  const { appVariant, versionName } = req.body || {};
  if (appVariant !== 'staff' && appVariant !== 'superadmin') return res.status(400).json({ message: 'appVariant must be "staff" or "superadmin".' });
  const appLabel = appVariant === 'superadmin' ? 'Rizvi Diagnostic Center Superadmin' : 'Rizvi Diagnostic Center';
  sendPushToVariant(appVariant, `${appLabel} update available`, `Version ${versionName || ''} is ready to install.`.trim(), { type: 'update_available', versionCode: req.body?.versionCode })
    .then(() => res.json({ sent: true }))
    .catch((err) => res.status(500).json({ message: err.message }));
});

router.use(authenticate);

// Registering a token isn't itself sensitive (it can only be used to
// receive pushes, not read any data), but it still requires being logged
// in -- consistent with the rest of the API, and it keeps this endpoint
// from being usable to spam arbitrary tokens.
router.post('/register-token', (req, res) => {
  const { token, appVariant } = req.body;
  if (!token || typeof token !== 'string') return res.status(400).json({ message: 'A push token is required.' });
  const tokens = readTable('pushTokens');
  const existing = tokens.find((t) => t.token === token);
  const now = new Date().toISOString();
  if (existing) {
    existing.appVariant = appVariant || existing.appVariant || 'staff';
    existing.userId = req.user.id;
    existing.updatedAt = now;
  } else {
    tokens.push({ token, appVariant: appVariant || 'staff', userId: req.user.id, createdAt: now, updatedAt: now });
  }
  writeTable('pushTokens', tokens);
  res.json({ registered: true });
});

router.post('/unregister-token', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ message: 'A push token is required.' });
  const tokens = readTable('pushTokens').filter((t) => t.token !== token);
  writeTable('pushTokens', tokens);
  res.json({ unregistered: true });
});

// Self-serve diagnostics for tracking down "notifications aren't arriving"
// without needing device/log access -- tells you exactly which stage is
// broken: is Firebase even configured on this server, and did this specific
// account's device actually register a token.
router.get('/status', async (req, res) => {
  const allTokens = (await getFreshTable('pushTokens', readTable('pushTokens'))) || [];
  const myTokens = allTokens.filter((t) => t.userId === req.user.id);
  res.json({
    firebaseConfigured: isEnabled(),
    totalRegisteredDevices: allTokens.length,
    myRegisteredDevices: myTokens.map((t) => ({ appVariant: t.appVariant, registeredAt: t.createdAt, lastUpdated: t.updatedAt })),
  });
});

// Sends a real test push to every device registered under the logged-in
// user's own account (not everyone's), so you can immediately confirm
// whether a push actually reaches this specific phone right now, instead of
// only finding out indirectly by creating a patient/invoice.
router.post('/test-send', async (req, res) => {
  if (!isEnabled()) return res.status(503).json({ message: 'Firebase is not configured on this server (FIREBASE_SERVICE_ACCOUNT_JSON missing or invalid).' });
  const allTokens = (await getFreshTable('pushTokens', readTable('pushTokens'))) || [];
  const myTokens = allTokens.filter((t) => t.userId === req.user.id);
  if (!myTokens.length) return res.status(400).json({ message: 'No device is registered under your account yet -- open the Android app and log in first, then try again.' });
  try {
    const { getMessaging } = require('firebase-admin/messaging');
    const admin = require('firebase-admin/app');
    const app = admin.getApps()[0];
    const response = await getMessaging(app).sendEachForMulticast({
      tokens: myTokens.map((t) => t.token),
      data: { title: 'Test notification', body: 'If you see this, push delivery is working.', type: 'test' },
      notification: { title: 'Test notification', body: 'If you see this, push delivery is working.' },
      android: { priority: 'high', notification: { channelId: 'rizvi_activity_channel', priority: 'high' } },
    });
    res.json({
      attempted: myTokens.length,
      succeeded: response.successCount,
      failed: response.failureCount,
      errors: response.responses.filter((r) => !r.success).map((r) => r.error?.message || String(r.error)),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
