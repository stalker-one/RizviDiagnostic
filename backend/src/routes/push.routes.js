const express = require('express');
const { readTable, writeTable } = require('../db');
const { authenticate } = require('../middleware/auth');
const { sendPushToVariant } = require('../services/push.service');

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

module.exports = router;
