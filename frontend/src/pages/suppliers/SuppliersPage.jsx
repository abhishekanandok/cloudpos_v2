import { useState, useEffect } from 'react';
import { Plus, Search, X, Edit, Trash2, Loader2, Truck, Eye, Phone } from 'lucide-react';
import { suppliersAPI, ledgerAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const MOCK = [
  { id: 's1', name: 'ABC Distributors', mobile: '9876543210', address: 'Wholesale Market, Block A', gstNumber: '22AAAAA0000A1Z5', currentBalance: 0, _count: { purchases: 15 } },
  { id: 's2', name: 'XYZ Wholesale Pvt Ltd', mobile: '8765432109', address: 'Industrial Estate, Unit 5', gstNumber: '', currentBalance: 17000, _count: { purchases: 8 } },
  { id: 's3', name: 'Metro Cash & Carry', mobile: '7654321098', address: 'NH-8, Delhi Road', gstNumber: '07AAAAA0000A1Z5', currentBalance: 0, _count: { purchases: 22 } },
];
const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editSupplier, setEditSupplier] = useState(null);
  const [viewLedger, setViewLedger] = useState(null);

  const fetch = async (q = search) => {
    setLoading(true);
    try {
      const res = await suppliersAPI.list({ search: q });
      setSuppliers(res.data.suppliers || []);
    } catch { setSuppliers(MOCK); } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this supplier?')) return;
    try { await suppliersAPI.delete(id); setSuppliers(s => s.filter(x => x.id !== id)); toast.success('Supplier deleted'); } catch {}
  };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Suppliers</h1><p className="page-subtitle">Manage your supplier relationships</p></div>
        <button onClick={() => { setEditSupplier(null); setShowForm(true); }} className="btn-primary"><Plus size={16} />Add Supplier</button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Total Suppliers', value: suppliers.length },
          { label: 'With Outstanding', value: suppliers.filter(s => Number(s.currentBalance) > 0).length },
          { label: 'Total Outstanding', value: fmt(suppliers.reduce((s, sup) => s + Number(sup.currentBalance), 0)) },
        ].map(s => (
          <div key={s.label} className="card p-4"><p className="text-xs text-slate-500">{s.label}</p><p className="text-xl font-bold text-slate-700 mt-1">{s.value}</p></div>
        ))}
      </div>

      <div className="card p-4 mb-5">
        <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); fetch(e.target.value); }} placeholder="Search suppliers..." className="input pl-9" /></div>
      </div>

      <div className="card overflow-hidden">
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Supplier</th><th>Mobile</th><th>GST</th><th className="text-center">Purchases</th><th className="text-right">Outstanding</th><th className="text-center">Actions</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12"><Loader2 size={24} className="animate-spin text-blue-500 mx-auto" /></td></tr>
              ) : suppliers.map(s => (
                <tr key={s.id}>
                  <td><div className="font-medium">{s.name}</div><div className="text-xs text-slate-400">{s.address || '—'}</div></td>
                  <td><div className="flex items-center gap-1.5 text-slate-600"><Phone size={12} />{s.mobile || '—'}</div></td>
                  <td className="font-mono text-xs text-slate-500">{s.gstNumber || '—'}</td>
                  <td className="text-center"><span className="badge-slate">{s._count?.purchases || 0}</span></td>
                  <td className="text-right">{Number(s.currentBalance) > 0 ? <span className="font-semibold text-amber-600">{fmt(s.currentBalance)}</span> : <span className="text-slate-300">—</span>}</td>
                  <td>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setViewLedger(s)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Ledger"><Eye size={14} /></button>
                      <button onClick={() => { setEditSupplier(s); setShowForm(true); }} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Edit"><Edit size={14} /></button>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <SupplierForm supplier={editSupplier} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetch(); }} />}
      {viewLedger && <LedgerModal entity={viewLedger} onClose={() => setViewLedger(null)} />}
    </div>
  );
}

function SupplierForm({ supplier, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', mobile: '', address: '', gstNumber: '', openingBalance: '0', ...(supplier || {}) });
  const [saving, setSaving] = useState(false);
  const u = f => e => setForm({ ...form, [f]: e.target.value });

  const handleSave = async () => {
    if (!form.name) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (supplier) { await suppliersAPI.update(supplier.id, form); toast.success('Supplier updated'); }
      else { await suppliersAPI.create(form); toast.success('Supplier added'); }
      onSaved();
    } catch {} finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">{supplier ? 'Edit Supplier' : 'Add Supplier'}</h2>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
          </div>
          <div className="p-6 space-y-4">
            {[['Name *', 'name'], ['Mobile', 'mobile'], ['Address', 'address'], ['GST Number', 'gstNumber']].map(([label, field]) => (
              <div key={field}><label className="label">{label}</label><input value={form[field] || ''} onChange={u(field)} className="input" /></div>
            ))}
            {!supplier && <div><label className="label">Opening Balance (₹)</label><input type="number" value={form.openingBalance} onChange={u('openingBalance')} className="input" /></div>}
          </div>
          <div className="px-6 pb-6 flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <><Loader2 size={16} className="animate-spin" />Saving...</> : 'Save Supplier'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function LedgerModal({ entity, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  useEffect(() => {
    ledgerAPI.supplier(entity.id).then(r => setData(r.data))
      .catch(() => setData({ supplier: entity, entries: [] }))
      .finally(() => setLoading(false));
  }, [entity.id]);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h2 className="font-semibold text-slate-800">{entity.name} — Ledger</h2>
              <p className="text-xs text-slate-400 mt-0.5">Balance: <span className={`font-semibold ${Number(entity.currentBalance) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{fmt(entity.currentBalance)}</span></p>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? <div className="p-10 text-center"><Loader2 size={24} className="animate-spin text-blue-500 mx-auto" /></div>
            : <table className="table">
                <thead><tr><th>Date</th><th>Description</th><th className="text-right">Amount</th><th className="text-right">Balance</th></tr></thead>
                <tbody>
                  {(data?.entries || []).length === 0
                    ? <tr><td colSpan={4} className="text-center py-10 text-slate-400">No transactions yet</td></tr>
                    : (data?.entries || []).map(e => (
                      <tr key={e.id}>
                        <td className="text-xs text-slate-500">{new Date(e.createdAt).toLocaleDateString('en-IN')}</td>
                        <td>{e.description}</td>
                        <td className={`text-right font-medium ${e.type === 'CREDIT' ? 'text-red-500' : 'text-emerald-600'}`}>{fmt(e.amount)}</td>
                        <td className="text-right font-semibold">{fmt(e.balance)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>}
          </div>
        </div>
      </div>
    </>
  );
}
