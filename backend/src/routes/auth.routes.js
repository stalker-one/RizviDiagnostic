const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { readTable, writeTable } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password, portal } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const users = readTable('users');
  const user = users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }
  if (!user.active) {
    return res.status(403).json({ message: 'Your account has been deactivated. Contact admin.' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  // The two login portals are strictly separated: the regular Staff/Admin
  // portal (/login) never accepts the superadmin account, and the hidden
  // admin portal (/adminlogin, portal: 'admin') accepts nothing else. This
  // keeps the superadmin path from ever showing up next to, or being
  // confused with, the ordinary staff sign-in — even if someone knows the
  // superadmin's email address.
  if (portal === 'admin') {
    if (user.role !== 'superadmin') {
      return res.status(403).json({ message: 'This portal is for the superadmin account only.' });
    }
  } else if (user.role === 'superadmin') {
    return res.status(403).json({ message: 'Please use the admin portal to sign in to this account.' });
  }

  // Superadmin kill-switch: while the site is deactivated, nobody except the
  // superadmin can sign in at all — they see the same Payment Due / Service
  // Error modal a logged-in session would get.
  if (user.role !== 'superadmin') {
    const settings = readTable('settings');
    if (settings.siteDisabled) {
      return res.status(423).json({
        locked: true,
        reason: settings.siteDisabledReason || 'service_error',
        message: settings.siteDisabledMessage || 'Service temporarily unavailable.',
      });
    }
  }

  user.lastSignedIn = new Date().toISOString();
  writeTable('users', users);

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
  });
});

router.get('/me', authenticate, (req, res) => {
  const users = readTable('users');
  const user = users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    impersonatedBy: req.user.impersonatedBy || null,
  });
});

// ---- Superadmin: login-as-any-user (impersonation) ----
// Lets the superadmin act as any admin or staff account — to book, create
// invoices/patients, or troubleshoot exactly as that user would see the
// system — without knowing their password. The issued token carries
// `impersonatedBy` so the frontend can show an "Acting as ..." banner and
// hand the session back with /auth/stop-impersonate.
router.post('/impersonate/:userId', authenticate, requireRole('superadmin'), (req, res) => {
  const users = readTable('users');
  const target = users.find((u) => u.id === req.params.userId);
  if (!target) return res.status(404).json({ message: 'User not found.' });
  if (!target.active) {
    return res.status(400).json({ message: 'This account is deactivated and cannot be logged into.' });
  }
  if (target.role === 'superadmin') {
    return res.status(400).json({ message: 'You cannot impersonate another superadmin account.' });
  }

  const token = jwt.sign(
    {
      id: target.id,
      name: target.name,
      email: target.email,
      role: target.role,
      impersonatedBy: { id: req.user.id, name: req.user.name, email: req.user.email },
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );

  res.json({
    token,
    user: { id: target.id, name: target.name, email: target.email, role: target.role, phone: target.phone, impersonatedBy: { id: req.user.id, name: req.user.name } },
  });
});

// Return control back to the original superadmin session.
router.post('/stop-impersonate', authenticate, (req, res) => {
  if (!req.user.impersonatedBy) {
    return res.status(400).json({ message: 'You are not currently acting as another user.' });
  }
  const users = readTable('users');
  const original = users.find((u) => u.id === req.user.impersonatedBy.id);
  if (!original) return res.status(404).json({ message: 'Original superadmin account not found.' });

  const token = jwt.sign(
    { id: original.id, name: original.name, email: original.email, role: original.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );

  res.json({
    token,
    user: { id: original.id, name: original.name, email: original.email, role: original.role, phone: original.phone },
  });
});

router.put('/profile', authenticate, (req, res) => {
  const { name, phone } = req.body;
  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ message: 'Name cannot be empty.' });
  }
  const users = readTable('users');
  const user = users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });

  if (name !== undefined) user.name = String(name).trim();
  if (phone !== undefined) user.phone = phone;
  writeTable('users', users);

  // Re-issue token so the updated name is reflected immediately app-wide
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
  });
});

router.post('/change-password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new password are required.' });
  }
  const users = readTable('users');
  const user = users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });

  if (!bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(401).json({ message: 'Current password is incorrect.' });
  }
  user.password = bcrypt.hashSync(newPassword, 10);
  writeTable('users', users);
  res.json({ message: 'Password updated successfully.' });
});

module.exports = router;
