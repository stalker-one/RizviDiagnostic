import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import Modal from '../components/Modal.jsx';
import Button from '../components/Button.jsx';
import TableLoadingRow from '../components/TableLoadingRow.jsx';
import { Plus, Pencil, Trash2, Power } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import useDepartments from '../hooks/useDepartments.js';

const emptyForm = { name: '', department: '', phone: '' };

export default function Doctors() {
  const { isAdmin } = useAuth();
  const confirm = useConfirm();
  const departments = useDepartments();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/doctors').then((res) => setDoctors(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ ...emptyForm, department: departments[0] || '' }); setError(''); setModalOpen(true); };
  const openEdit = (d) => { setEditing(d); setForm({ name: d.name, department: d.department, phone: d.phone || '' }); setError(''); setModalOpen(true); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) await api.put(`/doctors/${editing.id}`, form);
      else await api.post('/doctors', form);
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong.');
    }
  };

  const toggleActive = async (d) => {
    await api.put(`/doctors/${d.id}`, { active: !d.active });
    load();
  };

  const remove = async (d) => {
    const ok = await confirm({
      title: 'Delete doctor',
      message: `Delete doctor "${d.name}"?`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await api.delete(`/doctors/${d.id}`);
    load();
  };

  return (
    <Layout title="Doctors">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4">
        <div className="text-sm text-slate-500">Displaying all {doctors.length} doctors</div>
        {isAdmin && <Button onClick={openAdd} icon={Plus}>Add Doctor</Button>}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="p-3">Status</th>
              <th className="p-3">Doctor Name</th>
              <th className="p-3">Department</th>
              <th className="p-3">Phone</th>
              {isAdmin && <th className="p-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={5} />
            ) : doctors.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-slate-400">No doctors found.</td></tr>
            ) : (
              doctors.map((d) => (
                <tr key={d.id} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {d.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-3 font-medium text-slate-700">{d.name}</td>
                  <td className="p-3">{d.department || '-'}</td>
                  <td className="p-3">{d.phone || '-'}</td>
                  {isAdmin && (
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button variant={d.active ? 'warning' : 'success'} size="xs" icon={Power} onClick={() => toggleActive(d)}>{d.active ? 'Deactivate' : 'Activate'}</Button>
                        <Button variant="secondary" size="xs" icon={Pencil} onClick={() => openEdit(d)}>Edit</Button>
                        <Button variant="danger" size="xs" icon={Trash2} onClick={() => remove(d)}>Delete</Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Doctor' : 'Add Doctor'}>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Doctor Name *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Department *</label>
            <select required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              {departments.map((dep) => <option key={dep}>{dep}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <Button type="submit" size="lg" className="w-full" icon={Plus}>
            {editing ? 'Save Changes' : 'Add Doctor'}
          </Button>
        </form>
      </Modal>
    </Layout>
  );
}
