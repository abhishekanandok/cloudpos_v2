import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Users, Loader2, Check, X, Eye, EyeOff, BarChart3, IndianRupee } from 'lucide-react';
import { salesmenAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

function SalesmanModal({ salesman, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: salesman?.name || '',
    mobile: salesman?.mobile || '',
    loginId: salesman?.loginId || '',
    password: '',
    type: salesman?.type || 'STAFF',
  });
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSave = async () => {
    if (!form.name || !form.loginId) { toast.error('Name and Login ID required'); return; }
    if (!salesman && !form.password) { toast.error('Password required'); return; }
    setSaving(true);
    try {
      if (salesman) {
        await salesmenAPI.update(salesman.id, form);
        toast.success('Salesman updated');
      } else {
        await salesmenAPI.create(form);
        toast.success('Salesman created');
      }
      onSaved();
    } catch {} finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">{salesman ? 'Edit Salesman' : 'Add Salesman'}</h2>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="label">Salesman Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="input" placeholder="e.g. Ravi Kumar" />
            </div>
            <div>
              <label className="label">Mobile</label>
              <input value={form.mobile} onChange={e => setForm(f => ({...f, mobile: e.target.value}))} className="input" placeholder="9876543210" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Login ID *</label>
                <input value={form.loginId} onChange={e => setForm(f => ({...f, loginId: e.target.value}))} className="input" placeholder="ravi_sales" disabled={!!salesman} />
              </div>
              <div>
                <label className="label">Type</label>
                <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))} className="input">
                  <option value="STAFF">Staff</option>
                  <option value="RESELLER">Reseller</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">{salesman ? 'New Password (leave blank to keep)' : 'Password *'}</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} className="input pr-10" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>
          <div className="px-6 pb-6 flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ReportModal({ onClose }) {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await salesmenAPI.report({ startDate: dateFrom, endDate: dateTo });
      setReport(res.data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchReport(); }, []);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Salesman Performance Report</h2>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
          </div>
          <div className="p-4 border-b border-slate-100 flex gap-3 flex-wrap">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input w-36" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input w-36" />
            <button onClick={fetchReport} className="btn-primary">Apply</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
            ) : report.length === 0 ? (
              <div className="text-center py-16 text-slate-400"><BarChart3 size={36} strokeWidth={1} className="mx-auto mb-2" /><p>No data found</p></div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Salesman</th>
                    <th>Type</th>
                    <th className="text-center">Bills</th>
                    <th className="text-right">Total Sales</th>
                    <th className="text-right">Collected</th>
                    <th className="text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((r, i) => (
                    <tr key={r.id}>
                      <td className="text-slate-400">{i + 1}</td>
                      <td><div className="font-medium">{r.name}</div><div className="text-xs text-slate-400">{r.loginId}</div></td>
                      <td><span className={r.type === 'RESELLER' ? 'badge-yellow' : 'badge-blue'}>{r.type}</span></td>
                      <td className="text-center">{r.totalBills}</td>
                      <td className="text-right font-semibold">{fmt(r.totalSales)}</td>
                      <td className="text-right text-emerald-600">{fmt(r.totalCollected)}</td>
                      <td className="text-right text-amber-600">{r.totalCredit > 0 ? fmt(r.totalCredit) : <span className="text-slate-300">—</span>}</td>
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

export default function SalesmenPage() {
  const [salesmen, setSalesmen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editSalesman, setEditSalesman] = useState(null);
  const [showReport, setShowReport] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try { const res = await salesmenAPI.list(); setSalesmen(res.data || []); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const handleDelete = async (id, name) => {
    if (!confirm(`Deactivate salesman "${name}"?`)) return;
    try { await salesmenAPI.delete(id); toast.success('Salesman deactivated'); fetch(); }
    catch {}
  };

  return (
    <div className="max-w-4xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Salesmen</h1>
          <p className="page-subtitle">Manage sales staff and reseller accounts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowReport(true)} className="btn-secondary gap-1"><BarChart3 size={15} /> Report</button>
          <button onClick={() => { setEditSalesman(null); setShowModal(true); }} className="btn-primary"><Plus size={16} /> Add Salesman</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Salesman</th>
                <th>Login ID</th>
                <th>Type</th>
                <th className="text-center">Total Bills</th>
                <th>Mobile</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-14"><Loader2 size={24} className="animate-spin text-blue-500 mx-auto" /></td></tr>
              ) : salesmen.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-14 text-slate-400">
                  <Users size={36} strokeWidth={1} className="mx-auto mb-2" /><p>No salesmen yet</p>
                </td></tr>
              ) : salesmen.map(s => (
                <tr key={s.id}>
                  <td><div className="font-medium">{s.name}</div></td>
                  <td><span className="font-mono text-sm text-blue-600">{s.loginId}</span></td>
                  <td><span className={s.type === 'RESELLER' ? 'badge-yellow' : 'badge-blue'}>{s.type}</span></td>
                  <td className="text-center"><span className="badge-slate">{s._count?.sales || 0}</span></td>
                  <td className="text-slate-500 text-sm">{s.mobile || '—'}</td>
                  <td>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setEditSalesman(s); setShowModal(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(s.id, s.name)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <SalesmanModal salesman={editSalesman} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetch(); }} />}
      {showReport && <ReportModal onClose={() => setShowReport(false)} />}
    </div>
  );
}
