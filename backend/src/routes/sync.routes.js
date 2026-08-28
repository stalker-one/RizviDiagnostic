const express = require('express');
const { getLatestVersion } = require('../mongo-table');

const router = express.Router();

// Lightweight cross-device change token. The previous implementation loaded
// every table document and scanned all timestamps on every poll. This endpoint
// now asks MongoDB for only the newest timestamp.
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

module.exports = router;
