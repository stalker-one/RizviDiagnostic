import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Layout from '../components/Layout.jsx';
import PageLoader from '../components/PageLoader.jsx';
import api from '../api/axios';

// Survives navigating away and back within the same session, so a revisit
// shows the last-known data immediately instead of a blank loading screen.
let analyticsCache = null;

export default function Analytics() {
  const [tests, setTests] = useState(analyticsCache?.tests ?? []);
  const [pending, setPending] = useState(analyticsCache?.pending ?? []);
  const [loading, setLoading] = useState(!analyticsCache);

  useEffect(() => {
    Promise.all([api.get('/reports/most-performed-tests'), api.get('/reports/pending-payments')])
      .then(([t, p]) => {
        setTests(t.data);
        setPending(p.data);
        analyticsCache = { tests: t.data, pending: p.data };
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout title="Radiology Reports Analytics">
      {loading && tests.length === 0 && pending.length === 0 ? (
        <PageLoader message="Loading analytics..." />
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-slate-700 mb-4">Most Performed Tests</h3>
            {tests.length === 0 ? (
              <div className="text-slate-400 text-sm">No data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={tests} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={220} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0f6fde" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 font-semibold text-slate-700">Pending Payments</div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="p-3">Invoice#</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Paid</th>
                  <th className="p-3">Due</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {pending.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-slate-400">No pending payments. Great job!</td></tr>
                ) : (
                  pending.map((inv) => (
                    <tr key={inv.id} className="border-t border-slate-50">
                      <td className="p-3 font-mono text-xs">{inv.invoiceNumber}</td>
                      <td className="p-3">{inv.patientSnapshot?.name}</td>
                      <td className="p-3">Rs. {inv.total.toLocaleString()}</td>
                      <td className="p-3">Rs. {inv.amountPaid.toLocaleString()}</td>
                      <td className="p-3 text-red-600 font-medium">Rs. {inv.dueAmount.toLocaleString()}</td>
                      <td className="p-3">{new Date(inv.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}
