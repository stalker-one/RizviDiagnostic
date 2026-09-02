const express = require('express');
const { readTable, writeTable, generateId, nextInvoiceNumber, applyDateRange, applyStaffEntryLimit, staffLimitInfo, paginate } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { getFreshTable } = require('../mongo-table');
const { sendPushToAll } = require('../services/push.service');

const router = express.Router();
router.use(authenticate);

function computeTotals(items, discount) {
  const subTotal = items.reduce((sum, it) => sum + Number(it.rate) * Number(it.quantity || 1), 0);
  const discountAmount = Number(discount) || 0;
  const total = Math.max(subTotal - discountAmount, 0);
  return { subTotal, discountAmount, total };
}

router.get('/', (req, res) => {
  const { patientId, page, pageSize } = req.query;
  let { range, from, to } = req.query;
  // Reads are served from the hot in-memory table. server.js keeps that table
  // synchronized with Atlas in the background instead of blocking this request.
  let invoices = readTable('invoices');
  if (patientId) {
    invoices = invoices.filter((i) => i.patientId === patientId);
    return res.json({ rows: invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), total: invoices.length, page: 1, pageSize: invoices.length, totalPages: 1 });
  }
  const isStaff = req.user.role === 'staff';
  if (isStaff) { range = 'today'; from = undefined; to = undefined; }
  else if (!range && !from && !to) range = 'today';
  invoices = applyDateRange(invoices, { range, from, to });
  invoices = invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  let staffLimit = null;
  if (isStaff) {
    const settings = readTable('settings');
    const totalAvailable = invoices.length;
    invoices = applyStaffEntryLimit(invoices, settings);
    staffLimit = staffLimitInfo(settings, totalAvailable, invoices.length);
  }
  const result = paginate(invoices, page, pageSize);
  res.json({ ...result, range, staffLimit });
});

router.get('/:id', (req, res) => {
  const invoices = readTable('invoices');
  const invoice = invoices.find((i) => i.id === req.params.id);
  if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });
  const patients = readTable('patients');
  const patient = patients.find((p) => p.id === invoice.patientId) || null;
  res.json({ ...invoice, patient });
});

router.post('/', (req, res) => {
  const { patientId, items, discount, referralId, paymentMode, amountPaid, notes } = req.body;
  if (!patientId) return res.status(400).json({ message: 'Patient is required.' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'At least one procedure must be added.' });
  const patients = readTable('patients');
  const patient = patients.find((p) => p.id === patientId);
  if (!patient) return res.status(404).json({ message: 'Patient not found.' });
  const effectiveReferralId = referralId || patient.referredBy || null;
  const normalizedItems = items.map((it) => ({ id: generateId('item'), procedureId: it.procedureId || null, description: it.description, rate: Number(it.rate), quantity: Number(it.quantity) || 1, amount: Number(it.rate) * (Number(it.quantity) || 1), performedBy: it.performedBy || '', completionDateTime: it.completionDateTime || new Date().toISOString() }));
  const { subTotal, discountAmount, total } = computeTotals(normalizedItems, discount);
  const paid = Number(amountPaid) || 0;
  const dueAmount = Math.max(total - paid, 0);
  const advance = Math.max(paid - total, 0);
  const referrals = readTable('referrals');
  const referral = effectiveReferralId ? referrals.find((r) => r.id === effectiveReferralId) : null;
  const invoices = readTable('invoices');
  const newInvoice = { id: generateId('inv'), invoiceNumber: nextInvoiceNumber(), patientId, patientSnapshot: { name: patient.name, gender: patient.gender, age: patient.age, mrNumber: patient.mrNumber, phone: patient.phone, address: patient.address, department: patient.department || '', doctorId: patient.doctorId || '', doctorName: patient.doctorName || '' }, referralId: effectiveReferralId, referralName: referral?.name || '', items: normalizedItems, subTotal, discountAmount, total, amountPaid: paid, dueAmount, advance, paymentMode: paymentMode || 'Cash', notes: notes || '', status: dueAmount > 0 ? 'due' : 'paid', createdBy: req.user.id, createdByName: req.user.name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  invoices.push(newInvoice);
  writeTable('invoices', invoices);
  res.status(201).json(newInvoice);
  sendPushToAll('Invoice created', `Invoice ${newInvoice.invoiceNumber} for ${patient.name} — Rs. ${total.toLocaleString()}`, { type: 'invoice_created', invoiceId: newInvoice.id }).catch(() => {});
});

router.put('/:id', (req, res) => {
  const invoices = readTable('invoices');
  const invoice = invoices.find((i) => i.id === req.params.id);
  if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });
  const { items, discount, referralId, paymentMode, amountPaid, notes } = req.body;
  if (Array.isArray(items) && items.length > 0) invoice.items = items.map((it) => ({ id: it.id || generateId('item'), procedureId: it.procedureId || null, description: it.description, rate: Number(it.rate), quantity: Number(it.quantity) || 1, amount: Number(it.rate) * (Number(it.quantity) || 1), performedBy: it.performedBy || '', completionDateTime: it.completionDateTime || new Date().toISOString() }));
  if (discount !== undefined) invoice.discountAmount = Number(discount) || 0;
  if (referralId !== undefined) { invoice.referralId = referralId; const referral = referralId ? readTable('referrals').find((r) => r.id === referralId) : null; invoice.referralName = referral?.name || ''; }
  if (paymentMode !== undefined) invoice.paymentMode = paymentMode;
  if (notes !== undefined) invoice.notes = notes;
  const { subTotal, discountAmount, total } = computeTotals(invoice.items, invoice.discountAmount);
  invoice.subTotal = subTotal; invoice.discountAmount = discountAmount; invoice.total = total;
  if (amountPaid !== undefined) invoice.amountPaid = Number(amountPaid) || 0;
  invoice.dueAmount = Math.max(invoice.total - invoice.amountPaid, 0);
  invoice.advance = Math.max(invoice.amountPaid - invoice.total, 0);
  invoice.status = invoice.dueAmount > 0 ? 'due' : 'paid';
  invoice.updatedAt = new Date().toISOString(); invoice.updatedBy = req.user.id; invoice.updatedByName = req.user.name;
  writeTable('invoices', invoices);
  res.json(invoice);
});

router.post('/bulk-delete', requireRole('superadmin'), async (req, res) => {
  const ids = [...new Set(Array.isArray(req.body?.ids) ? req.body.ids.map((id) => String(id)).filter(Boolean) : [])];
  if (!ids.length) return res.status(400).json({ message: 'At least one invoice must be selected.' });
  const invoices = await getFreshTable('invoices', readTable('invoices'));
  const selected = new Set(ids);
  const deletedCount = invoices.filter((invoice) => selected.has(String(invoice.id))).length;
  if (!deletedCount) return res.status(404).json({ message: 'No selected invoices were found.' });
  writeTable('invoices', invoices.filter((invoice) => !selected.has(String(invoice.id))));
  res.json({ message: `${deletedCount} invoice${deletedCount === 1 ? '' : 's'} deleted.`, deletedCount });
});

router.delete('/:id', requireRole('admin', 'superadmin'), async (req, res) => {
  const invoices = await getFreshTable('invoices', readTable('invoices'));
  const idx = invoices.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Invoice not found.' });
  invoices.splice(idx, 1);
  writeTable('invoices', invoices);
  res.json({ message: 'Invoice deleted.' });
});

module.exports = router;
