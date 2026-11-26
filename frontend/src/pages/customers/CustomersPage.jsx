import { useState, useEffect } from 'react';
import { Plus, Search, X, Edit, Trash2, Loader2, Users, Eye, Phone, IndianRupee } from 'lucide-react';
import { customersAPI, ledgerAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const MOCK = [
  { id: 'c1', name: 'Ramesh Kumar', mobile: '9876543210', address: '12, Gandhi Nagar', currentBalance: 5000, _count: { sales: 12 } },
  { id: 'c2', name: 'Suresh Patel', mobile: '8765432109', address: '45, MG Road', currentBalance: 0, _count: { sales: 8 } },
  { id: 'c3', name: 'Priya Sharma', mobile: '7654321098', address: 'Flat 3, Park View', currentBalance: 2500, _count: { sales: 25 } },
];
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [viewLedger, setViewLedger] = useState(null);
  const [pagination, setPagination] = useState({});

  const fetch = async (q = search) => {
    setLoading(true);
    try {
      const res = await customersAPI.list({ search: q });
      setCustomers(res.data.customers || []);
      setPagination(res.data.pagination || {});
    } catch { setCustomers(MOCK); } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this customer?')) return;
    try {
      await customersAPI.delete(id);
      setCustomers(c => c.filter(x => x.id !== id));
      toast.success('Customer deleted');
    } catch {}
  };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Customers</h1><p className="page-subtitle">Manage your customer database</p></div>
        <button onClick={() => { setEditCustomer(null); setShowForm(true); }} className="btn-primary">
          <Plus size={16} /> Add Customer
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Total Customers', value: pagination.total || customers.length },
          { label: 'With Outstanding', value: customers.filter(c => Number(c.currentBalance) > 0).length },
          { label: 'Total Outstanding', value: fmt(customers.reduce((s, c) => s + Number(c.currentBalance), 0)) },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="text-xl font-bold text-slate-700 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card p-4 mb-5 flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); fetch(e.target.value); }}
            placeholder="Search by name or mobile..." className="input pl-9" />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Mobile</th><th>Address</th><th className="text-center">Total Sales</th><th className="text-right">Balance</th><th className="text-center">Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12"><Loader2 size={24} className="animate-spin text-blue-500 mx-auto" /></td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400"><Users size={32} strokeWidth={1} className="mx-auto mb-2" />No customers found</td></tr>
              ) : customers.map(c => (
                <tr key={c.id}>
                  <td><div className="font-medium">{c.name}</div>{c.gstNumber && <div className="text-xs text-slate-400">GST: {c.gstNumber}</div>}</td>
                  <td><div className="flex items-center gap-1.5 text-slate-600"><Phone size={12} />{c.mobile || '—'}</div></td>
                  <td className="text-slate-500 text-sm">{c.address || '—'}</td>
                  <td className="text-center"><span className="badge-slate">{c._count?.sales || 0}</span></td>
                  <td className="text-right">{Number(c.currentBalance) > 0 ? <span className="font-semibold text-amber-600">{fmt(c.currentBalance)}</span> : <span className="text-slate-300">—</span>}</td>
                  <td>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setViewLedger(c)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="View Ledger"><Eye size={14} /></button>
                      <button onClick={() => { setEditCustomer(c); setShowForm(true); }} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Edit"><Edit size={14} /></button>
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <CustomerForm customer={editCustomer} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetch(); }} />}
      {viewLedger && <LedgerModal entity={viewLedger} type="customer" onClose={() => setViewLedger(null)} />}
    </div>
  );
}

function CustomerForm({ customer, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', mobile: '', address: '', gstNumber: '', creditLimit: '0', openingBalance: '0', ...(customer || {}) });
  const [saving, setSaving] = useState(false);
  const u = f => e => setForm({ ...form, [f]: e.target.value });

  const handleSave = async () => {
    if (!form.name) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (customer) { await customersAPI.update(customer.id, form); toast.success('Customer updated'); }
      else { await customersAPI.create(form); toast.success('Customer added'); }
      onSaved();
    } catch {} finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">{customer ? 'Edit Customer' : 'Add Customer'}</h2>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
          </div>
          <div className="p-6 space-y-4">
            {[['Name *', 'name', 'text'], ['Mobile', 'mobile', 'tel'], ['Address', 'address', 'text'], ['GST Number', 'gstNumber', 'text']].map(([label, field, type]) => (
              <div key={field}><label className="label">{label}</label><input type={type} value={form[field] || ''} onChange={u(field)} className="input" /></div>
            ))}
            {!customer && (
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Credit Limit (₹)</label><input type="number" value={form.creditLimit} onChange={u('creditLimit')} className="input" /></div>
                <div><label className="label">Opening Balance (₹)</label><input type="number" value={form.openingBalance} onChange={u('openingBalance')} className="input" /></div>
              </div>
            )}
          </div>
          <div className="px-6 pb-6 flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}{saving ? 'Saving...' : 'Save Customer'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function LedgerModal({ entity, type, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  useEffect(() => {
    const fn = type === 'customer' ? ledgerAPI.customer(entity.id) : ledgerAPI.supplier(entity.id);
    fn.then(r => setData(r.data)).catch(() => setData({ customer: entity, supplier: entity, entries: [] }))
      .finally(() => setLoading(false));
  }, [entity.id]);

  const entries = data?.entries || [];

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h2 className="font-semibold text-slate-800">{entity.name} — Ledger</h2>
              <p className="text-xs text-slate-400">Balance: <span className={`font-semibold ${Number(entity.currentBalance) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{fmt(entity.currentBalance)}</span></p>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? <div className="p-10 text-center"><Loader2 size={24} className="animate-spin text-blue-500 mx-auto" /></div> : (
              <table className="table">
                <thead><tr><th>Date</th><th>Description</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th></tr></thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-10 text-slate-400">No transactions found</td></tr>
                  ) : entries.map(e => (
                    <tr key={e.id}>
                      <td className="text-xs text-slate-500 whitespace-nowrap">{new Date(e.createdAt).toLocaleDateString('en-IN')}</td>
                      <td className="text-sm">{e.description || '—'}</td>
                      <td className="text-right text-red-500">{e.type === 'DEBIT' ? fmt(e.amount) : '—'}</td>
                      <td className="text-right text-emerald-600">{e.type === 'CREDIT' ? fmt(e.amount) : '—'}</td>
                      <td className="text-right font-semibold">{fmt(e.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
