const express = require('express');
const { readTable, isSameClinicDay, clinicDateKey, clinicShift, applyDateRange, applyStaffEntryLimit, staffLimitInfo } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Dashboard summary cards.
// Presets: `range=today` (default), `range=yesterday`, `range=last3`,
// `range=all`, plus explicit from/to date filters (which always win over a
// preset) — same convention used by Invoices/Patients/Radiology Reports.
// Staff are hard-locked to today only, same as everywhere else in the app;
// admins are unrestricted and default to today too.
router.get('/summary', (req, res) => {
  const invoices = readTable('invoices');
  const patients = readTable('patients');

  const isStaff = req.user.role === 'staff';
  let { range, from, to } = req.query;

  if (isStaff) {
    range = 'today';
    from = undefined;
    to = undefined;
  } else if (!range && !from && !to) {
    range = 'today';
  }

  let scopedInvoices = applyDateRange(invoices, { range, from, to });

  // "Today" figures are always today's actual numbers regardless of which
  // range is selected, so the Today's Revenue / Today's Invoices cards stay
  // meaningful even while browsing Yesterday / Last 3 Days / a custom range.
  let todaysInvoices = invoices.filter((i) => isSameClinicDay(i.createdAt));

  // Admin-configured "how much of today's data can staff see" limit
  // (Settings > Staff Access) — trims the invoices that feed every card on
  // the staff Dashboard down to the most recent N entries, or the most
  // recent X% of today's entries. Never applied to admin/superadmin.
  let staffLimit = null;
  if (isStaff) {
    const settings = readTable('settings');
    const totalAvailable = scopedInvoices.length;
    scopedInvoices = applyStaffEntryLimit(scopedInvoices, settings);
    todaysInvoices = applyStaffEntryLimit(todaysInvoices, settings);
    staffLimit = staffLimitInfo(settings, totalAvailable, scopedInvoices.length);
  }

  const totalRevenue = scopedInvoices.reduce((s, i) => s + i.amountPaid, 0);
  const totalSales = scopedInvoices.reduce((s, i) => s + i.total, 0);
  const testsPerformed = scopedInvoices.reduce((s, i) => s + i.items.length, 0);

  res.json({
    range: isStaff ? 'today' : range,
    totalSales,
    totalRevenue,
    testsPerformed,
    totalPatients: patients.length,
    totalInvoices: scopedInvoices.length,
    todaysRevenue: todaysInvoices.reduce((s, i) => s + i.amountPaid, 0),
    todaysInvoicesCount: todaysInvoices.length,
    pendingDues: scopedInvoices.reduce((s, i) => s + i.dueAmount, 0),
    lockedToToday: isStaff,
    staffLimit,
  });
});

// Revenue over last N days (for charts)
router.get('/revenue-trend', (req, res) => {
  const days = Number(req.query.days) || 14;
  const invoices = readTable('invoices');
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = clinicDateKey(date);
    const dayInvoices = invoices.filter((inv) => clinicDateKey(new Date(inv.createdAt)) === key);
    result.push({
      date: key,
      revenue: dayInvoices.reduce((s, inv) => s + inv.amountPaid, 0),
      invoices: dayInvoices.length,
    });
  }
  res.json(result);
});

// NEW: Test Distribution for Pie Chart
// Returns distribution of tests performed within the selected date range
router.get('/test-distribution', (req, res) => {
  const { range, from, to } = req.query;
  const invoices = readTable('invoices');
  
  // Apply date filtering
  const scopedInvoices = applyDateRange(invoices, { range, from, to });
  
  // Count test types from invoice items
  const testCounts = {};
  scopedInvoices.forEach((invoice) => {
    invoice.items.forEach((item) => {
      // Use description as test name, or you can map to procedure names
      const testName = item.description || 'Unknown Test';
      if (!testCounts[testName]) {
        testCounts[testName] = 0;
      }
      testCounts[testName] += item.quantity || 1;
    });
  });
  
  // Convert to array format for pie chart
  const distribution = Object.entries(testCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10); // Limit to top 10 tests
  
  // If no data, return empty array
  if (distribution.length === 0) {
    return res.json([]);
  }
  
  res.json(distribution);
});

