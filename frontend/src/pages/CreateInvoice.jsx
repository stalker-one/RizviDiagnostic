import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import Button from '../components/Button.jsx';
import { Plus, Save } from 'lucide-react';
import api from '../api/axios';

export default function CreateInvoice() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [referrals, setReferrals] = useState([]);

  const [patientQuery, setPatientQuery] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState(searchParams.get('patientId') || '');
  const [items, setItems] = useState([]);
  const [selectedProcedureId, setSelectedProcedureId] = useState('');
  const [procedureQuery, setProcedureQuery] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [referralId, setReferralId] = useState('');
  const [referralAutoFilled, setReferralAutoFilled] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Create Invoice must be able to find ANY patient (not just today's
    // registrations) since front desk regularly invoices patients who
    // registered on an earlier visit — explicitly ask for the full list.
    api.get('/patients', { params: { range: 'all', pageSize: 1000 } }).then((res) => setPatients(res.data.rows));
    api.get('/procedures').then((res) => setProcedures(res.data.filter((p) => p.active)));
    api.get('/referrals').then((res) => setReferrals(res.data));
  }, []);

  const filteredPatients = useMemo(() => {
    // No search yet: show only the 5 most-recently-registered patients
    // (the list from the API is already sorted latest-first) so the picker
    // isn't cluttered. Once the user types, search across every patient.
    if (!patientQuery) return patients.slice(0, 5);
    const t = patientQuery.toLowerCase();
    return patients.filter((p) => p.name.toLowerCase().includes(t) || p.phone?.includes(t) || p.mrNumber?.includes(t)).slice(0, 10);
  }, [patientQuery, patients]);

  const filteredProcedures = useMemo(() => {
    if (!procedureQuery) return procedures;
    const t = procedureQuery.toLowerCase();
    return procedures.filter((p) => p.name.toLowerCase().includes(t));
  }, [procedureQuery, procedures]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  // When a patient with a registered referring doctor is selected, default the
  // invoice's referral to that doctor (the person can still change it below).
  useEffect(() => {
    if (selectedPatient?.referredBy && !referralId) {
      setReferralId(selectedPatient.referredBy);
      setReferralAutoFilled(true);
    }
  }, [selectedPatient]); // eslint-disable-line react-hooks/exhaustive-deps

  // Default the description to the selected procedure's name so it's ready
  // to go as-is, but the person can still edit it before adding the item —
  // e.g. to note "Chest X-Ray (PA + Lateral)" instead of the plain test name.
  useEffect(() => {
    const proc = procedures.find((p) => p.id === selectedProcedureId);
    if (proc) setItemDescription(proc.name);
  }, [selectedProcedureId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addItem = () => {
    const proc = procedures.find((p) => p.id === selectedProcedureId);
    if (!proc) return;
    setItems([
      ...items,
      {
        procedureId: proc.id,
        description: itemDescription.trim() || proc.name,
        rate: proc.price,
        quantity: 1,
        performedBy,
        completionDateTime: new Date().toISOString(),
      },
    ]);
    setSelectedProcedureId('');
    setItemDescription('');
  };

  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const updateItem = (idx, field, value) => {
    const copy = [...items];
    copy[idx] = { ...copy[idx], [field]: value };
    setItems(copy);
  };

  const subTotal = items.reduce((s, it) => s + Number(it.rate) * Number(it.quantity || 1), 0);
  const total = Math.max(subTotal - Number(discount || 0), 0);

  const submit = async () => {
    setError('');
    if (!selectedPatientId) return setError('Please select a patient.');
    if (items.length === 0) return setError('Please add at least one procedure.');

    setSaving(true);
    try {
      const res = await api.post('/invoices', {
        patientId: selectedPatientId,
        items,
        discount: Number(discount) || 0,
        referralId: referralId || null,
        paymentMode,
        amountPaid: amountPaid === '' ? total : Number(amountPaid),
        notes,
      });
      navigate(`/invoices/${res.data.id}/print`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save invoice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="Create Invoice">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Patient selection */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-slate-700 mb-3">Patient</h3>
            {selectedPatient ? (
              <div className="flex items-center justify-between bg-brand-50 rounded-lg px-4 py-3">
                <div>
                  <div className="font-medium text-slate-800">{selectedPatient.name}</div>
                  <div className="text-xs text-slate-500">MR#: {selectedPatient.mrNumber} · {selectedPatient.gender}, {selectedPatient.age}y · {selectedPatient.phone}</div>
                </div>
                <button onClick={() => setSelectedPatientId('')} className="text-sm text-brand-600 hover:underline">Change</button>
              </div>
            ) : (
              <div>
                <input
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                  placeholder="Search patient by name, phone or MR#..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2"
                />
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-50 border border-slate-100 rounded-lg">
                  {filteredPatients.length === 0 ? (
                    <div className="p-3 text-sm text-slate-400">No patients found. Add one from the Patients page.</div>
                  ) : (
                    filteredPatients.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPatientId(p.id)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex justify-between"
                      >
                        <span>{p.name}</span>
                        <span className="text-slate-400 text-xs">{p.mrNumber}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Add procedure */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-slate-700 mb-3">Add Procedure</h3>
            <input
              value={procedureQuery}
              onChange={(e) => setProcedureQuery(e.target.value)}
              placeholder="Type to filter procedures (e.g. 'chest', 'ultrasound')..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2"
            />
            <div className="flex gap-2 flex-wrap">
              <select
                value={selectedProcedureId}
                onChange={(e) => setSelectedProcedureId(e.target.value)}
                className="flex-1 min-w-[220px] border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select Procedure ({filteredProcedures.length})</option>
                {filteredProcedures.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — Rs. {p.price}</option>
                ))}
              </select>
              <input
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="Description"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-48"
              />
              <input
                value={performedBy}
                onChange={(e) => setPerformedBy(e.target.value)}
                placeholder="Performed By"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-40"
              />
              <Button onClick={addItem} disabled={!selectedProcedureId} icon={Plus}>Add</Button>
            </div>
          </div>

          {/* Items table */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="p-3">Description</th>
                  <th className="p-3 w-24">Rate</th>
                  <th className="p-3 w-20">Qty</th>
                  <th className="p-3 w-28">Amount</th>
                  <th className="p-3 w-32">Performed By</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-slate-400">No procedures added yet.</td></tr>
                ) : (
                  items.map((it, idx) => (
                    <tr key={idx} className="border-t border-slate-50">
                      <td className="p-3">
                        <input value={it.description} onChange={(e) => updateItem(idx, 'description', e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1" />
                      </td>
                      <td className="p-3">
                        <input type="number" value={it.rate} onChange={(e) => updateItem(idx, 'rate', e.target.value)}
                          className="w-20 border border-slate-200 rounded px-2 py-1" />
                      </td>
                      <td className="p-3">
                        <input type="number" min={1} value={it.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                          className="w-16 border border-slate-200 rounded px-2 py-1" />
                      </td>
                      <td className="p-3">Rs. {(Number(it.rate) * Number(it.quantity || 1)).toFixed(0)}</td>
                      <td className="p-3">
                        <input value={it.performedBy} onChange={(e) => updateItem(idx, 'performedBy', e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1" />
                      </td>
                      <td className="p-3 text-right">
                        <button onClick={() => removeItem(idx)} className="text-red-500">&times;</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-3">
            <h3 className="font-semibold text-slate-700">Referral & Payment</h3>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Referred By</label>
              <select
                value={referralId}
                onChange={(e) => { setReferralId(e.target.value); setReferralAutoFilled(false); }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select Referral</option>
                {referrals.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              {referralAutoFilled && (
                <p className="text-xs text-brand-600 mt-1">Auto-filled from this patient's registered referral.</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Discount (Rs.)</label>
              <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Payment Mode</label>
              <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option>Cash</option>
                <option>Card</option>
                <option>Bank Transfer</option>
                <option>Insurance</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Amount Paid (blank = full)</label>
              <input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder={total.toFixed(0)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Sub Total</span><span>Rs. {subTotal.toFixed(0)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Discount</span><span>-Rs. {Number(discount || 0).toFixed(0)}</span></div>
            <div className="flex justify-between font-bold text-base border-t border-slate-100 pt-2"><span>Total</span><span>Rs. {total.toFixed(0)}</span></div>
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

          <Button onClick={submit} disabled={saving} size="lg" className="w-full" icon={Save}>
            {saving ? 'Saving...' : 'Save & Print Invoice'}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
