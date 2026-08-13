import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import Modal from '../components/Modal.jsx';
import Button from '../components/Button.jsx';
import TableLoadingRow from '../components/TableLoadingRow.jsx';
import { Plus, Pencil, Trash2, Power, LogIn, Lock } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import { showError } from '../components/Toast.jsx';

const emptyForm = { name: '', email: '', phone: '', role: 'staff', password: '' };

export default function Users() {
  const { isSuperadmin, impersonate } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/users').then((res) => setUsers(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setError(''); setModalOpen(true); };
  const openEdit = (u) => { setEditing(u); setForm({ name: u.name, email: u.email, phone: u.phone, role: u.role, password: '' }); setError(''); setModalOpen(true); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await api.put(`/users/${editing.id}`, payload);
      } else {
        await api.post('/users', form);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong.');
    }
  };

  const toggleActive = async (u) => {
    await api.put(`/users/${u.id}`, { active: !u.active });
    load();
  };

  const remove = async (u) => {
    const ok = await confirm({
      title: 'Delete user',
      message: `Delete user "${u.name}"?`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/users/${u.id}`);
      load();
    } catch (err) {
      showError(err.response?.data?.message || 'Could not delete user.');
    }
  };

  const loginAs = async (u) => {
    const ok = await confirm({
      title: 'Log in as user',
      message: `Log in as "${u.name}" (${u.role})? You can return to your superadmin session anytime from the top banner.`,
      confirmText: 'Log in',
    });
    if (!ok) return;
    try {
      await impersonate(u.id);
      navigate('/dashboard');
    } catch (err) {
      showError(err.response?.data?.message || 'Could not log in as this user.');
    }
  };

  const admins = users.filter((u) => u.role === 'admin' || u.role === 'superadmin');
  const staff = users.filter((u) => u.role === 'staff');

  return (
    <Layout title="Users">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4">
        <div className="text-sm text-slate-500">
          {admins.length} admin(s), {staff.length} staff — {users.length} total
          {isSuperadmin && <span className="text-amber-600"> · superadmin access</span>}
        </div>
        <Button onClick={openAdd} icon={Plus}>
          Add User
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3">Last Signed In</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={7} />
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-slate-400">No users found.</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-700">
                    {u.name}
                    {u.permanent && (
                      <span title="Permanent account — cannot be edited, deactivated, or deleted" className="inline-flex ml-1.5 align-middle text-amber-500">
                        <Lock size={12} />
                      </span>
                    )}
                  </td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.phone || '-'}</td>
                  <td className="p-3 capitalize">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.role === 'superadmin' ? 'bg-amber-50 text-amber-700' : u.role === 'admin' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-3">{u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleString() : '-'}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      {isSuperadmin && (
                        <Button variant="dark" size="xs" icon={LogIn} onClick={() => loginAs(u)}>Login As</Button>
                      )}
                      {!u.permanent && (
                        <>
                          <Button variant={u.active ? 'warning' : 'success'} size="xs" icon={Power} onClick={() => toggleActive(u)}>{u.active ? 'Deactivate' : 'Activate'}</Button>
                          <Button variant="secondary" size="xs" icon={Pencil} onClick={() => openEdit(u)}>Edit</Button>
                          <Button variant="danger" size="xs" icon={Trash2} onClick={() => remove(u)}>Delete</Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit User' : 'Add User'}>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Full Name *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Email *</label>
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Role *</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                disabled={editing?.role === 'admin' || editing?.role === 'superadmin'}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
              {(editing?.role === 'admin' || editing?.role === 'superadmin') && (
                <p className="text-xs text-slate-400 mt-1">Only the superadmin can change an existing admin's role.</p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              {editing ? 'New Password (leave blank to keep unchanged)' : 'Password *'}
            </label>
            <input required={!editing} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <Button type="submit" size="lg" className="w-full" icon={Plus}>
            {editing ? 'Save Changes' : 'Add User'}
          </Button>
        </form>
      </Modal>
    </Layout>
  );
}