// NEW: Daily Revenue for Bar Chart
// Returns revenue breakdown by day of the week within the selected date range
router.get('/daily-revenue', (req, res) => {
  const { range, from, to } = req.query;
  const invoices = readTable('invoices');
  
  // Apply date filtering
  const scopedInvoices = applyDateRange(invoices, { range, from, to });
  
  // Group by day of week
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dailyRevenue = {};
  
  // Initialize all days with 0
  daysOfWeek.forEach(day => {
    dailyRevenue[day] = 0;
  });
  
  // Aggregate revenue by day
  scopedInvoices.forEach((invoice) => {
    const date = new Date(invoice.createdAt);
    const dayName = daysOfWeek[date.getDay()];
    dailyRevenue[dayName] += invoice.amountPaid || 0;
  });
  
  // Convert to array format for bar chart
  const result = daysOfWeek.map(day => ({
    day,
    revenue: dailyRevenue[day] || 0
  }));
  
  res.json(result);
});

// Most performed tests
router.get('/most-performed-tests', (req, res) => {
  const invoices = readTable('invoices');
  const counts = {};
  invoices.forEach((inv) => {
    inv.items.forEach((it) => {
      const key = it.description;
      if (!counts[key]) counts[key] = { name: key, count: 0, revenue: 0 };
      counts[key].count += it.quantity;
      counts[key].revenue += it.amount;
    });
  });
  const list = Object.values(counts).sort((a, b) => b.count - a.count);
  res.json(list.slice(0, 15));
});

// Radiology reports / transaction listing with filters.
// Presets: `range=today`, `range=yesterday`, `range=last3` (last 3
// clinic-days), `range=all`, plus explicit from/to date filters (which
// always win over a preset). Staff are hard-locked to today's data only —
// there is no way for the staff role to request yesterday, last3, a custom
// range, or all-time; admins are unrestricted and default to today too.
router.get('/radiology-reports', (req, res) => {
  const { department, doctor, shift } = req.query;
  let { from, to, range } = req.query;
  const isStaff = req.user.role === 'staff';

  if (isStaff) {
    // Staff can never escape "today" for radiology reports — ignore any
    // range/from/to they send and force today's clinic-day only.
    range = 'today';
    from = undefined;
    to = undefined;
  } else if (!from && !to && !range) {
    range = 'today';
  }

  let invoices = applyDateRange(readTable('invoices'), { range, from, to });

  const procedures = readTable('procedures');
  const procMap = Object.fromEntries(procedures.map((p) => [p.id, p]));

  if (department) {
    invoices = invoices.filter((i) =>
      i.items.some((it) => procMap[it.procedureId]?.department === department)
    );
  }

  // Filter to invoices where at least one line item was performed by the
  // selected doctor (case-insensitive match on the free-text "Performed By"
  // field entered when the invoice's procedures were added).
  if (doctor) {
    const needle = doctor.toString().trim().toLowerCase();
    invoices = invoices.filter((i) =>
      i.items.some((it) => (it.performedBy || '').trim().toLowerCase() === needle)
    );
  }

  // Filter by Morning/Evening shift, based on the clinic-local hour the
  // invoice was created and the admin-configured shift split.
  if (shift === 'Morning' || shift === 'Evening') {
    invoices = invoices.filter((i) => clinicShift(i.createdAt) === shift);
  }

  let sorted = invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Older invoices (created before the patient snapshot captured the
  // consulting doctor) won't have patientSnapshot.doctorName — fall back to
  // looking the patient up live so the report still shows a doctor for them.
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
    department: [...new Set(i.items.map((it) => procMap[it.procedureId]?.department).filter(Boolean))].join(', '),
    performedBy: [...new Set(i.items.map((it) => (it.performedBy || '').trim()).filter(Boolean))].join(', '),
    shift: clinicShift(i.createdAt),
    createdAt: i.createdAt,
    bookedBy: i.createdByName || '',
    updatedBy: i.updatedByName || '',
  }));

  res.json({
    range,
    rows,
    limits: isStaff ? { lockedToToday: true } : null,
  });
});

// Pending payments
router.get('/pending-payments', (req, res) => {
  const invoices = readTable('invoices').filter((i) => i.dueAmount > 0);
  res.json(invoices.sort((a, b) => b.dueAmount - a.dueAmount));
});

module.exports = router;