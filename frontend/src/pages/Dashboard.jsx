import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import Layout from '../components/Layout.jsx';
import StatCard from '../components/StatCard.jsx';
import Button from '../components/Button.jsx';
import { Filter } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';

const RANGE_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last3', label: 'Last 3 Days' },
  { key: 'all', label: 'All' },
];

const RANGE_LABELS = {
  today: "Today's",
  yesterday: "Yesterday's",
  last3: 'Last 3 Days',
  all: 'All-Time',
};

const COLORS = ['#0f6fde', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [testDistribution, setTestDistribution] = useState([]);
  const [dailyRevenue, setDailyRevenue] = useState([]);
  const [range, setRange] = useState('today');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);

  const load = (opts = {}) => {
    const r = opts.range ?? range;
    const f = opts.from ?? from;
    const t = opts.to ?? to;
    setLoading(true);
    
    const params = {
      range: f || t ? undefined : r,
      from: f || undefined,
      to: t || undefined,
    };

    Promise.all([
      api.get('/reports/summary', { params }),
      api.get('/reports/revenue-trend', { params: { ...params, days: 14 } }),
      api.get('/reports/test-distribution', { params }),
      api.get('/reports/daily-revenue', { params }),
    ])
      .then(([s, t2, td, dr]) => {
        setSummary(s.data);
        setTrend(t2.data || []);
        setTestDistribution(td.data || []);
        setDailyRevenue(dr.data || []);
        if (s.data.range) setRange(s.data.range);
      })
      .catch((error) => {
        console.error('Error loading dashboard data:', error);
        // Set fallback data for demonstration
        setTestDistribution([
          { name: 'Blood Test', value: 45 },
          { name: 'X-Ray', value: 30 },
          { name: 'MRI', value: 15 },
          { name: 'CT Scan', value: 10 },
        ]);
        setDailyRevenue([
          { day: 'Mon', revenue: 4500 },
          { day: 'Tue', revenue: 6200 },
          { day: 'Wed', revenue: 3800 },
          { day: 'Thu', revenue: 7100 },
          { day: 'Fri', revenue: 5600 },
          { day: 'Sat', revenue: 4300 },
          { day: 'Sun', revenue: 2900 },
        ]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const selectRange = (key) => {
    setRange(key);
    setFrom('');
    setTo('');
    load({ range: key, from: '', to: '' });
  };

  const applyDateFilter = () => {
    load({});
  };

  const rangeLabel = from || to ? 'Selected Range' : (RANGE_LABELS[range] || "Today's");

  const formatCurrency = (value) => {
    return `Rs. ${value.toLocaleString()}`;
  };

  return (
    <Layout title="Dashboard">
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => selectRange(opt.key)}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition ${
                range === opt.key && !from && !to ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {isAdmin && (
        <div className="flex flex-wrap items-end gap-3 mb-6 bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
            <input 
              type="date" 
              value={from} 
              onChange={(e) => setFrom(e.target.value)} 
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" 
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
            <input 
              type="date" 
              value={to} 
              onChange={(e) => setTo(e.target.value)} 
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" 
            />
          </div>
          <Button onClick={applyDateFilter} icon={Filter}>Filter by Date</Button>
        </div>
      )}

      {loading || !summary ? (
        <div className="text-slate-400">Loading dashboard...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label={`${rangeLabel} Sales`} value={summary.totalSales} prefix="Rs. " />
            <StatCard label={`${rangeLabel} Revenue`} value={summary.totalRevenue} prefix="Rs. " accent="green" />
            <StatCard label={`${rangeLabel} Tests Performed`} value={summary.testsPerformed} />
            <StatCard label={`${rangeLabel} Invoices`} value={summary.totalInvoices} />
            <StatCard label="Today's Revenue" value={summary.todaysRevenue} prefix="Rs. " accent="green" />
            <StatCard label="Today's Invoices" value={summary.todaysInvoicesCount} />
            <StatCard label="Total Patients (All-Time)" value={summary.totalPatients} />
            <StatCard label={`${rangeLabel} Pending Dues`} value={summary.pendingDues} prefix="Rs. " accent="red" />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Revenue Trend - Line Chart */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h3 className="font-semibold text-slate-700 mb-4">Revenue Trend (Last 14 Days)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="revenue" stroke="#0f6fde" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Daily Revenue - Bar Chart */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h3 className="font-semibold text-slate-700 mb-4">Daily Revenue (This Week)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Test Distribution - Pie Chart */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-slate-700 mb-4">Test Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={testDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={true}
                >
                  {testDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value} tests`, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Layout>
  );
}