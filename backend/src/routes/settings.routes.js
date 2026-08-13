const express = require('express');
const { readTable, writeTable, DEPARTMENTS } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public: branding info (logo, clinic name/address/phone, print preferences) is
// not sensitive and needs to render on the Login screen before anyone signs in.
router.get('/', (req, res) => {
  const settings = readTable('settings');
  // Seed the admin-managed department list once, on first read, so a fresh
  // install still shows the familiar defaults in Settings > Departments
  // instead of an empty list.
  if (!Array.isArray(settings.departments) || settings.departments.length === 0) {
    settings.departments = DEPARTMENTS;
    writeTable('settings', settings);
  }
  res.json(settings);
});

router.put('/', authenticate, requireRole('admin', 'superadmin'), (req, res) => {
  const settings = readTable('settings');
  const updated = { ...settings, ...req.body };

  // The site kill-switch is superadmin-only and managed exclusively through
  // /api/site/status — never let it be changed (even accidentally) via the
  // general Settings save.
  updated.siteDisabled = settings.siteDisabled;
  updated.siteDisabledReason = settings.siteDisabledReason;
  updated.siteDisabledMessage = settings.siteDisabledMessage;

  // Toast notification on/off + screen position is superadmin-only. A
  // regular admin's save is silently prevented from touching these two
  // fields (mirrors the kill-switch pattern above) — the frontend also
  // hides this tab from non-superadmins, but we don't rely on that alone.
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

  // Staff entry-visibility limit (Settings > Staff Access) — clamp to known-
  // safe values so a bad request body can never leave settings in a state
  // that breaks the Patients/Invoices/Dashboard limit logic.
  const ENTRY_LIMIT_MODES = ['all', 'count', 'percent'];
  const ENTRY_LIMIT_COUNTS = [5, 10, 20, 30, 50, 100];
  updated.staffEntryLimitMode = ENTRY_LIMIT_MODES.includes(updated.staffEntryLimitMode)
    ? updated.staffEntryLimitMode
    : 'all';
  updated.staffEntryLimitCount = ENTRY_LIMIT_COUNTS.includes(Number(updated.staffEntryLimitCount))
    ? Number(updated.staffEntryLimitCount)
    : 20;
  {
    const pct = Number(updated.staffEntryLimitPercent);
    updated.staffEntryLimitPercent = Number.isFinite(pct) && pct >= 1 && pct <= 100 ? pct : 30;
  }

  // Departments must stay a clean, de-duplicated list of non-empty names —
  // this list feeds dropdowns across Doctors, Patients and Procedures.
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
