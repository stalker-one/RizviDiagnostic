import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import PageLoader from '../components/PageLoader.jsx';
import api from '../api/axios';

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export default function PatientDetail() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/patients/${id}`).then((res) => setPatient(res.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Layout title="Patient"><PageLoader message="Loading patient..." /></Layout>;
  if (!patient) return <Layout title="Patient"><div className="text-slate-400">Patient not found.</div></Layout>;

  const totalBilled = patient.invoices.reduce((s, i) => s + i.total, 0);
  const totalPaid = patient.invoices.reduce((s, i) => s + i.amountPaid, 0);
  const totalDue = patient.invoices.reduce((s, i) => s + i.dueAmount, 0);

  return (
    <Layout title="Patient Profile">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-xl font-bold text-slate-800">{patient.name}</h2>
          <p className="text-sm text-slate-500 capitalize mb-3">{patient.gender} {patient.age ? `· ${patient.age} years` : ''}</p>
          <div className="text-sm space-y-1 text-slate-600">
            <div><span className="text-slate-400">MR#:</span> {patient.mrNumber}</div>
            <div><span className="text-slate-400">Phone:</span> {patient.phone || '-'}</div>
            <div><span className="text-slate-400">Guardian:</span> {patient.guardianName || '-'}</div>
            <div><span className="text-slate-400">Department:</span> {patient.department || '-'}</div>
            <div><span className="text-slate-400">Doctor:</span> {patient.doctorName || '-'}</div>
            <div><span className="text-slate-400">Referred By:</span> {patient.referredByName || '-'}</div>
            <div><span className="text-slate-400">Address:</span> {patient.address || '-'}</div>
            <div><span className="text-slate-400">Registered:</span> {formatDateTime(patient.createdAt)}</div>
            <div><span className="text-slate-400">Booked By:</span> {patient.createdByName || '-'}</div>
          </div>
          <Link
            to={`/invoices/create?patientId=${patient.id}`}
            className="block text-center mt-4 bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2 text-sm font-medium"
          >
            + Create Invoice
          </Link>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
              <div className="text-xs text-slate-400 uppercase font-semibold">Total Billed</div>
              <div className="text-lg font-bold text-slate-800">Rs. {totalBilled.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
              <div className="text-xs text-slate-400 uppercase font-semibold">Total Paid</div>
              <div className="text-lg font-bold text-green-700">Rs. {totalPaid.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
              <div className="text-xs text-slate-400 uppercase font-semibold">Total Due</div>
              <div className="text-lg font-bold text-red-600">Rs. {totalDue.toLocaleString()}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 font-semibold text-slate-700">Invoice History</div>
            <div
              className="w-full overflow-x-auto overflow-y-visible"
              style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}
            >
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-slate-500 text-left">
                  <tr>
                    <th className="p-3">Invoice#</th>
                    <th className="p-3">Procedures</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Due</th>
                    <th className="p-3">Date &amp; Time</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {patient.invoices.length === 0 ? (
                    <tr><td colSpan={6} className="p-6 text-center text-slate-400">No invoices yet.</td></tr>
                  ) : (
                    patient.invoices.map((inv) => (
                      <tr key={inv.id} className="border-t border-slate-50">
                        <td className="p-3 font-mono text-xs">{inv.invoiceNumber}</td>
                        <td className="p-3">{inv.items.map((it) => it.description).join(', ')}</td>
                        <td className="p-3">Rs. {inv.total.toLocaleString()}</td>
                        <td className="p-3 text-red-600">Rs. {inv.dueAmount.toLocaleString()}</td>
                        <td className="p-3 whitespace-nowrap">{formatDateTime(inv.createdAt)}</td>
                        <td className="p-3 text-right">
                          <Link to={`/invoices/${inv.id}/print`} className="text-brand-600 hover:underline">View / Print</Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-2 text-xs text-slate-400 border-t border-slate-50 sm:hidden">Swipe left/right to view all invoice columns.</div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
