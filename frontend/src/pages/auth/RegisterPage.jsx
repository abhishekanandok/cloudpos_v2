import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store, Loader2 } from 'lucide-react';
import { authAPI } from '../../utils/api';
import toast from 'react-hot-toast';

function Field({ label, name, type = 'text', placeholder, required = true, form, update }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-300 mb-1.5">{label}</label>
      <input
        type={type}
        required={required}
        value={form[name]}
        onChange={update(name)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white
                   placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50
                   focus:border-blue-400 text-sm transition-all"
      />
    </div>
  );
}

export default function RegisterPage() {
  const [form, setForm] = useState({
    shopName: '', ownerName: '', mobile: '', email: '',
    password: '', address: '', gstNumber: '', businessType: 'RETAIL'
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.register(form);
      toast.success('Account created! Please check your email to verify.');
      navigate('/login');
    } catch (err) {
      // Global handler
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-xl relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-500/30">
            <Store size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">POS Counter</h1>
          <p className="text-slate-400 mt-1 text-sm">Create your shop account</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Shop Name" name="shopName" placeholder="My Super Store" form={form} update={update} />
              <Field label="Owner Name" name="ownerName" placeholder="Rajesh Kumar" form={form} update={update} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Mobile" name="mobile" type="tel" placeholder="9876543210" form={form} update={update} />
              <Field label="Email" name="email" type="email" placeholder="owner@shop.com" form={form} update={update} />
            </div>

            <Field label="Password" name="password" type="password" placeholder="Min 6 characters" form={form} update={update} />
            <Field label="Shop Address" name="address" placeholder="123, Market Street, Mumbai" required={false} form={form} update={update} />

            <div className="grid grid-cols-2 gap-4">
              <Field label="GST Number (Optional)" name="gstNumber" placeholder="22AAAAA0000A1Z5" required={false} form={form} update={update} />
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Business Type</label>
                <select
                  value={form.businessType}
                  onChange={update('businessType')}
                  className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white
                             focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                >
                  <option value="RETAIL" className="bg-slate-800">Retail</option>
                  <option value="WHOLESALE" className="bg-slate-800">Wholesale</option>
                  <option value="BOTH" className="bg-slate-800">Both</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg
                         transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30
                         disabled:opacity-60 mt-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-slate-400">Already have an account? </span>
            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
