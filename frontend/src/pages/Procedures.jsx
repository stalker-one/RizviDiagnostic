import React, { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout.jsx';
import Modal from '../components/Modal.jsx';
import Button from '../components/Button.jsx';
import TableLoadingRow from '../components/TableLoadingRow.jsx';
import { Plus, Pencil, Trash2, Power, Download, Printer, Upload } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import useDepartments from '../hooks/useDepartments.js';

const emptyForm = { name: '', price: '', department: '', doctorsSharePercent: 0 };

// Very small CSV parser for the Import feature — handles the plain,
// comma-separated files this page itself exports (Export Excel button below),
// including quoted fields that may contain commas.
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const parseLine = (line) => {
    const cells = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
        else if (ch === '"') { inQuotes = false; }
        else cur += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cells.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
  };

  const header = parseLine(lines[0]).map((h) => h.toLowerCase());
  const nameIdx = header.findIndex((h) => h.includes('name'));
  const priceIdx = header.findIndex((h) => h.includes('price'));
  const deptIdx = header.findIndex((h) => h.includes('department'));
  const shareIdx = header.findIndex((h) => h.includes('share'));
  const statusIdx = header.findIndex((h) => h.includes('status'));

  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    return {
      name: nameIdx >= 0 ? cells[nameIdx] : '',
      price: priceIdx >= 0 ? cells[priceIdx] : '',
      department: deptIdx >= 0 ? cells[deptIdx] : '',
      doctorsSharePercent: shareIdx >= 0 ? cells[shareIdx] : 0,
      status: statusIdx >= 0 ? cells[statusIdx] : '',
    };
  });
}

export default function Procedures() {
  const { isAdmin } = useAuth();
  const confirm = useConfirm();
  const departments = useDepartments();
  const [procedures, setProcedures] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const fileInputRef = useRef(null);

  const load = () => {
    setLoading(true);
    api.get('/procedures').then((res) => setProcedures(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get('/doctors').then((res) => setDoctors(res.data));
  }, []);

  // Doctor name(s) on staff in a given department, shown alongside the
  // Department column so staff can see at a glance who reports/performs
  // procedures for that department.
  const doctorNamesForDepartment = (department) =>
    doctors.filter((d) => d.department === department && d.active !== false).map((d) => d.name).join(', ');

  const filtered = procedures.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  const openAdd = () => { setEditing(null); setForm({ ...emptyForm, department: departments[0] || '' }); setError(''); setModalOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ name: p.name, price: p.price, department: p.department, doctorsSharePercent: p.doctorsSharePercent }); setError(''); setModalOpen(true); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) await api.put(`/procedures/${editing.id}`, form);
      else await api.post('/procedures', form);
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong.');
    }
  };

  const toggleActive = async (p) => {
    await api.put(`/procedures/${p.id}`, { active: !p.active });
    load();
  };

  const remove = async (p) => {
    const ok = await confirm({
      title: 'Delete procedure',
      message: `Delete procedure "${p.name}"?`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await api.delete(`/procedures/${p.id}`);
    load();
  };

  const exportCsv = () => {
    const header = ['Status', 'Procedure Name', 'Price', 'Department', 'Doctors Share'];
    const lines = filtered.map((p) => [p.active ? 'Active' : 'Inactive', p.name, p.price, p.department, p.doctorsSharePercent].join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'radiology-procedures.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const triggerImport = () => fileInputRef.current?.click();

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (!file) return;

    setImportMessage('');
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setImportMessage('The file has no rows to import.');
        return;
      }
      const res = await api.post('/procedures/import', { rows });
      const { created, updated, skipped } = res.data;
      setImportMessage(
        `Imported: ${created} added, ${updated} updated${skipped ? `, ${skipped} skipped (missing name/price)` : ''}.`
      );
      load();
    } catch (err) {
      setImportMessage(err.response?.data?.message || 'Import failed. Please check the file and try again.');
    }
  };

  return (
    <Layout title="Radiology Procedure List">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search procedures..."
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full sm:w-72"
        />
        <div className="flex gap-2">
          <Button variant="secondary" icon={Download} onClick={exportCsv}>Export Excel</Button>
          {isAdmin && <Button variant="secondary" icon={Upload} onClick={triggerImport}>Import</Button>}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportFile}
            className="hidden"
          />
          <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button>
          {isAdmin && <Button onClick={openAdd} icon={Plus}>Add Procedure</Button>}
        </div>
      </div>

      {importMessage && (
        <div className="text-sm text-brand-700 bg-brand-50 rounded-lg px-3 py-2 mb-4">{importMessage}</div>
      )}

      <div className="text-xs text-slate-400 mb-2">
        Displaying procedures 1 - {filtered.length} of {procedures.length} in total
      </div>

      <div id="printable-area" className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="p-3">Status</th>
              <th className="p-3">Procedure Name</th>
              <th className="p-3">Price</th>
              <th className="p-3">Department</th>
              <th className="p-3">Doctors Share</th>
              {isAdmin && <th className="p-3 text-right">Action</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={6} />
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-slate-400">No procedures found.</td></tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {p.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-3">{p.name}</td>
                  <td className="p-3">Rs. {Number(p.price).toLocaleString()}</td>
                  <td className="p-3">
                    {p.department}
                    {doctorNamesForDepartment(p.department) && (
                      <div className="text-xs text-slate-400">{doctorNamesForDepartment(p.department)}</div>
                    )}
                  </td>
                  <td className="p-3">{p.doctorsSharePercent}%</td>
                  {isAdmin && (
                    <td className="p-3 text-right no-print">
                      <div className="inline-flex items-center gap-2">
                        <Button variant={p.active ? 'warning' : 'success'} size="xs" icon={Power} onClick={() => toggleActive(p)}>{p.active ? 'Deactivate' : 'Activate'}</Button>
                        <Button variant="secondary" size="xs" icon={Pencil} onClick={() => openEdit(p)}>Edit</Button>
                        <Button variant="danger" size="xs" icon={Trash2} onClick={() => remove(p)}>Delete</Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Procedure' : 'Add Procedure'}>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Procedure Name *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Price *</label>
              <input required type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Department</label>
              <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {departments.map((dep) => <option key={dep}>{dep}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Doctors Share %</label>
            <input type="number" value={form.doctorsSharePercent} onChange={(e) => setForm({ ...form, doctorsSharePercent: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <Button type="submit" size="lg" className="w-full" icon={Plus}>
            {editing ? 'Save Changes' : 'Add Procedure'}
          </Button>
        </form>
      </Modal>
    </Layout>
  );
}
