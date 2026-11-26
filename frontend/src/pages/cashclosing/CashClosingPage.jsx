import { useState, useEffect } from 'react';
import { cashClosingAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Loader2, CheckCircle2, AlertTriangle, Lock, History, IndianRupee } from 'lucide-react';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function CashClosingPage() {
  const [summary, setSummary] = useState(null);
  const [loadingSum, setLoadingSum] = useState(true);
  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [closings, setClosings] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [tab, setTab] = useState('close');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const fetchSummary = async () => {
    setLoadingSum(true);
    try {
      const res = await cashClosingAPI.summary({ date });
      setSummary(res.data);
      setActualCash(String(Number(res.data.cashSales || 0).toFixed(2)));
    } catch {} finally { setLoadingSum(false); }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await cashClosingAPI.list();
      setClosings(res.data.closings || []);
    } catch {} finally { setLoadingHistory(false); }
  };

  useEffect(() => { fetchSummary(); }, [date]);
  useEffect(() => { if (tab === 'history') fetchHistory(); }, [tab]);

  const handleSaveClosing = async () => {
    if (!actualCash) { toast.error('Enter actual cash amount'); return; }
    setSaving(true);
    try {
      await cashClosingAPI.save({
        closingDate: date,
        actualCash: Number(actualCash),
        expectedCash: summary?.cashSales || 0,
        totalCashSales: summary?.cashSales || 0,
        totalUpiSales: summary?.upiSales || 0,
        totalCardSales: summary?.cardSales || 0,
        totalCreditSales: summary?.creditSales || 0,
        notes,
      });
      toast.success('Day closed successfully!');
      fetchSummary();
    } catch {} finally { setSaving(false); }
  };

  const diff = Number(actualCash || 0) - Number(summary?.expectedCash || 0);

  return (
    <div className="max-w-3xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Daily Cash Closing</h1>
          <p className="page-subtitle">Verify cash drawer and close the day</p>
        </div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input w-40" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-5 w-fit">
        {[['close', 'Close Day', Lock], ['history', 'Closing History', History]].map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {tab === 'close' && (
        <>
          {loadingSum ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
          ) : summary ? (
            <div className="space-y-4">
              {/* Day Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Cash Sales', value: fmt(summary.cashSales), color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'UPI Sales', value: fmt(summary.upiSales), color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Card Sales', value: fmt(summary.cardSales), color: 'text-purple-600', bg: 'bg-purple-50' },
                  { label: 'Credit Sales', value: fmt(summary.creditSales), color: 'text-amber-600', bg: 'bg-amber-50' },
                ].map(s => (
                  <div key={s.label} className={`card p-4 ${s.bg}`}>
                    <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                    <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Cash Verification */}
              <div className="card p-5">
                <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><IndianRupee size={16} className="text-blue-600" /> Cash Drawer Verification</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Expected Cash</p>
                    <p className="text-2xl font-bold text-slate-800">{fmt(summary.expectedCash)}</p>
                  </div>
                  <div>
                    <label className="label">Actual Cash in Drawer (₹)</label>
                    <input type="number" min="0" step="0.01" value={actualCash} onChange={e => setActualCash(e.target.value)}
                      className="input text-xl font-bold" placeholder="0.00" />
                  </div>
                </div>

                {actualCash && (
                  <div className={`mt-4 rounded-xl p-4 flex items-center gap-3 ${diff === 0 ? 'bg-emerald-50 border border-emerald-200' : diff > 0 ? 'bg-blue-50 border border-blue-200' : 'bg-red-50 border border-red-200'}`}>
                    {diff === 0 ? <CheckCircle2 size={20} className="text-emerald-600" /> : <AlertTriangle size={20} className={diff > 0 ? 'text-blue-600' : 'text-red-500'} />}
                    <div>
                      <p className={`font-semibold ${diff === 0 ? 'text-emerald-700' : diff > 0 ? 'text-blue-700' : 'text-red-700'}`}>
                        {diff === 0 ? 'Cash matches perfectly!' : diff > 0 ? `Cash Excess: ${fmt(diff)}` : `Cash Short: ${fmt(Math.abs(diff))}`}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{diff !== 0 && 'Please recount and verify before closing.'}</p>
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <label className="label">Closing Notes (optional)</label>
                  <input value={notes} onChange={e => setNotes(e.target.value)} className="input" placeholder="e.g. Cash counted by Ravi" />
                </div>

                <button onClick={handleSaveClosing} disabled={saving} className="btn-primary btn-lg w-full justify-center mt-5 rounded-xl">
                  {saving ? <><Loader2 size={18} className="animate-spin" /> Closing...</> : <><Lock size={18} /> Close Day & Save</>}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {tab === 'history' && (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="text-right">Expected</th>
                  <th className="text-right">Actual</th>
                  <th className="text-right">Difference</th>
                  <th className="text-right">UPI</th>
                  <th className="text-right">Card</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {loadingHistory ? (
                  <tr><td colSpan={7} className="text-center py-10"><Loader2 size={24} className="animate-spin text-blue-500 mx-auto" /></td></tr>
                ) : closings.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-slate-400"><History size={32} strokeWidth={1} className="mx-auto mb-2" /><p>No closing records yet</p></td></tr>
                ) : closings.map(c => (
                  <tr key={c.id}>
                    <td className="text-sm">{format(new Date(c.closingDate), 'dd MMM yyyy')}</td>
                    <td className="text-right">{fmt(c.expectedCash)}</td>
                    <td className="text-right font-semibold">{fmt(c.actualCash)}</td>
                    <td className="text-right">
                      <span className={Number(c.difference) === 0 ? 'text-emerald-600' : Number(c.difference) > 0 ? 'text-blue-600' : 'text-red-600'}>
                        {Number(c.difference) >= 0 ? '+' : ''}{fmt(c.difference)}
                      </span>
                    </td>
                    <td className="text-right text-blue-600">{fmt(c.totalUpiSales)}</td>
                    <td className="text-right text-purple-600">{fmt(c.totalCardSales)}</td>
                    <td className="text-slate-500 text-xs">{c.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
