import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import Modal from '../components/Modal.jsx';
import Button from '../components/Button.jsx';
import TableLoadingRow from '../components/TableLoadingRow.jsx';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';

const emptyForm = { name: '', department: '', phone: '', address: '', sharePercent: 0 };

export default function Referrals() {
  const { isAdmin } = useAuth();
  const confirm = useConfirm();
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/referrals').then((res) => setReferrals(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setError(''); setModalOpen(true); };
  const openEdit = (r) => { setEditing(r); setForm({ name: r.name, department: r.department, phone: r.phone, address: r.address, sharePercent: r.sharePercent }); setError(''); setModalOpen(true); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) await api.put(`/referrals/${editing.id}`, form);
      else await api.post('/referrals', form);
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong.');
    }
  };

  const remove = async (r) => {
    const ok = await confirm({
      title: 'Delete referral',
      message: `Delete referral "${r.name}"?`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await api.delete(`/referrals/${r.id}`);
    load();
  };

  return (
    <Layout title="Referrals">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4">
        <div className="text-sm text-slate-500">Displaying all {referrals.length} referrals</div>
        {isAdmin && (
          <Button onClick={openAdd} icon={Plus}>Add Referral</Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="p-3">Referral Name</th>
              <th className="p-3">Share</th>
              <th className="p-3">Department</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Address</th>
              {isAdmin && <th className="p-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={6} />
            ) : referrals.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-slate-400">No referrals found.</td></tr>
            ) : (
              referrals.map((r) => (
                <tr key={r.id} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-700">{r.name}</td>
                  <td className="p-3">{r.sharePercent}%</td>
                  <td className="p-3">{r.department || '-'}</td>
                  <td className="p-3">{r.phone || '-'}</td>
                  <td className="p-3">{r.address || '-'}</td>
                  {isAdmin && (
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button variant="secondary" size="xs" icon={Pencil} onClick={() => openEdit(r)}>Edit</Button>
                        <Button variant="danger" size="xs" icon={Trash2} onClick={() => remove(r)}>Delete</Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Referral' : 'Add Referral'}>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Referral Name *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Department</label>
            <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Share %</label>
              <input type="number" value={form.sharePercent} onChange={(e) => setForm({ ...form, sharePercent: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
            <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <Button type="submit" size="lg" className="w-full" icon={Plus}>
            {editing ? 'Save Changes' : 'Add Referral'}
          </Button>
        </form>
      </Modal>
    </Layout>
  );
}
