import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import Modal from '../components/Modal.jsx';
import Button from '../components/Button.jsx';
import TableLoadingRow from '../components/TableLoadingRow.jsx';
import { Plus, Search, FileText, Pencil, Trash2, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import useDepartments from '../hooks/useDepartments.js';
import useRealtimeRefresh from '../hooks/useRealtimeRefresh.js';

const emptyForm = {
  name: '', gender: 'male', age: '', phone: '', address: '', guardianName: '',
  referredBy: '', newReferralName: '',
  department: '', doctorId: '', newDoctorName: '',
};

// Pakistani mobile numbers are 11 digits starting with 0, formatted as
// 03XX-XXXXXXX (e.g. 0300-1234567). This keeps whatever the user types,
// strips anything that isn't a digit, caps it at 11 digits, and inserts the
// dash in the right place as they type.
function formatPakPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

const NEW_REFERRAL_VALUE = '__new__';
const NEW_DOCTOR_VALUE = '__new__';

export default function Patients() {
  const { isAdmin, isSuperadmin } = useAuth();
  const confirm = useConfirm();
  const departments = useDepartments();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [q, setQ] = useState('');
  const [range, setRange] = useState('today');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [selectedPatientIds, setSelectedPatientIds] = useState([]);

  const load = (opts = {}) => {
    const query = opts.q ?? q;
    const r = opts.range ?? range;
    const f = opts.from ?? from;
    const t = opts.to ?? to;
    const p = opts.page ?? page;
    if (!opts.realtime) setLoading(true);
    api
      .get('/patients', {
        params: {
          q: query || undefined,
          // A search term searches every patient regardless of date, so the
          // range/date filters only apply when there's no active search.
          range: query || f || t ? undefined : r,
          from: query ? undefined : f || undefined,
          to: query ? undefined : t || undefined,
          page: p,
          pageSize: 100,
        },
      })
      .then((res) => {
        setPatients(res.data.rows);
        setSelectedPatientIds((current) => current.filter((id) => res.data.rows.some((patient) => String(patient.id) === String(id))));
        setPage(res.data.page);
        setPageInfo({ total: res.data.total, totalPages: res.data.totalPages });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get('/referrals').then((res) => setReferrals(res.data));
    api.get('/doctors').then((res) => setDoctors(res.data));
  }, []);
  useRealtimeRefresh(load, ['patients']);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load({ q, page: 1 });
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name, gender: p.gender, age: p.age, phone: p.phone, address: p.address,
      guardianName: p.guardianName || '', referredBy: p.referredBy || '', newReferralName: '',
      department: p.department || '', doctorId: p.doctorId || '', newDoctorName: '',
    });
    setError('');
    setModalOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = { ...form };
    const isNewReferral = form.referredBy === NEW_REFERRAL_VALUE;
    if (isNewReferral) {
      if (!form.newReferralName.trim()) {
        setError('Please enter the new referring doctor / hospital name.');
        return;
      }
      payload.referredBy = '';
    } else {
      payload.newReferralName = '';
    }
    const isNewDoctor = form.doctorId === NEW_DOCTOR_VALUE;
    if (isNewDoctor) {
      if (!form.newDoctorName.trim()) {
        setError('Please enter the new doctor name.');
        return;
      }
      payload.doctorId = '';
    } else {
      payload.newDoctorName = '';
    }
    try {
      let createdPatient = null;
      if (editing) {
        await api.put(`/patients/${editing.id}`, payload);
      } else {
        const res = await api.post('/patients', payload);
        const rawPatient = res.data?.patient || res.data?.data || res.data;
        const patientId = rawPatient?.id || rawPatient?._id || res.data?.patientId || res.data?.id;
        if (!patientId) {
          throw new Error('Patient was created but the server did not return the patient ID.');
        }
        createdPatient = { ...rawPatient, id: patientId };
      }
      if (isNewReferral) {
        // Refresh so the newly auto-created referral is selectable right away.
        api.get('/referrals').then((res) => setReferrals(res.data));
      }
      if (isNewDoctor) {
        // Refresh so the newly auto-created doctor is selectable right away.
        api.get('/doctors').then((res) => setDoctors(res.data));
      }
      setQ('');
      setModalOpen(false);

      // A patient created from the Patients page should continue directly into
      // invoice creation, with that exact patient already selected. This is
      // the same workflow as creating a patient from the Create Invoice modal.
      if (createdPatient?.id) {
        navigate(`/invoices/create?patientId=${encodeURIComponent(String(createdPatient.id))}`, {
          state: { selectedPatient: createdPatient },
        });
        return;
      }

      // Editing a patient keeps the existing Patients-page behavior.
      load({ q: '' });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Something went wrong.');
    }
  };

  const remove = async (p) => {
    const ok = await confirm({
      title: 'Delete patient',
      message: `Delete patient "${p.name}"? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await api.delete(`/patients/${p.id}`);
    setSelectedPatientIds((current) => current.filter((id) => String(id) !== String(p.id)));
    load();
  };

  const togglePatientSelection = (patientId) => {
    const id = String(patientId);
    setSelectedPatientIds((current) => current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]);
  };

  const toggleAllVisiblePatients = () => {
    const visibleIds = patients.map((patient) => String(patient.id));
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedPatientIds.includes(id));
    setSelectedPatientIds((current) => allSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])]);
  };

  const removeSelectedPatients = async () => {
    if (!selectedPatientIds.length) return;
    const ok = await confirm({
      title: 'Delete selected patients',
      message: `Delete ${selectedPatientIds.length} selected ${selectedPatientIds.length === 1 ? 'patient' : 'patients'}? This cannot be undone.`,
      confirmText: 'Delete Selected',
      danger: true,
    });
    if (!ok) return;
    await api.post('/patients/bulk-delete', { ids: selectedPatientIds });
    setSelectedPatientIds([]);
    load();
  };

  const selectRange = (key) => {
    setRange(key);
    setFrom('');
    setTo('');
    setPage(1);
    load({ range: key, from: '', to: '', page: 1 });
  };

  const applyDateFilter = () => {
    setPage(1);
    load({ page: 1 });
  };

  const goToPage = (p) => {
    setPage(p);
    load({ page: p });
  };

  const activeDoctors = doctors.filter((d) => d.active !== false || d.id === form.doctorId);
  const doctorsForDepartment = form.department
    ? activeDoctors.filter((d) => d.department === form.department)
    : activeDoctors;

  return (
    <Layout title="Patients">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, phone, or MR#"
            className="border border-slate-200 rounded-lg px-3 py-2 w-full sm:w-72 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <Button type="submit" variant="secondary" icon={Search}>Search</Button>
        </form>
        <Button onClick={openAdd} icon={Plus}>Add Patient</Button>
      </div>

      {!q && isAdmin && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {[
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'last3', label: 'Last 3 Days' },
            { key: 'all', label: 'All' },
          ].map((opt) => (
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

      {isAdmin && !q && (
        <div className="flex flex-wrap items-end gap-3 mb-4 bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <Button onClick={applyDateFilter} icon={Filter}>Filter by Date</Button>
        </div>
      )}

      {isSuperadmin && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={patients.length > 0 && patients.every((patient) => selectedPatientIds.includes(String(patient.id)))}
              onChange={toggleAllVisiblePatients}
              aria-label="Select all visible patients"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Select all visible patients
          </label>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{selectedPatientIds.length} selected</span>
            <Button variant="danger" size="sm" icon={Trash2} onClick={removeSelectedPatients} disabled={!selectedPatientIds.length}>Delete Selected</Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[960px]">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              {isSuperadmin && <th className="p-3 w-12" aria-label="Select patients"></th>}
              <th className="p-3">MR#</th>
              <th className="p-3">Name</th>
              <th className="p-3">Gender / Age</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Department / Dr.</th>
              <th className="p-3">Referred By</th>
              <th className="p-3">Registered</th>
              <th className="p-3">Booked By</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={isSuperadmin ? 10 : 9} />
            ) : patients.length === 0 ? (
              <tr><td colSpan={isSuperadmin ? 10 : 9} className="p-6 text-center text-slate-400">No patients found.</td></tr>
            ) : (
              patients.map((p) => (
                <tr key={p.id} className="border-t border-slate-50 hover:bg-slate-50">
                  {isSuperadmin && (
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedPatientIds.includes(String(p.id))}
                        onChange={() => togglePatientSelection(p.id)}
                        aria-label={`Select patient ${p.name}`}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                    </td>
                  )}
                  <td className="p-3 font-mono text-xs">{p.mrNumber}</td>
                  <td className="p-3">
                    <Link to={`/patients/${p.id}`} className="text-brand-700 font-medium hover:underline">{p.name}</Link>
                  </td>
                  <td className="p-3 capitalize">{p.gender}{p.age ? `, ${p.age}y` : ''}</td>
                  <td className="p-3">{p.phone || '-'}</td>
                  <td className="p-3">
                    {p.department || '-'}{p.doctorName ? ` / ${p.doctorName}` : ''}
                  </td>
                  <td className="p-3">{p.referredByName || '-'}</td>
                  <td className="p-3">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className="p-3">{p.createdByName || '-'}</td>
                  <td className="p-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button variant="primary" size="xs" icon={FileText} onClick={() => navigate(`/invoices/create?patientId=${p.id}`)}>Invoice</Button>
                      <Button variant="secondary" size="xs" icon={Pencil} onClick={() => openEdit(p)}>Edit</Button>
                      {isAdmin && <Button variant="danger" size="xs" icon={Trash2} onClick={() => remove(p)}>Delete</Button>}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageInfo.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <div>
            Page {page} of {pageInfo.totalPages} &middot; {pageInfo.total} {pageInfo.total === 1 ? 'patient' : 'patients'}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => goToPage(page - 1)}>Prev</Button>
            <Button variant="secondary" size="sm" icon={ChevronRight} disabled={page >= pageInfo.totalPages} onClick={() => goToPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Patient' : 'Add Patient'}>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Full Name *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Gender *</label>
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Age</label>
              <input value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: formatPakPhone(e.target.value) })}
              type="tel"
              inputMode="numeric"
              placeholder="03XX-XXXXXXX"
              pattern="^0[0-9]{3}-[0-9]{7}$"
              maxLength={12}
              title="Enter an 11-digit Pakistani mobile number, e.g. 0300-1234567"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Guardian Name</label>
            <input value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Department</label>
              <select
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value, doctorId: '', newDoctorName: '' })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">-- Select department --</option>
                {departments.map((dep) => (
                  <option key={dep} value={dep}>{dep}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Doctor</label>
              <select
                value={form.doctorId}
                onChange={(e) => setForm({ ...form, doctorId: e.target.value, newDoctorName: '' })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">-- Select doctor --</option>
                {doctorsForDepartment.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}{d.department ? ` (${d.department})` : ''}</option>
                ))}
                <option value={NEW_DOCTOR_VALUE}>+ Add new doctor...</option>
              </select>
              {form.doctorId === NEW_DOCTOR_VALUE && (
                <input
                  autoFocus
                  value={form.newDoctorName}
                  onChange={(e) => setForm({ ...form, newDoctorName: e.target.value })}
                  placeholder="New doctor's name"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-2"
                />
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Referred By</label>
            <select value={form.referredBy} onChange={(e) => setForm({ ...form, referredBy: e.target.value, newReferralName: '' })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">-- Self / Walk-in --</option>
              {referrals.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
              <option value={NEW_REFERRAL_VALUE}>+ Add new referral...</option>
            </select>
            {form.referredBy === NEW_REFERRAL_VALUE && (
              <input
                autoFocus
                value={form.newReferralName}
                onChange={(e) => setForm({ ...form, newReferralName: e.target.value })}
                placeholder="New referring doctor / hospital name"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-2"
              />
            )}
            <p className="text-xs text-slate-400 mt-1">
              {form.referredBy === NEW_REFERRAL_VALUE
                ? 'This will be added to the Referrals tab automatically.'
                : "This referring doctor is used automatically when creating this patient's invoice."}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
            <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" rows={2} />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <Button type="submit" size="lg" className="w-full" icon={Plus}>
            {editing ? 'Save Changes' : 'Add Patient'}
          </Button>
        </form>
      </Modal>
    </Layout>
  );
}
