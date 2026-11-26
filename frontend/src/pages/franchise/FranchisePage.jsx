import { useState, useEffect } from 'react';
import { GitBranch, TrendingUp, Package, ShoppingCart, Plus, MapPin, Phone, Loader2, X, Save } from 'lucide-react';
import { branchesAPI, settingsAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const MOCK_BRANCHES = [
  { id: 'b1', name: 'Main Branch', address: 'MG Road, Bangalore', mobile: '9876543210', isMain: true, isActive: true, _count: { sales: 145, purchases: 32 }, monthlySales: 458000, monthlyPurchases: 120000 },
  { id: 'b2', name: 'Whitefield Branch', address: 'Whitefield, Bangalore', mobile: '8765432109', isMain: false, isActive: true, _count: { sales: 89, purchases: 18 }, monthlySales: 220000, monthlyPurchases: 75000 },
  { id: 'b3', name: 'Koramangala Branch', address: 'Koramangala, Bangalore', mobile: '7654321098', isMain: false, isActive: true, _count: { sales: 67, purchases: 14 }, monthlySales: 180000, monthlyPurchases: 55000 },
];

export default function FranchisePage() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await branchesAPI.list();
      setBranches(res.data || []);
    } catch { setBranches(MOCK_BRANCHES); } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const totalSales = branches.reduce((s, b) => s + (b.monthlySales || 0), 0);
  const totalPurchases = branches.reduce((s, b) => s + (b.monthlyPurchases || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Franchise & Branches</h1>
          <p className="page-subtitle">Manage multiple branches and view consolidated performance</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16} />Add Branch</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Branches', value: branches.length, icon: GitBranch, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Combined Monthly Sales', value: fmt(totalSales), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Combined Monthly Purchases', value: fmt(totalPurchases), icon: ShoppingCart, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(s => (
          <div key={s.label} className="card p-5 flex items-center gap-4">
            <div className={`${s.bg} p-3 rounded-xl`}><s.icon size={22} className={s.color} /></div>
            <div><p className="text-xs text-slate-500 font-medium">{s.label}</p><p className={`text-xl font-bold ${s.color}`}>{s.value}</p></div>
          </div>
        ))}
      </div>

      {/* Branch Cards */}
      {loading ? (
        <div className="card p-12 text-center"><Loader2 size={24} className="animate-spin text-blue-500 mx-auto" /></div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {branches.map(b => (
            <div key={b.id} className="card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-800">{b.name}</h3>
                    {b.isMain && <span className="badge-blue text-xs">Main</span>}
                    <span className={b.isActive ? 'badge-green' : 'badge-red'}>{b.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                    <MapPin size={11} />{b.address || '—'}
                  </div>
                  {b.mobile && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                      <Phone size={11} />{b.mobile}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'This Month Sales', value: fmt(b.monthlySales), color: 'text-emerald-700', bg: 'bg-emerald-50' },
                  { label: 'This Month Purchases', value: fmt(b.monthlyPurchases), color: 'text-violet-700', bg: 'bg-violet-50' },
                  { label: 'Total Sales Count', value: b._count?.sales || 0, color: 'text-blue-700', bg: 'bg-blue-50' },
                  { label: 'Total Purchases', value: b._count?.purchases || 0, color: 'text-slate-700', bg: 'bg-slate-100' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-3`}>
                    <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                    <p className={`text-base font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <BranchFormModal
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetch(); }}
        />
      )}
    </div>
  );
}

function BranchFormModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', address: '', mobile: '' });
  const [saving, setSaving] = useState(false);
  const u = f => e => setForm({ ...form, [f]: e.target.value });

  const handleSave = async () => {
    if (!form.name) { toast.error('Branch name is required'); return; }
    setSaving(true);
    try { await branchesAPI.create(form); toast.success('Branch created'); onSaved(); } catch {} finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Add New Branch</h2>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
          </div>
          <div className="p-6 space-y-4">
            {[['Branch Name *', 'name'], ['Address', 'address'], ['Mobile', 'mobile']].map(([label, field]) => (
              <div key={field}><label className="label">{label}</label><input value={form[field]} onChange={u(field)} className="input" /></div>
            ))}
          </div>
          <div className="px-6 pb-6 flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'Creating...' : 'Create Branch'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
