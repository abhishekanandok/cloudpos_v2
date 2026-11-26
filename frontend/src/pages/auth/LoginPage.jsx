import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store, Eye, EyeOff, Loader2, Truck } from 'lucide-react';
import { authAPI, driversAPI } from '../../utils/api';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const INPUT_CLS = `w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white
  placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50
  focus:border-blue-400 text-sm transition-all`;

export default function LoginPage() {
  const [tab, setTab] = useState('owner'); // 'owner' | 'driver'

  // Owner form
  const [form, setForm]           = useState({ email: '', password: '' });
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);

  // Driver form
  const [dForm, setDForm]         = useState({ loginId: '', password: '' });
  const [showDPass, setShowDPass] = useState(false);
  const [dLoading, setDLoading]   = useState(false);

  const { setAuth } = useAuthStore();
  const navigate    = useNavigate();

  /* ── Owner Login ──────────────────────────────────── */
  const handleOwnerLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authAPI.login(form);
      setAuth(res.data.shop, res.data.token);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch {} finally { setLoading(false); }
  };

  /* ── Driver Login ─────────────────────────────────── */
  const handleDriverLogin = async (e) => {
    e.preventDefault();
    if (!dForm.loginId || !dForm.password) {
      toast.error('Login ID and password required');
      return;
    }
    setDLoading(true);
    try {
      const res = await driversAPI.login({ loginId: dForm.loginId, password: dForm.password });
      const { token, driver } = res.data;
      // Store driver session and redirect to Driver POS
      sessionStorage.setItem('driver_session', JSON.stringify({ token, driver }));
      localStorage.setItem('driver_token', token);
      toast.success(`Welcome, ${driver.name}!`);
      navigate('/driver-pos');
    } catch {
      toast.error('Invalid driver credentials');
    } finally { setDLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex items-center justify-center p-4">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-500/30">
            <Store size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">POS Counter</h1>
          <p className="text-slate-400 mt-1 text-sm">Smart Point of Sale for Your Business</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">

          {/* Tab switcher */}
          <div className="flex bg-white/10 rounded-xl p-1 mb-6 gap-1">
            <button
              onClick={() => setTab('owner')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all
                ${tab === 'owner' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <Store size={15} /> Owner Login
            </button>
            <button
              onClick={() => setTab('driver')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all
                ${tab === 'driver' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <Truck size={15} /> Driver Login
            </button>
          </div>

          {/* ── Owner Form ── */}
          {tab === 'owner' && (
            <form onSubmit={handleOwnerLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
                <input
                  type="email" required
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="owner@yourshop.com"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'} required
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="Enter your password"
                    className={`${INPUT_CLS} pr-10`}
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg
                           transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30
                           disabled:opacity-60 disabled:cursor-not-allowed mt-2">
                {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                {loading ? 'Signing in...' : 'Sign In as Owner'}
              </button>

              <div className="text-center text-sm pt-1">
                <span className="text-slate-400">Don't have an account? </span>
                <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium">
                  Create account
                </Link>
              </div>
            </form>
          )}

          {/* ── Driver Form ── */}
          {tab === 'driver' && (
            <form onSubmit={handleDriverLogin} className="space-y-4" noValidate>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center gap-3 mb-2">
                <Truck size={18} className="text-emerald-400 shrink-0" />
                <p className="text-xs text-emerald-300">Driver / Delivery Agent Login — Vehicle POS access</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Driver Login ID</label>
                <input
                  type="text"
                  autoComplete="username"
                  value={dForm.loginId}
                  onChange={e => setDForm({ ...dForm, loginId: e.target.value })}
                  placeholder="e.g. ramesh_driver"
                  className={INPUT_CLS}
                  onKeyDown={e => e.key === 'Enter' && handleDriverLogin(e)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showDPass ? 'text' : 'password'} required
                    value={dForm.password}
                    onChange={e => setDForm({ ...dForm, password: e.target.value })}
                    placeholder="Enter your password"
                    className={`${INPUT_CLS} pr-10`}
                    onKeyDown={e => e.key === 'Enter' && handleDriverLogin(e)}
                  />
                  <button type="button" onClick={() => setShowDPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    {showDPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={dLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-lg
                           transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30
                           disabled:opacity-60 disabled:cursor-not-allowed mt-2">
                {dLoading ? <Loader2 size={18} className="animate-spin" /> : <Truck size={18} />}
                {dLoading ? 'Logging in...' : 'Login as Driver'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">© 2026 POS Counter · All rights reserved</p>
      </div>
    </div>
  );
}
