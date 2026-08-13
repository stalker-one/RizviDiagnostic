import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import Logo from '../components/Logo.jsx';
import Lightbox from '../components/Lightbox.jsx';
import Button from '../components/Button.jsx';
import { 
  ArrowLeft, ShieldCheck, Lock, Mail, 
  Clock, Activity, 
  CheckCircle, AlertCircle, Eye, EyeOff
} from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const clinicName = settings?.clinicName || 'Rizvi Diagnostic Center';
  const address = settings?.address || '547-A Jinnah Colony, Faisalabad';

  // Auto-focus email on load
  useEffect(() => {
    const timer = setTimeout(() => {
      document.querySelector('input[type="email"]')?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex font-sans bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* ---- Left: Branding Panel ---- */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl animate-pulse delay-2000" />
          
          {/* Grid pattern overlay */}
          <div 
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full h-full">
          <div>
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-all duration-300 group mb-16"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
              <span className="text-sm">Back to website</span>
            </Link>

            <div className="space-y-6 max-w-md">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 border border-white/10">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span className="font-mono text-[10px] tracking-widest text-emerald-400 uppercase">
                  Secure Staff Portal
                </span>
              </div>

              <h1 className="font-bold text-4xl xl:text-5xl leading-tight text-white">
                Welcome back,<br />
                <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Radiology Team
                </span>
              </h1>
              
              <p className="text-white/60 text-base leading-relaxed max-w-sm">
                Access your dashboard to manage patients, review studies, and generate reports for
                {' '}{clinicName}.
              </p>

              {/* Quick stats */}
              <div className="flex gap-6 pt-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Activity size={14} className="text-blue-400" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm">24/7</div>
                    <div className="text-white/40 text-[10px] uppercase tracking-wider">System Access</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Clock size={14} className="text-purple-400" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm">Real-time</div>
                    <div className="text-white/40 text-[10px] uppercase tracking-wider">Updates</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Lightbox compact className="max-w-sm" />
            <div className="flex items-center gap-3 text-xs text-white/30">
              <ShieldCheck size={14} className="text-emerald-400/60" />
              <span>Staff access only · Activity is logged for patient record security</span>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Right: Login Form Panel ---- */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          {/* Mobile header */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <Link to="/" className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div className="flex-1 flex items-center gap-3">
              <Logo settings={settings} width={40} height={40} />
              <div>
                <div className="font-semibold text-gray-900 text-sm leading-tight">{clinicName}</div>
                <div className="text-xs text-gray-400">{address}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8">
            {/* Header */}
            <div className="mb-8">
              <div className="hidden lg:flex items-center gap-3 mb-6">
                <Logo settings={settings} width={48} height={48} />
                <div>
                  <div className="font-semibold text-gray-900 leading-tight">{clinicName}</div>
                  <div className="text-xs text-gray-400">{address}</div>
                </div>
              </div>
              
              <h2 className="font-bold text-2xl text-gray-900">Sign in</h2>
              <p className="text-sm text-gray-500 mt-1">Enter your credentials to access the dashboard</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Address
                </label>
                <div className={`relative transition-all duration-300 ${
                  focusedField === 'email' ? 'scale-[1.01]' : ''
                }`}>
                  <div className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
                    focusedField === 'email' ? 'text-blue-500' : 'text-gray-400'
                  }`}>
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm 
                      focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 
                      transition-all duration-300 bg-gray-50/50 hover:bg-white"
                    placeholder="you@clinic.com"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className={`relative transition-all duration-300 ${
                  focusedField === 'password' ? 'scale-[1.01]' : ''
                }`}>
                  <div className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
                    focusedField === 'password' ? 'text-blue-500' : 'text-gray-400'
                  }`}>
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-12 py-3 text-sm 
                      focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 
                      transition-all duration-300 bg-gray-50/50 hover:bg-white"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded-md border-2 transition-all duration-200 flex items-center justify-center
                      ${rememberMe 
                        ? 'bg-blue-600 border-blue-600' 
                        : 'border-gray-300 bg-white group-hover:border-blue-400'
                      }`}
                    >
                      {rememberMe && <CheckCircle size={14} className="text-white" />}
                    </div>
                  </div>
                  <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                    Remember me
                  </span>
                </label>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 animate-shake">
                  <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <Button 
                type="submit" 
                disabled={loading} 
                size="lg" 
                className="w-full !bg-gradient-to-r !from-gray-900 !to-gray-800 hover:!from-gray-800 hover:!to-gray-700 
                  !text-white !rounded-xl !py-3.5 !font-semibold transition-all duration-300 
                  transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Sign In
                    <ArrowLeft size={18} className="rotate-180" />
                  </span>
                )}
              </Button>
            </form>

            {/* Additional options */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 justify-center text-xs text-gray-400">
                <Link to="/" className="hover:text-gray-600 transition-colors flex items-center gap-1">
                  <ArrowLeft size={12} /> Back to Home
                </Link>
                <span className="hidden sm:inline">·</span>
                <Link to="/contact" className="hover:text-gray-600 transition-colors">
                  Contact Support
                </Link>
                <span className="hidden sm:inline">·</span>
                <Link to="/privacy" className="hover:text-gray-600 transition-colors">
                  Privacy Policy
                </Link>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <p className="text-center text-xs text-gray-400 mt-6">
            <ShieldCheck size={12} className="inline mr-1" />
            Secure, encrypted connection · {new Date().getFullYear()} {clinicName}
          </p>
        </div>
      </div>

      {/* Shake animation for error */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}