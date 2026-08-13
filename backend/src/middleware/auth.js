const jwt = require('jsonwebtoken');
const { readTable } = require('../db');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'No token provided. Please log in.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;

    // Superadmin kill-switch: once the site is deactivated, every authenticated
    // request from anyone other than the superadmin is refused with 423
    // (Locked), carrying the fake "reason" the superadmin chose so the
    // frontend can show the matching modal (Payment Due / Service Error).
    // The superadmin's own session is always exempt so they can log back in
    // and flip the switch back off.
    if (payload.role !== 'superadmin') {
      const settings = readTable('settings');
      if (settings.siteDisabled) {
        return res.status(423).json({
          locked: true,
          reason: settings.siteDisabledReason || 'service_error',
          message: settings.siteDisabledMessage || 'Service temporarily unavailable.',
        });
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired session. Please log in again.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
