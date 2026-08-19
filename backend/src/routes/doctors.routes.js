const express = require('express');
const { readTable, writeTable, generateId, getDepartments } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { getFreshTable } = require('../mongo-table');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const { department } = req.query;
  let doctors = readTable('doctors');
  if (department) doctors = doctors.filter((d) => d.department === department);
  res.json(doctors.sort((a, b) => a.name.localeCompare(b.name)));
});

router.post('/', (req, res) => {
  const { name, department, phone } = req.body;
  if (!name) return res.status(400).json({ message: 'Doctor name is required.' });
  const doctors = readTable('doctors');
  const newDoctor = { id: generateId('doc'), name, department: department || getDepartments()[0], phone: phone || '', active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  doctors.push(newDoctor);
  writeTable('doctors', doctors);
  res.status(201).json(newDoctor);
});

router.put('/:id', requireRole('admin', 'superadmin'), (req, res) => {
  const doctors = readTable('doctors');
  const doctor = doctors.find((d) => d.id === req.params.id);
  if (!doctor) return res.status(404).json({ message: 'Doctor not found.' });
  const { name, department, phone, active } = req.body;
  if (name !== undefined) doctor.name = name;
  if (department !== undefined) doctor.department = department;
  if (phone !== undefined) doctor.phone = phone;
  if (active !== undefined) doctor.active = active;
  doctor.updatedAt = new Date().toISOString();
  writeTable('doctors', doctors);
  res.json(doctor);
});

router.delete('/:id', requireRole('admin', 'superadmin'), async (req, res) => {
  const doctors = await getFreshTable('doctors', readTable('doctors'));
  const idx = doctors.findIndex((d) => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Doctor not found.' });
  doctors.splice(idx, 1);
  writeTable('doctors', doctors);
  res.json({ message: 'Doctor deleted.' });
});

module.exports = router;
