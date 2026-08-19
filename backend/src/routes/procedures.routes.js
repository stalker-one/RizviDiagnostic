const express = require('express');
const { readTable, writeTable, generateId } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { getFreshTable } = require('../mongo-table');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const procedures = readTable('procedures');
  res.json(procedures.sort((a, b) => a.name.localeCompare(b.name)));
});

router.post('/', requireRole('admin', 'superadmin'), (req, res) => {
  const { name, price, department, doctorsSharePercent } = req.body;
  if (!name || price === undefined) return res.status(400).json({ message: 'Procedure name and price are required.' });
  const procedures = readTable('procedures');
  const newProc = { id: generateId('proc'), name, price: Number(price), department: department || 'General', doctorsSharePercent: Number(doctorsSharePercent) || 0, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  procedures.push(newProc);
  writeTable('procedures', procedures);
  res.status(201).json(newProc);
});

router.post('/import', requireRole('admin', 'superadmin'), (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ message: 'No rows to import.' });
  const procedures = readTable('procedures');
  let created = 0, updated = 0, skipped = 0;
  rows.forEach((row) => {
    const name = (row.name || '').toString().trim();
    const price = Number(row.price);
    if (!name || Number.isNaN(price)) { skipped += 1; return; }
    const department = (row.department || '').toString().trim() || 'General';
    const doctorsSharePercent = Number(row.doctorsSharePercent) || 0;
    const existing = procedures.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.price = price; existing.department = department; existing.doctorsSharePercent = doctorsSharePercent; existing.updatedAt = new Date().toISOString(); updated += 1;
    } else {
      procedures.push({ id: generateId('proc'), name, price, department, doctorsSharePercent, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); created += 1;
    }
  });
  writeTable('procedures', procedures);
  res.json({ created, updated, skipped });
});

router.put('/:id', requireRole('admin', 'superadmin'), (req, res) => {
  const procedures = readTable('procedures');
  const proc = procedures.find((p) => p.id === req.params.id);
  if (!proc) return res.status(404).json({ message: 'Procedure not found.' });
  const { name, price, department, doctorsSharePercent, active } = req.body;
  if (name !== undefined) proc.name = name;
  if (price !== undefined) proc.price = Number(price);
  if (department !== undefined) proc.department = department;
  if (doctorsSharePercent !== undefined) proc.doctorsSharePercent = Number(doctorsSharePercent);
  if (active !== undefined) proc.active = active;
  proc.updatedAt = new Date().toISOString();
  writeTable('procedures', procedures);
  res.json(proc);
});

router.delete('/:id', requireRole('admin', 'superadmin'), async (req, res) => {
  const procedures = await getFreshTable('procedures', readTable('procedures'));
  const idx = procedures.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Procedure not found.' });
  procedures.splice(idx, 1);
  writeTable('procedures', procedures);
  res.json({ message: 'Procedure deleted.' });
});

module.exports = router;
