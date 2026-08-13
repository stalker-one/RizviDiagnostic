import React, { useState } from 'react';
import Layout from '../components/Layout.jsx';
import Button from '../components/Button.jsx';
import { Save, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/axios';

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

  return (
    <Layout title="My Profile">
      <div className="max-w-2xl space-y-6">
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
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Full Name *</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
              <input disabled value={user?.email || ''} className="w-full border border-slate-200 bg-slate-50 text-slate-400 rounded-lg px-3 py-2 text-sm" />
              <p className="text-xs text-slate-400 mt-1">Contact an admin to change your login email.</p>
            </div>

            {profileMessage && <div className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{profileMessage}</div>}
            {profileError && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{profileError}</div>}

            <Button type="submit" disabled={profileSaving} size="lg" icon={Save}>
              {profileSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h3 className="font-semibold text-slate-700 mb-4">Change Password</h3>
          <form onSubmit={submitPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Current Password *</label>
              <input required type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">New Password *</label>
                <input required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Confirm New Password *</label>
                <input required type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            {passwordMessage && <div className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{passwordMessage}</div>}
            {passwordError && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{passwordError}</div>}

            <Button type="submit" variant="secondary" disabled={passwordSaving} size="lg" icon={KeyRound}>
              {passwordSaving ? 'Updating...' : 'Change Password'}
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
