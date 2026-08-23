const express = require('express');
const { readTable, writeTable } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
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
