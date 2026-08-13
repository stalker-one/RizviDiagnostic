const express = require('express');
const { readTable, writeTable, generateId } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  res.json(readTable('referrals').sort((a, b) => a.name.localeCompare(b.name)));
});

router.post('/', requireRole('admin', 'superadmin'), (req, res) => {
  const { name, department, phone, address, sharePercent } = req.body;
  if (!name) return res.status(400).json({ message: 'Referral name is required.' });

  const referrals = readTable('referrals');
  const newRef = {
    id: generateId('ref'),
    name,
    department: department || '',
    phone: phone || '',
    address: address || '',
    sharePercent: Number(sharePercent) || 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  referrals.push(newRef);
  writeTable('referrals', referrals);
  res.status(201).json(newRef);
});

router.put('/:id', requireRole('admin', 'superadmin'), (req, res) => {
  const referrals = readTable('referrals');
  const ref = referrals.find((r) => r.id === req.params.id);
  if (!ref) return res.status(404).json({ message: 'Referral not found.' });

  const { name, department, phone, address, sharePercent } = req.body;
  if (name !== undefined) ref.name = name;
  if (department !== undefined) ref.department = department;
  if (phone !== undefined) ref.phone = phone;
  if (address !== undefined) ref.address = address;
  if (sharePercent !== undefined) ref.sharePercent = Number(sharePercent);
  ref.updatedAt = new Date().toISOString();

  writeTable('referrals', referrals);
  res.json(ref);
});

router.delete('/:id', requireRole('admin', 'superadmin'), (req, res) => {
  const referrals = readTable('referrals');
  const idx = referrals.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Referral not found.' });
  referrals.splice(idx, 1);
  writeTable('referrals', referrals);
  res.json({ message: 'Referral deleted.' });
});

module.exports = router;
