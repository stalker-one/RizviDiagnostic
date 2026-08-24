const express = require('express');
const { readTable, isSameClinicDay, clinicDateKey, clinicShift, applyDateRange, applyStaffEntryLimit, staffLimitInfo } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/summary', (req, res) => {
  const invoices = readTable('invoices');
  const patients = readTable('patients');
  const isStaff = req.user.role === 'staff';
  let { range, from, to } = req.query;
  if (isStaff) { range = 'today'; from = undefined; to = undefined; }
  else if (!range && !from && !to) range = 'today';

  let scopedInvoices = applyDateRange(invoices, { range, from, to });
  let todaysInvoices = invoices.filter((i) => isSameClinicDay(i.createdAt));
  let staffLimit = null;
  if (isStaff) {
    const settings = readTable('settings');
    const totalAvailable = scopedInvoices.length;
    scopedInvoices = applyStaffEntryLimit(scopedInvoices, settings);
    todaysInvoices = applyStaffEntryLimit(todaysInvoices, settings);
    staffLimit = staffLimitInfo(settings, totalAvailable, scopedInvoices.length);
  }

  res.json({
    range: isStaff ? 'today' : range,
    totalSales: scopedInvoices.reduce((s, i) => s + i.total, 0),
    totalRevenue: scopedInvoices.reduce((s, i) => s + i.amountPaid, 0),
    testsPerformed: scopedInvoices.reduce((s, i) => s + i.items.length, 0),
    totalPatients: patients.length,
    totalInvoices: scopedInvoices.length,
    todaysRevenue: todaysInvoices.reduce((s, i) => s + i.amountPaid, 0),
    todaysInvoicesCount: todaysInvoices.length,
    pendingDues: scopedInvoices.reduce((s, i) => s + i.dueAmount, 0),
    lockedToToday: isStaff,
    staffLimit,
  });
});

router.get('/revenue-trend', (req, res) => {
  const days = Number(req.query.days) || 14;
  const invoices = readTable('invoices');
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = clinicDateKey(date);
    const dayInvoices = invoices.filter((inv) => clinicDateKey(new Date(inv.createdAt)) === key);
    result.push({ date: key, revenue: dayInvoices.reduce((s, inv) => s + inv.amountPaid, 0), invoices: dayInvoices.length });
  }
  res.json(result);
});

router.get('/test-distribution', (req, res) => {
  const { range, from, to } = req.query;
  const invoices = readTable('invoices');
  const scopedInvoices = applyDateRange(invoices, { range, from, to });
  const testCounts = {};
  scopedInvoices.forEach((invoice) => invoice.items.forEach((item) => {
    const testName = item.description || 'Unknown Test';
    testCounts[testName] = (testCounts[testName] || 0) + (item.quantity || 1);
  }));
  res.json(Object.entries(testCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10));
});

router.get('/daily-revenue', (req, res) => {
  const { range, from, to } = req.query;
  const invoices = readTable('invoices');
  const scopedInvoices = applyDateRange(invoices, { range, from, to });
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dailyRevenue = Object.fromEntries(daysOfWeek.map((day) => [day, 0]));
  scopedInvoices.forEach((invoice) => {
    const dayName = daysOfWeek[new Date(invoice.createdAt).getDay()];
    dailyRevenue[dayName] += invoice.amountPaid || 0;
  });
  res.json(daysOfWeek.map((day) => ({ day, revenue: dailyRevenue[day] || 0 })));
});

router.get('/most-performed-tests', (req, res) => {
  const invoices = readTable('invoices');
  const counts = {};
  invoices.forEach((inv) => inv.items.forEach((it) => {
    const key = it.description;
    if (!counts[key]) counts[key] = { name: key, count: 0, revenue: 0 };
    counts[key].count += it.quantity;
    counts[key].revenue += it.amount;
  }));
  res.json(Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 15));
});

// Radiology reports / transaction listing. The list intentionally does not
// expose Department or Performed By. Filtering is by date, shift and Booked By.
router.get('/radiology-reports', (req, res) => {
  const { shift, bookedBy } = req.query;
  let { from, to, range } = req.query;
  const isStaff = req.user.role === 'staff';

  if (isStaff) {
    range = 'today';
    from = undefined;
    to = undefined;
  } else if (!from && !to && !range) {
    range = 'today';
  }

  let invoices = applyDateRange(readTable('invoices'), { range, from, to });

  if (shift === 'Morning' || shift === 'Evening') {
    invoices = invoices.filter((i) => clinicShift(i.createdAt) === shift);
  }

  if (bookedBy && bookedBy.toString().trim()) {
    const needle = bookedBy.toString().trim().toLowerCase();
    invoices = invoices.filter((i) => (i.createdByName || '').toString().trim().toLowerCase().includes(needle));
  }

  const sorted = invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const patients = readTable('patients');
  const patientMap = Object.fromEntries(patients.map((p) => [p.id, p]));

  const rows = sorted.map((i) => ({
    invoiceNumber: i.invoiceNumber,
    mrNumber: i.patientSnapshot?.mrNumber,
    patientName: i.patientSnapshot?.name,
    referredBy: i.referralName || '',
    total: i.total,
    paid: i.amountPaid,
    discount: i.discountAmount,
    due: i.dueAmount,
    advance: i.advance,
    appointedDoctor: i.patientSnapshot?.doctorName || patientMap[i.patientId]?.doctorName || '',
    shift: clinicShift(i.createdAt),
    createdAt: i.createdAt,
    bookedBy: i.createdByName || '',
    updatedBy: i.updatedByName || '',
  }));

  res.json({ range, rows, limits: isStaff ? { lockedToToday: true } : null });
});

router.get('/pending-payments', (req, res) => {
  const invoices = readTable('invoices').filter((i) => i.dueAmount > 0);
  res.json(invoices.sort((a, b) => b.dueAmount - a.dueAmount));
});

module.exports = router;
