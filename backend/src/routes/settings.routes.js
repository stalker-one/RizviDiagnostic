const express = require('express');
const { readTable, writeTable, DEPARTMENTS } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

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
  const pct = Number(updated.staffEntryLimitPercent);
  updated.staffEntryLimitPercent = Number.isFinite(pct) && pct >= 1 && pct <= 100 ? pct : 30;

  const thermalRanges = {
    thermalMarginTop: [0, 30, 0], thermalMarginRight: [0, 30, 0], thermalMarginBottom: [0, 30, 0], thermalMarginLeft: [0, 30, 0],
    thermalPaddingTop: [0, 30, 6], thermalPaddingRight: [0, 30, 8], thermalPaddingBottom: [0, 30, 6], thermalPaddingLeft: [0, 30, 8],
    thermalSectionSpacing: [0, 30, 5], thermalTableSpacing: [0, 30, 8], thermalCellPadding: [0, 15, 3], thermalLineHeight: [1, 2.5, 1.5],
  };
  Object.entries(thermalRanges).forEach(([key, [min, max, fallback]]) => {
    const n = Number(updated[key]);
    updated[key] = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : (settings[key] ?? fallback);
  });

  // Thermal Paid Stamp is a separate namespace from the Simple/A4 stamp.
  const thermalStampRanges = {
    thermalStampFontSize: [8, 200, 26],
    thermalStampRotation: [-180, 180, -18],
    thermalStampOpacity: [0.15, 1, 0.82],
    thermalStampScale: [0.25, 4, 1],
    thermalStampOffsetX: [-500, 500, 0],
    thermalStampOffsetY: [-500, 500, 0],
    thermalStampBorderWidth: [1, 20, 3],
  };
  Object.entries(thermalStampRanges).forEach(([key, [min, max, fallback]]) => {
    const n = Number(updated[key]);
    updated[key] = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : (settings[key] ?? fallback);
  });
  updated.thermalStampEnabled = updated.thermalStampEnabled !== false;
  updated.thermalStampPosition = typeof updated.thermalStampPosition === 'string' ? updated.thermalStampPosition : (settings.thermalStampPosition || 'center');
  updated.thermalStampStyle = typeof updated.thermalStampStyle === 'string' ? updated.thermalStampStyle : (settings.thermalStampStyle || 'classic');
  updated.thermalStampText = typeof updated.thermalStampText === 'string' ? updated.thermalStampText : (settings.thermalStampText || 'PAID');
  updated.thermalStampColor = typeof updated.thermalStampColor === 'string' ? updated.thermalStampColor : (settings.thermalStampColor || '#c0392b');
  updated.thermalStampShowClinicName = updated.thermalStampShowClinicName !== false;
  updated.thermalStampShowDateTime = updated.thermalStampShowDateTime !== false;

  // Simple/A4 Paid Stamp remains in the original stamp* namespace. Do not
  // copy thermal values into it and do not derive thermal values from it.
  const simpleStampRanges = {
    stampRotation: [-180, 180, -18],
    stampOpacity: [0.15, 1, 0.82],
    stampScale: [0.25, 4, 1],
    stampOffsetX: [-500, 500, 0],
    stampOffsetY: [-500, 500, 0],
    stampBorderWidth: [1, 20, 3],
    stampFontSize: [8, 200, 26],
  };
  Object.entries(simpleStampRanges).forEach(([key, [min, max, fallback]]) => {
    const n = Number(updated[key]);
    updated[key] = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : (settings[key] ?? fallback);
  });
  updated.stampEnabled = updated.stampEnabled === true;
  updated.stampText = typeof updated.stampText === 'string' ? updated.stampText : (settings.stampText || 'PAID');
  updated.stampStyle = typeof updated.stampStyle === 'string' ? updated.stampStyle : (settings.stampStyle || 'classic');
  updated.stampPosition = typeof updated.stampPosition === 'string' ? updated.stampPosition : (settings.stampPosition || 'center-right');
  updated.stampColor = typeof updated.stampColor === 'string' ? updated.stampColor : (settings.stampColor || '#c0392b');
  updated.stampShowClinicName = updated.stampShowClinicName !== false;
  updated.stampShowDateTime = updated.stampShowDateTime !== false;

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
