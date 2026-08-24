const express = require('express');
const { readTable } = require('../db');
const { authenticate } = require('../middleware/auth');
const { getFreshTable } = require('../mongo-table');

const router = express.Router();
router.use(authenticate);

const PAKISTAN_TZ = 'Asia/Karachi';

function pakistanDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PAKISTAN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
}

function dayBounds() {
  const { year, month, day } = pakistanDateParts();
  // Build UTC instants for Pakistan midnight. Asia/Karachi is UTC+05:00 and has
  // no DST, so these bounds are stable throughout the year.
  const start = new Date(`${year}-${month}-${day}T00:00:00+05:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, dateKey: `${year}-${month}-${day}` };
}

router.get('/today', async (req, res) => {
  const bounds = dayBounds();
  const [invoices, patients] = await Promise.all([
    getFreshTable('invoices', readTable('invoices')),
    getFreshTable('patients', readTable('patients')),
  ]);
  const userId = String(req.user.id || '');
  const today = (row) => {
    const created = new Date(row.createdAt);
    return !Number.isNaN(created.getTime()) && created >= bounds.start && created < bounds.end;
  };
  const userInvoices = invoices.filter((i) => String(i.createdBy || '') === userId && today(i));
  const userPatients = patients.filter((p) => String(p.createdBy || '') === userId && today(p));

  const totalRevenue = userInvoices.reduce((sum, i) => sum + Number(i.total || 0), 0);
  const totalPaid = userInvoices.reduce((sum, i) => sum + Number(i.amountPaid || 0), 0);
  const totalDue = userInvoices.reduce((sum, i) => sum + Number(i.dueAmount || 0), 0);
  const totalDiscount = userInvoices.reduce((sum, i) => sum + Number(i.discountAmount || 0), 0);

  res.json({
    date: bounds.dateKey,
    timezone: PAKISTAN_TZ,
    startAt: bounds.start.toISOString(),
    endAt: bounds.end.toISOString(),
    user: { id: req.user.id, name: req.user.name, role: req.user.role },
    invoices: userInvoices.length,
    patients: userPatients.length,
    totalRevenue,
    totalPaid,
    totalDue,
    totalDiscount,
  });
});

module.exports = router;
