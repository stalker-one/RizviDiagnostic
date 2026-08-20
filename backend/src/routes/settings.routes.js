const express = require('express');
const { readTable, writeTable, DEPARTMENTS } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public: branding info (logo, clinic name/address/phone, print preferences) is
// not sensitive and needs to render on the Login screen before anyone signs in.
router.get('/', (req, res) => {
  const settings = readTable('settings');
  if (!Array.isArray(settings.departments) || settings.departments.length === 0) {
    settings.departments = DEPARTMENTS;
    writeTable('settings', settings);
  }
  res.json(settings);
});

router.put('/', authenticate, requireRole('admin', 'superadmin'), (req, res) => {
  const settings = readTable('settings');
  const updated = { ...settings, ...req.body };

  updated.siteDisabled = settings.siteDisabled;
  updated.siteDisabledReason = settings.siteDisabledReason;
  updated.siteDisabledMessage = settings.siteDisabledMessage;

  const NOTIFICATION_POSITIONS = ['top-right', 'top-left', 'top-center', 'bottom-right', 'bottom-left', 'bottom-center'];
  if (req.user.role !== 'superadmin') {
    updated.notificationPosition = settings.notificationPosition;
    updated.notificationsEnabled = settings.notificationsEnabled;
  } else {
    updated.notificationPosition = NOTIFICATION_POSITIONS.includes(updated.notificationPosition)
      ? updated.notificationPosition
      : (settings.notificationPosition || 'top-right');
    updated.notificationsEnabled = updated.notificationsEnabled !== false;
  }

  const ENTRY_LIMIT_MODES = ['all', 'count', 'percent'];
  const ENTRY_LIMIT_COUNTS = [5, 10, 20, 30, 50, 100];
  updated.staffEntryLimitMode = ENTRY_LIMIT_MODES.includes(updated.staffEntryLimitMode) ? updated.staffEntryLimitMode : 'all';
  updated.staffEntryLimitCount = ENTRY_LIMIT_COUNTS.includes(Number(updated.staffEntryLimitCount)) ? Number(updated.staffEntryLimitCount) : 20;
  {
    const pct = Number(updated.staffEntryLimitPercent);
    updated.staffEntryLimitPercent = Number.isFinite(pct) && pct >= 1 && pct <= 100 ? pct : 30;
  }

  // Thermal receipt layout values are shared by the live web print view and
  // both Android applications. Keep them numeric and bounded so malformed
  // settings cannot produce unusable receipt CSS.
  const thermalRanges = {
    thermalMarginTop: [0, 20, 0], thermalMarginRight: [0, 20, 0], thermalMarginBottom: [0, 30, 0], thermalMarginLeft: [0, 20, 0],
    thermalPaddingTop: [0, 30, 6], thermalPaddingRight: [0, 30, 8], thermalPaddingBottom: [0, 30, 6], thermalPaddingLeft: [0, 30, 8],
    thermalSectionSpacing: [0, 30, 5], thermalTableSpacing: [0, 30, 8], thermalCellPadding: [0, 15, 3], thermalLineHeight: [1, 2.5, 1.5],
  };
  Object.entries(thermalRanges).forEach(([key, [min, max, fallback]]) => {
    const n = Number(updated[key]);
    updated[key] = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : (settings[key] ?? fallback);
  });

  if (Array.isArray(updated.departments)) {
    const seen = new Set();
    updated.departments = updated.departments
      .map((d) => (d || '').toString().trim())
      .filter((d) => {
        if (!d || seen.has(d.toLowerCase())) return false;
        seen.add(d.toLowerCase());
        return true;
      });
    if (updated.departments.length === 0) updated.departments = DEPARTMENTS;
  }

  writeTable('settings', updated);
  res.json(updated);
});

module.exports = router;
