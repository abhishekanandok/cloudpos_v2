import { useState, useEffect, useCallback } from 'react';
import { Search, Users, Truck, TrendingUp, TrendingDown, Loader2, Eye, X, Plus, RefreshCw, Edit2, Trash2, Lock } from 'lucide-react';
import { customersAPI, suppliersAPI, ledgerAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import PrivacyValue from '../../components/PrivacyValue';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => { try { return format(new Date(d), 'dd MMM yyyy'); } catch { return '—'; } };

const MOCK_CUSTOMERS = [
  { id: 'c1', name: 'Ramesh Kumar', mobile: '9876543210', currentBalance: 5000 },
  { id: 'c2', name: 'Suresh Patel', mobile: '8765432109', currentBalance: 0 },
  { id: 'c3', name: 'Priya Sharma', mobile: '7654321098', currentBalance: 2500 },
];
const MOCK_SUPPLIERS = [
  { id: 's1', name: 'ABC Distributors', mobile: '9876543210', currentBalance: 0 },
  { id: 's2', name: 'XYZ Wholesale Pvt Ltd', mobile: '8765432109', currentBalance: 17000 },
];
const MOCK_ENTRIES = [
  { id: 'e1', createdAt: new Date(Date.now() - 5 * 86400000), type: 'DEBIT', amount: 5200, balance: 5200, description: 'Sale Invoice #SAL-00012' },
  { id: 'e2', createdAt: new Date(Date.now() - 3 * 86400000), type: 'CREDIT', amount: 2000, balance: 3200, description: 'Payment received - Cash' },
  { id: 'e3', createdAt: new Date(Date.now() - 86400000), type: 'DEBIT', amount: 1800, balance: 5000, description: 'Sale Invoice #SAL-00018' },
];

export default function LedgerPage() {
  const [tab, setTab] = useState('customers');
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [deleteEntry, setDeleteEntry] = useState(null);

  const openAddEntry = () => { setEditEntry(null); setShowEntryModal(true); };
  const openEditEntry = (entry) => { setEditEntry(entry); setShowEntryModal(true); };

  const fetchEntities = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'customers') {
        const res = await customersAPI.list({ search, limit: 50 });
        setEntities(res.data.customers || []);
      } else {
        const res = await suppliersAPI.list({ search, limit: 50 });
        setEntities(res.data.suppliers || []);
      }
    } catch {
      setEntities(tab === 'customers' ? MOCK_CUSTOMERS : MOCK_SUPPLIERS);
    } finally { setLoading(false); }
  }, [tab, search]);

  useEffect(() => { fetchEntities(); setSelected(null); setLedgerData(null); }, [tab]);
  useEffect(() => { const t = setTimeout(fetchEntities, 300); return () => clearTimeout(t); }, [search]);

  const loadLedger = async (entity) => {
    setSelected(entity);
    setLedgerLoading(true);
    setLedgerData(null);
    try {
      const res = tab === 'customers'
        ? await ledgerAPI.customer(entity.id)
        : await ledgerAPI.supplier(entity.id);
      setLedgerData(res.data);
    } catch {
      setLedgerData({ entries: MOCK_ENTRIES });
    } finally { setLedgerLoading(false); }
  };

  const totalOutstanding = entities.reduce((s, e) => s + Number(e.currentBalance || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Ledger</h1>
          <p className="page-subtitle">Track outstanding balances and transaction history</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="card p-4">
          <p className="text-xs text-slate-500 font-medium">Total {tab === 'customers' ? 'Customer' : 'Supplier'} Outstanding</p>
          <p className={`text-2xl font-bold mt-1 ${totalOutstanding > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            <PrivacyValue value={fmt(totalOutstanding)} />
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 font-medium">Parties with Balance</p>
          <p className="text-2xl font-bold mt-1 text-slate-700">{entities.filter(e => Number(e.currentBalance) > 0).length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 font-medium">Total Parties</p>
          <p className="text-2xl font-bold mt-1 text-slate-700">{entities.length}</p>
        </div>
      </div>

      <div className="flex gap-5">
        {/* Left: entity list */}
        <div className="w-80 flex-shrink-0 space-y-3">
          {/* Tab switcher */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'customers', label: 'Customers', icon: Users },
              { id: 'suppliers', label: 'Suppliers', icon: Truck },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all
                  ${tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <t.icon size={14} />{t.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search..." className="input pl-9 text-sm" />
          </div>

          {/* Entity List */}
          <div className="card overflow-hidden max-h-[calc(100vh-320px)] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center"><Loader2 size={20} className="animate-spin text-blue-500 mx-auto" /></div>
            ) : entities.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No {tab} found</div>
            ) : entities.map(e => (
              <button key={e.id} onClick={() => loadLedger(e)}
                className={`w-full text-left px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-blue-50/50 transition-colors
                  ${selected?.id === e.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="font-medium text-slate-800 text-sm">{e.name}</div>
                  {Number(e.currentBalance) > 0 && (
                    <span className="text-xs font-semibold text-amber-600"><PrivacyValue value={fmt(e.currentBalance)} /></span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{e.mobile || '—'}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: ledger detail */}
        <div className="flex-1">
          {!selected ? (
            <div className="card h-96 flex flex-col items-center justify-center text-slate-300">
              <Eye size={44} strokeWidth={0.75} className="mb-3" />
              <p className="text-sm text-slate-400">Select a {tab === 'customers' ? 'customer' : 'supplier'} to view their ledger</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              {(() => {
                const freshBalance = ledgerData?.customer?.currentBalance ?? ledgerData?.supplier?.currentBalance ?? selected.currentBalance;
                return (
                  <>
                  {/* Header */}
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-800">{selected.name}</h3>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                        <span>{selected.mobile || '—'}</span>
                        <span className={`font-semibold ${Number(freshBalance) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          Balance: <PrivacyValue value={fmt(freshBalance)} />
                        </span>
                      </div>
                    </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => loadLedger(selected)} className="btn-secondary btn-sm gap-1">
                    <RefreshCw size={13} /> Refresh
                  </button>
                  <button onClick={() => openAddEntry()} className="btn-primary btn-sm gap-1">
                    <Plus size={13} /> Add Entry
                  </button>
                </div>
              </div>

              {/* Table */}
              {ledgerLoading ? (
                <div className="p-12 text-center"><Loader2 size={24} className="animate-spin text-blue-500 mx-auto" /></div>
              ) : (
                <div className="table-wrapper max-h-[calc(100vh-340px)] overflow-y-auto">
                  <table className="table">
                    <thead className="sticky top-0 bg-white z-10">
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th className="text-right">
                          {tab === 'customers' ? 'Invoice (Dr)' : 'Purchase (Cr)'}
                        </th>
                        <th className="text-right">
                          {tab === 'customers' ? 'Payment (Cr)' : 'Payment (Dr)'}
                        </th>
                        <th className="text-right">Balance</th>
                        <th className="w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ledgerData?.entries || []).length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-10 text-slate-400">No transactions yet</td></tr>
                      ) : (ledgerData?.entries || []).map((entry) => {
                        const isDebit = entry.type === 'DEBIT';
                        return (
                          <tr key={entry.id} className="group hover:bg-slate-50 transition-colors">
                            <td className="text-xs text-slate-500 whitespace-nowrap">{fmtDate(entry.createdAt)}</td>
                            <td className="text-sm text-slate-700">{entry.description || '—'}</td>
                            <td className="text-right">
                              {isDebit ? (
                                <span className="text-red-500 font-medium"><PrivacyValue value={fmt(entry.amount)} /></span>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="text-right">
                              {!isDebit ? (
                                <span className="text-emerald-600 font-medium"><PrivacyValue value={fmt(entry.amount)} /></span>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="text-right font-semibold text-slate-700"><PrivacyValue value={fmt(entry.balance)} /></td>
                            <td className="text-right py-1">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => openEditEntry(entry)} className="p-1.5 hover:bg-blue-100 hover:text-blue-600 rounded text-slate-400" title="Edit Entry"><Edit2 size={14}/></button>
                                <button onClick={() => setDeleteEntry(entry)} className="p-1.5 hover:bg-red-100 hover:text-red-600 rounded text-slate-400" title="Delete Entry"><Trash2 size={14}/></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {(ledgerData?.entries || []).length > 0 && (
                      <tfoot className="bg-slate-50">
                        <tr>
                          <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Closing Balance:</td>
                          <td className={`px-4 py-3 text-right text-sm font-bold ${Number(freshBalance) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            <PrivacyValue value={fmt(freshBalance)} />
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Manual Entry Modal */}
      {showEntryModal && selected && (
        <AddEntryModal
          entity={selected}
          type={tab === 'customers' ? 'customer' : 'supplier'}
          editEntry={editEntry}
          onClose={() => setShowEntryModal(false)}
          onSaved={() => { setShowEntryModal(false); loadLedger(selected); fetchEntities(); }}
        />
      )}

      {/* Delete Password Prompt */}
      {deleteEntry && selected && (
        <PasswordPromptModal
          title="Delete Ledger Entry"
          onClose={() => setDeleteEntry(null)}
          onConfirm={async (password) => {
             try {
               if (tab === 'customers') await ledgerAPI.deleteCustomerEntry(deleteEntry.id, password);
               else await ledgerAPI.deleteSupplierEntry(deleteEntry.id, password);
               toast.success('Entry deleted');
               setDeleteEntry(null);
               loadLedger(selected);
               fetchEntities();
             } catch (err) {}
          }}
        />
      )}
    </div>
  );
}

function AddEntryModal({ entity, type, editEntry, onClose, onSaved }) {
  const isEdit = !!editEntry;
  const [form, setForm] = useState(isEdit ? {
    entryType: editEntry.type, amount: editEntry.amount, description: editEntry.description, password: ''
  } : {
    entryType: 'CREDIT', amount: '', description: '', password: ''
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    if (!form.description) { toast.error('Description is required'); return; }
    if (isEdit && !form.password) { toast.error('Password is required to save edits'); return; }
    
    setSaving(true);
    try {
      if (isEdit) {
        if (type === 'customer') {
          await ledgerAPI.updateCustomerEntry(editEntry.id, { type: form.entryType, amount: Number(form.amount), description: form.description, password: form.password });
        } else {
          await ledgerAPI.updateSupplierEntry(editEntry.id, { type: form.entryType, amount: Number(form.amount), description: form.description, password: form.password });
        }
        toast.success('Entry updated');
      } else {
        if (type === 'customer') {
          await ledgerAPI.addCustomerEntry({ customerId: entity.id, type: form.entryType, amount: Number(form.amount), description: form.description });
        } else {
          await ledgerAPI.addSupplierEntry({ supplierId: entity.id, type: form.entryType, amount: Number(form.amount), description: form.description });
        }
        toast.success('Entry added');
      }
      onSaved();
    } catch { } finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">{isEdit ? 'Edit Entry' : 'Add Manual Entry'}</h2>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
          </div>
          <div className="p-5 space-y-4">
            <div className="bg-slate-50 rounded-xl p-3 text-sm">
              <span className="text-slate-500">Party:</span>
              <span className="font-semibold text-slate-700 ml-2">{entity.name}</span>
            </div>
            <div>
              <label className="label">Entry Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'CREDIT', label: type === 'customer' ? '✓ Payment Received' : '✗ Amount Owed', color: 'emerald' },
                  { value: 'DEBIT', label: type === 'customer' ? '✗ Amount Owed' : '✓ Payment Made', color: 'red' },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setForm({ ...form, entryType: opt.value })}
                    className={`py-2.5 rounded-lg text-xs font-medium border transition-all text-center
                      ${form.entryType === opt.value
                        ? opt.color === 'emerald' ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-red-50 border-red-400 text-red-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Amount (₹)</label>
              <input type="number" min="0.01" step="0.01"
                value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00" className="input text-lg font-semibold" autoFocus />
            </div>
            <div>
              <label className="label">Description</label>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Payment via NEFT, Adjustment..." className="input" />
            </div>
            {isEdit && (
              <div className="pt-2 border-t mt-4">
                <label className="label font-medium flex items-center gap-1.5 text-amber-600 mb-2"><Lock size={12}/> Confirm your password to save edits</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Account Password" className="input bg-amber-50 border-amber-200 focus:border-amber-400 focus:ring-amber-400/20" />
              </div>
            )}
          </div>
          <div className="px-5 pb-5 flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Entry'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function PasswordPromptModal({ title, onClose, onConfirm }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const handleConfirm = async () => {
    if(!password) { toast.error('Password required'); return; }
    setLoading(true);
    await onConfirm(password);
    setLoading(false);
  }
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2"><Lock size={16} className="text-red-500"/> {title}</h2>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
          </div>
          <div className="p-5">
            <p className="text-sm text-slate-500 mb-4">Please enter your account password to authorize this action.</p>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" autoFocus className="input border-red-200 focus:border-red-400 focus:ring-red-400/20" onKeyDown={e => e.key === 'Enter' && handleConfirm()} />
          </div>
          <div className="px-5 pb-5 flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleConfirm} disabled={loading} className="btn-primary bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700 flex-1 justify-center">
              {loading ? <Loader2 size={15} className="animate-spin" /> : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
