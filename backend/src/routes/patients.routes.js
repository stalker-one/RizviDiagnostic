const express = require('express');
const { readTable, writeTable, generateId, clinicYearMonth, getDepartments, applyDateRange, applyStaffEntryLimit, staffLimitInfo, paginate } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { getFreshTable } = require('../mongo-table');
const { sendPushToAll } = require('../services/push.service');

const router = express.Router();
router.use(authenticate);

const DEFAULT_MONTH_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

function generateMR() {
  const settings = readTable('settings');
  const { year, month, key } = clinicYearMonth();
  const counters = readTable('counters');
  const counterKey = `mr_${key}`;
  const seq = (counters[counterKey] || 0) + 1;
  counters[counterKey] = seq;
  writeTable('counters', counters);
  const letters = settings.mrMonthLetters || DEFAULT_MONTH_LETTERS;
  const letter = letters[month - 1] || DEFAULT_MONTH_LETTERS[month - 1];
  const digits = Number(settings.mrDigits) || 4;
  const includeYear = settings.mrIncludeYear !== false;
  const yearPart = includeYear ? `${year.slice(-2)}-` : '';
  return `${letter}-${yearPart}${String(seq).padStart(digits, '0')}`;
}

function findOrCreateReferral(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;
  const referrals = readTable('referrals');
  const existing = referrals.find((r) => r.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing;
  const newRef = { id: generateId('ref'), name: trimmed, department: '', phone: '', address: '', sharePercent: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  referrals.push(newRef); writeTable('referrals', referrals); return newRef;
}

function findOrCreateDoctor(name, department) {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;
  const doctors = readTable('doctors');
  const existing = doctors.find((d) => d.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing;
  const newDoc = { id: generateId('doc'), name: trimmed, department: department || getDepartments()[0], phone: '', address: '', active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  doctors.push(newDoc); writeTable('doctors', doctors); return newDoc;
}

router.get('/', (req, res) => {
  const { q, page, pageSize } = req.query;
  let { range, from, to } = req.query;
  const isStaff = req.user.role === 'staff';
  let patients = readTable('patients');
  if (q) {
    const term = q.toLowerCase();
    patients = patients.filter((p) => p.name.toLowerCase().includes(term) || (p.phone || '').includes(term) || (p.mrNumber || '').toLowerCase().includes(term));
  } else {
    if (!range && !from && !to) range = 'today';
    patients = applyDateRange(patients, { range, from, to });
  }
  patients = patients.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  let staffLimit = null;
  if (isStaff && !q) {
    const settings = readTable('settings');
    const totalAvailable = patients.length;
    patients = applyStaffEntryLimit(patients, settings);
    staffLimit = staffLimitInfo(settings, totalAvailable, patients.length);
  }
  const result = paginate(patients, page, pageSize);
  res.json({ ...result, rows: result.rows, range: q ? null : range, staffLimit });
});

router.get('/:id', (req, res) => {
  const patients = readTable('patients');
  const patient = patients.find((p) => p.id === req.params.id);
  if (!patient) return res.status(404).json({ message: 'Patient not found.' });
  const invoices = readTable('invoices').filter((i) => i.patientId === patient.id);
  res.json({ ...patient, invoices });
});

router.post('/', (req, res) => {
  const { name, gender, age, phone, address, guardianName, referredBy, newReferralName, department, doctorId, newDoctorName } = req.body;
  if (!name || !gender) return res.status(400).json({ message: 'Patient name and gender are required.' });
  const patients = readTable('patients');
  let referredByName = '';
  let referredById = referredBy || '';
  if (newReferralName && newReferralName.trim()) { const referral = findOrCreateReferral(newReferralName); referredById = referral?.id || ''; referredByName = referral?.name || ''; }
  else if (referredBy) { const referral = readTable('referrals').find((r) => r.id === referredBy); referredByName = referral?.name || ''; }
  let doctorName = '';
  let doctorIdToSave = doctorId || '';
  if (newDoctorName && newDoctorName.trim()) { const doctor = findOrCreateDoctor(newDoctorName, department); doctorIdToSave = doctor?.id || ''; doctorName = doctor?.name || ''; }
  else if (doctorId) { const doctor = readTable('doctors').find((d) => d.id === doctorId); doctorName = doctor?.name || ''; }
  const newPatient = { id: generateId('pat'), name, gender, age: age || '', phone: phone || '', address: address || '', guardianName: guardianName || '', referredBy: referredById, referredByName, department: department || '', doctorId: doctorIdToSave, doctorName, mrNumber: generateMR(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: req.user.id, createdByName: req.user.name };
  patients.push(newPatient); writeTable('patients', patients); res.status(201).json(newPatient);
  sendPushToAll('Patient created', `${newPatient.name} was added as a new patient.`, { type: 'patient_created', patientId: newPatient.id }).catch(() => {});
});

router.put('/:id', (req, res) => {
  const patients = readTable('patients');
  const patient = patients.find((p) => p.id === req.params.id);
  if (!patient) return res.status(404).json({ message: 'Patient not found.' });
  const fields = ['name', 'gender', 'age', 'phone', 'address', 'guardianName', 'referredBy', 'department'];
  fields.forEach((f) => { if (req.body[f] !== undefined) patient[f] = req.body[f]; });
  if (req.body.newReferralName && req.body.newReferralName.trim()) { const referral = findOrCreateReferral(req.body.newReferralName); patient.referredBy = referral?.id || ''; patient.referredByName = referral?.name || ''; }
  else if (req.body.referredBy !== undefined) { const referral = readTable('referrals').find((r) => r.id === req.body.referredBy); patient.referredByName = referral?.name || ''; }
  if (req.body.newDoctorName && req.body.newDoctorName.trim()) { const doctor = findOrCreateDoctor(req.body.newDoctorName, patient.department); patient.doctorId = doctor?.id || ''; patient.doctorName = doctor?.name || ''; }
  else if (req.body.doctorId !== undefined) { patient.doctorId = req.body.doctorId; const doctor = readTable('doctors').find((d) => d.id === req.body.doctorId); patient.doctorName = doctor?.name || ''; }
  patient.updatedAt = new Date().toISOString(); writeTable('patients', patients); res.json(patient);
});

router.post('/bulk-delete', requireRole('superadmin'), async (req, res) => {
  const ids = [...new Set(Array.isArray(req.body?.ids) ? req.body.ids.map((id) => String(id)).filter(Boolean) : [])];
  if (!ids.length) return res.status(400).json({ message: 'At least one patient must be selected.' });
  const patients = await getFreshTable('patients', readTable('patients'));
  const selected = new Set(ids);
  const deletedCount = patients.filter((patient) => selected.has(String(patient.id))).length;
  if (!deletedCount) return res.status(404).json({ message: 'No selected patients were found.' });
  writeTable('patients', patients.filter((patient) => !selected.has(String(patient.id))));
  res.json({ message: `${deletedCount} patient${deletedCount === 1 ? '' : 's'} deleted.`, deletedCount });
});

router.delete('/:id', requireRole('admin', 'superadmin'), async (req, res) => {
  const patients = await getFreshTable('patients', readTable('patients'));
  const idx = patients.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Patient not found.' });
  patients.splice(idx, 1);
  writeTable('patients', patients);
  res.json({ message: 'Patient deleted.' });
});

module.exports = router;
