const express = require('express');
const { readTable, writeTable } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// A handful of preset "reasons" the superadmin can pick from. They're
// deliberately worded to look like an ordinary billing or technical problem
// rather than a deliberate shutdown, and are shown to every admin/staff user
// the instant the switch is flipped on (they're checked on every API call
// and on load, see authenticate() in middleware/auth.js).
const PRESET_REASONS = {
  payment_due: 'Payment Required: Your subscription has a remaining due balance. Please clear the pending amount to continue using this system.',
  service_error_1: 'Service Error 503: The application service is temporarily unavailable. Please try again later or contact your system administrator.',
  service_error_2: 'Service Error 500: An unexpected internal error occurred. Our team has been notified. Please try again shortly.',
};

// Public: any page (including the Login screen and an already-open session)
// can check this without a token, so the modal can appear even before / after
// auth is established.
router.get('/status', (req, res) => {
  const settings = readTable('settings');
  res.json({
    disabled: !!settings.siteDisabled,
    reason: settings.siteDisabledReason || null,
    message: settings.siteDisabled ? (settings.siteDisabledMessage || PRESET_REASONS.service_error_1) : null,
  });
});

router.get('/presets', authenticate, requireRole('superadmin'), (req, res) => {
  res.json(PRESET_REASONS);
});

// Only the superadmin can flip this switch. Turning it on immediately locks
// every admin/staff account out of the system (see authenticate()), showing
// them the chosen message until the superadmin turns it back off.
router.put('/status', authenticate, requireRole('superadmin'), (req, res) => {
  const { disabled, reason } = req.body;
  const settings = readTable('settings');

  settings.siteDisabled = !!disabled;
  if (disabled) {
    const key = PRESET_REASONS[reason] ? reason : 'service_error_1';
    settings.siteDisabledReason = key;
    settings.siteDisabledMessage = PRESET_REASONS[key];
  } else {
    settings.siteDisabledReason = null;
    settings.siteDisabledMessage = null;
  }

  writeTable('settings', settings);
  res.json({
    disabled: settings.siteDisabled,
    reason: settings.siteDisabledReason,
    message: settings.siteDisabledMessage,
  });
});

module.exports = router;
