const express = require('express');
const { readTable, writeTable } = require('../db');
const { authenticate } = require('../middleware/auth');
const { sendPushToVariant, sendPushToAll, isEnabled, sendPushToTokens } = require('../services/push.service');
const { getFreshTable } = require('../mongo-table');

const router = express.Router();

router.post('/notify-update', (req, res) => {
  const secret = process.env.PUSH_TRIGGER_SECRET;
  if (!secret) return res.status(503).json({ message: 'Update push notifications are not configured on this server.' });
  if (req.get('X-Push-Secret') !== secret) return res.status(401).json({ message: 'Invalid push trigger secret.' });
  const { appVariant, versionName } = req.body || {};
  if (!['staff', 'superadmin', 'both'].includes(appVariant)) return res.status(400).json({ message: 'appVariant must be "staff", "superadmin", or "both".' });
  const appLabel = appVariant === 'superadmin' ? 'Rizvi Diagnostic Center Superadmin' : 'Rizvi Diagnostic Center';
  const send = appVariant === 'both'
    ? sendPushToAll(`${appLabel} update available`, `Version ${versionName || ''} is ready to install.`.trim(), { type: 'update_available', versionCode: req.body?.versionCode })
    : sendPushToVariant(appVariant, `${appLabel} update available`, `Version ${versionName || ''} is ready to install.`.trim(), { type: 'update_available', versionCode: req.body?.versionCode });
  send
    .then(() => res.json({ sent: true }))
    .catch((err) => res.status(500).json({ message: err.message }));
});

router.use(authenticate);

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
  writeTable('pushTokens', readTable('pushTokens').filter((t) => t.token !== token));
  res.json({ unregistered: true });
});

router.get('/status', async (req, res) => {
  const allTokens = (await getFreshTable('pushTokens', readTable('pushTokens'))) || [];
  const myTokens = allTokens.filter((t) => t.userId === req.user.id);
  res.json({
    firebaseConfigured: isEnabled(),
    totalRegisteredDevices: allTokens.length,
    myRegisteredDevices: myTokens.map((t) => ({ appVariant: t.appVariant, registeredAt: t.createdAt, lastUpdated: t.updatedAt })),
  });
});

// Diagnostic must use the same HTTP FCM implementation as normal pushes.
// It must never call firebase-admin/messaging directly because the backend
// intentionally no longer depends on the Firebase Admin default app.
router.post('/test-send', async (req, res) => {
  if (!isEnabled()) return res.status(503).json({ message: 'Firebase is not configured on this server (FIREBASE_SERVICE_ACCOUNT_JSON missing or invalid).' });
  const allTokens = (await getFreshTable('pushTokens', readTable('pushTokens'))) || [];
  const myTokens = allTokens.filter((t) => t.userId === req.user.id);
  if (!myTokens.length) return res.status(400).json({ message: 'No device is registered under your account yet -- open the Android app and log in first, then try again.' });

  try {
    const result = await sendPushToTokens(
      myTokens.map((t) => t.token),
      'Test notification',
      'If you see this, push delivery is working.',
      { type: 'test' },
    );
    res.json({
      attempted: myTokens.length,
      succeeded: result.sent,
      failed: result.failed,
      errors: result.errors || [],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
