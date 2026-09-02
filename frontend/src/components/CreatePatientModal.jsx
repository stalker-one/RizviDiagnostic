import React, { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import { Save, UserPlus } from 'lucide-react';
import api from '../api/axios';
import useDepartments from '../hooks/useDepartments.js';

const emptyForm = {
  name: '',
  gender: 'male',
  age: '',
  phone: '',
  address: '',
  guardianName: '',
  referredBy: '',
  newReferralName: '',
  department: '',
  doctorId: '',
  newDoctorName: '',
};

function formatPakPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

const NEW_REFERRAL_VALUE = '__new__';
const NEW_DOCTOR_VALUE = '__new__';

export default function CreatePatientModal({ open, onClose, onCreated }) {
  const departments = useDepartments();
  const [referrals, setReferrals] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm);
    setError('');
    Promise.all([api.get('/referrals'), api.get('/doctors')])
      .then(([referralsRes, doctorsRes]) => {
        setReferrals(referralsRes.data);
        setDoctors(doctorsRes.data);
      })
      .catch(() => setError('Could not load referral or doctor lists.'));
  }, [open]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    const payload = { ...form };
    const isNewReferral = form.referredBy === NEW_REFERRAL_VALUE;
    const isNewDoctor = form.doctorId === NEW_DOCTOR_VALUE;

    if (isNewReferral) {
      if (!form.newReferralName.trim()) {
        setError('Please enter the new referring doctor / hospital name.');
        return;
      }
      payload.referredBy = '';
    } else {
      payload.newReferralName = '';
    }

    if (isNewDoctor) {
      if (!form.newDoctorName.trim()) {
        setError('Please enter the new doctor name.');
        return;
      }
      payload.doctorId = '';
    } else {
      payload.newDoctorName = '';
    }

    setSaving(true);
    try {
      const res = await api.post('/patients', payload);
      const patient = res.data?.patient || res.data?.data || res.data;

      if (!patient?.id) {
        throw new Error('Patient was created but the server did not return the patient ID.');
      }

      onCreated(patient);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not create patient.');
    } finally {
      setSaving(false);
    }
  };

  const activeDoctors = doctors.filter((doctor) => doctor.active !== false);
  const doctorsForDepartment = form.department
    ? activeDoctors.filter((doctor) => doctor.department === form.department)
    : activeDoctors;

  return (
    <Modal open={open} onClose={saving ? undefined : onClose} title="Create Patient" wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Full Name *</label>
            <input required value={form.name} onChange={(e) => update('name', e.target.value)} autoFocus
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Gender *</label>
            <select required value={form.gender} onChange={(e) => update('gender', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Age</label>
            <input value={form.age} onChange={(e) => update('age', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
            <input value={form.phone} onChange={(e) => update('phone', formatPakPhone(e.target.value))}
              type="tel" inputMode="numeric" placeholder="03XX-XXXXXXX"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Guardian Name</label>
            <input value={form.guardianName} onChange={(e) => update('guardianName', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
            <input value={form.address} onChange={(e) => update('address', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Department</label>
            <select value={form.department} onChange={(e) => { update('department', e.target.value); update('doctorId', ''); }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Select Department</option>
              {departments.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Doctor</label>
            <select value={form.doctorId} onChange={(e) => update('doctorId', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Select Doctor</option>
              {doctorsForDepartment.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
              ))}
              <option value={NEW_DOCTOR_VALUE}>+ Add new doctor</option>
            </select>
          </div>
          {form.doctorId === NEW_DOCTOR_VALUE && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">New Doctor Name *</label>
              <input required value={form.newDoctorName} onChange={(e) => update('newDoctorName', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Referred By</label>
            <select value={form.referredBy} onChange={(e) => update('referredBy', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Select Referral</option>
              {referrals.map((referral) => (
                <option key={referral.id} value={referral.id}>{referral.name}</option>
              ))}
              <option value={NEW_REFERRAL_VALUE}>+ Add new referral</option>
            </select>
          </div>
          {form.referredBy === NEW_REFERRAL_VALUE && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">New Referral Name *</label>
              <input required value={form.newReferralName} onChange={(e) => update('newReferralName', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          )}
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving} icon={saving ? undefined : Save}>
            {saving ? 'Creating...' : 'Create Patient'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
