import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import Logo from '../components/Logo.jsx';
import Lightbox from '../components/Lightbox.jsx';
import Button from '../components/Button.jsx';
import BiometricAccess from '../components/BiometricAccess.jsx';
import { ArrowLeft, ShieldCheck, Lock, Mail, Clock, Activity, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { login } = useAuth(); const { settings } = useSettings(); const navigate = useNavigate();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const [showPassword, setShowPassword] = useState(false); const [rememberMe, setRememberMe] = useState(false); const [focusedField, setFocusedField] = useState(null);
  const clinicName = settings?.clinicName || 'Rizvi Diagnostic Center'; const address = settings?.address || '547-A Jinnah Colony, Faisalabad';
  useEffect(() => { const timer = setTimeout(() => { document.querySelector('input[type="email"]')?.focus(); }, 100); return () => clearTimeout(timer); }, []);
  const handleSubmit = async (e) => { e.preventDefault(); setError(''); setLoading(true); try { await login(email, password); navigate('/dashboard'); } catch (err) { setError(err.response?.data?.message || 'Login failed. Please check your credentials and try again.'); } finally { setLoading(false); } };
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6"><Logo /><h1 className="mt-4 text-xl font-bold text-slate-800">{clinicName}</h1><p className="text-sm text-slate-500">Staff & Admin Login</p><p className="text-xs text-slate-400 mt-1">{address}</p></div>
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div><label className="block text-xs font-medium text-slate-600 mb-1.5">Email</label><div className="relative"><Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} onFocus={()=>setFocusedField('email')} onBlur={()=>setFocusedField(null)} className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" placeholder="you@example.com"/></div></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1.5">Password</label><div className="relative"><Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input type={showPassword?'text':'password'} required value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full border border-slate-200 rounded-lg pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" placeholder="••••••••"/><button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></div>
          <label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={rememberMe} onChange={(e)=>setRememberMe(e.target.checked)}/> Remember me</label>
          {error && <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2"><AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5"/><p className="text-xs text-red-600">{error}</p></div>}
          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm rounded-lg py-2.5 transition-colors">{loading?'Signing in...':'Sign In'}</button>
        </form>
        <div className="text-center mt-4"><Link to="/" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><ArrowLeft size={14}/>Back to home</Link></div>
      </div>
      <BiometricAccess />
    </div>
  );
}
