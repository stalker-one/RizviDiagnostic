const express = require('express');
const { readTable } = require('../db');
const { authenticate } = require('../middleware/auth');
const { getFreshTable } = require('../mongo-table');

const router = express.Router();
router.use(authenticate);

function dayBounds(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
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
    date: bounds.start.toISOString(),
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
