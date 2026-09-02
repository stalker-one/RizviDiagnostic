import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import Button from '../components/Button.jsx';
import { Save, KeyRound, ReceiptText, Printer, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/axios';
import useRealtimeRefresh from '../hooks/useRealtimeRefresh.js';

const money = (value) => `Rs. ${Number(value || 0).toLocaleString()}`;

export default function Profile() {
  const { user, updateProfile } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [closing, setClosing] = useState(null);
  const [closingLoading, setClosingLoading] = useState(true);
  const [closingError, setClosingError] = useState('');

  const loadClosing = async (opts = {}) => {
    if (!opts.realtime) setClosingLoading(true);
    setClosingError('');
    try {
      const { data } = await api.get('/closing/today');
      setClosing(data);
    } catch (err) {
      setClosingError(err.response?.data?.message || 'Could not load today\'s closing.');
    } finally {
      setClosingLoading(false);
    }
  };

  useEffect(() => { loadClosing(); }, []);
  useRealtimeRefresh(loadClosing, ['invoices', 'patients']);

  const submitProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileMessage('');
    setProfileSaving(true);
    try {
      await updateProfile({ name, phone });
      setProfileMessage('Your profile has been updated.');
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setProfileSaving(false);
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    setPasswordSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setPasswordMessage('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const printClosing = () => {
    const printWindow = window.open('', '_blank', 'width=720,height=760');
    if (!printWindow || !closing) return;
    const date = new Date(closing.date).toLocaleDateString();
    printWindow.document.write(`<!doctype html><html><head><title>Today's Closing</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#0f172a}h1{margin:0 0 4px}p{color:#64748b}.hero{border:1px solid #e2e8f0;border-radius:16px;padding:20px;margin:24px 0}.revenue{font-size:30px;font-weight:800;margin-top:8px}.row{display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding:11px 0}.row:last-child{border:0}</style></head><body><h1>Today's Closing</h1><p>${date} · ${closing.user?.name || ''}</p><div class="hero"><div>Total Revenue</div><div class="revenue">${money(closing.totalRevenue)}</div></div><div class="row"><b>Total Paid</b><span>${money(closing.totalPaid)}</span></div><div class="row"><b>Total Due</b><span>${money(closing.totalDue)}</span></div><div class="row"><b>Total Discount</b><span>${money(closing.totalDiscount)}</span></div><div class="row"><b>Invoices</b><span>${closing.invoices}</span></div><div class="row"><b>Patients</b><span>${closing.patients}</span></div><script>window.onload=()=>{window.print();}</script></body></html>`);
    printWindow.document.close();
  };

  return (
    <Layout title="My Profile">
      <div className="max-w-3xl space-y-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-full bg-brand-600 text-white flex items-center justify-center text-xl font-semibold">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div>
              <div className="font-semibold text-slate-800">{user?.name}</div>
              <div className="text-xs text-slate-400 capitalize">{user?.role} · {user?.email}</div>
            </div>
          </div>

          <h3 className="font-semibold text-slate-700 mb-4">Update Name & Phone</h3>
          <form onSubmit={submitProfile} className="space-y-4">
            <div><label className="block text-xs font-medium text-slate-500 mb-1">Full Name *</label><input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" /></div>
            <div><label className="block text-xs font-medium text-slate-500 mb-1">Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" /></div>
            <div><label className="block text-xs font-medium text-slate-500 mb-1">Email</label><input disabled value={user?.email || ''} className="w-full border border-slate-200 bg-slate-50 text-slate-400 rounded-lg px-3 py-2 text-sm" /><p className="text-xs text-slate-400 mt-1">Contact an admin to change your login email.</p></div>
            {profileMessage && <div className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{profileMessage}</div>}
            {profileError && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{profileError}</div>}
            <Button type="submit" disabled={profileSaving} size="lg" icon={Save}>{profileSaving ? 'Saving...' : 'Save Changes'}</Button>
          </form>
        </div>

        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-700 to-brand-600 text-white p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/70"><ReceiptText size={15} /> Closing</div><h2 className="text-xl sm:text-2xl font-extrabold mt-1">Today's Closing</h2><p className="text-sm text-white/75 mt-1">Complete activity for {closing?.user?.name || user?.name || 'you'}</p></div>
              <button type="button" onClick={loadClosing} className="p-2 rounded-xl bg-white/10 hover:bg-white/20" aria-label="Refresh closing"><RefreshCw size={18} /></button>
            </div>
          </div>
          <div className="p-5 sm:p-6">
            {closingLoading ? <div className="py-10 text-center text-sm text-slate-400">Loading today's closing...</div> : closingError ? <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">{closingError}</div> : closing && <>
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 mb-5"><div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Revenue</div><div className="text-3xl sm:text-4xl font-black text-brand-700 mt-1 tabular-nums">{money(closing.totalRevenue)}</div><div className="text-xs text-slate-400 mt-1">Today's invoices created by you</div></div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[['Paid', closing.totalPaid, 'text-emerald-700'], ['Due', closing.totalDue, 'text-amber-700'], ['Discount', closing.totalDiscount, 'text-red-700']].map(([label, value, cls]) => <div key={label} className="rounded-xl border border-slate-100 p-4"><div className="text-xs text-slate-400">{label}</div><div className={`font-bold mt-1 ${cls}`}>{money(value)}</div></div>)}
                <div className="rounded-xl border border-slate-100 p-4"><div className="text-xs text-slate-400">Invoices / Patients</div><div className="font-bold text-slate-700 mt-1">{closing.invoices} / {closing.patients}</div></div>
              </div>
              <div className="flex flex-wrap justify-end gap-2 mt-5"><Button variant="outline" icon={Printer} onClick={printClosing}>Print Closing</Button></div>
            </>}
          </div>
        </section>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h3 className="font-semibold text-slate-700 mb-4">Change Password</h3>
          <form onSubmit={submitPassword} className="space-y-4">
            <div><label className="block text-xs font-medium text-slate-500 mb-1">Current Password *</label><input required type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
            <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-medium text-slate-500 mb-1">New Password *</label><input required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div><div><label className="block text-xs font-medium text-slate-500 mb-1">Confirm New Password *</label><input required type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div></div>
            {passwordMessage && <div className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{passwordMessage}</div>}
            {passwordError && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{passwordError}</div>}
            <Button type="submit" variant="secondary" disabled={passwordSaving} size="lg" icon={KeyRound}>{passwordSaving ? 'Updating...' : 'Change Password'}</Button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
