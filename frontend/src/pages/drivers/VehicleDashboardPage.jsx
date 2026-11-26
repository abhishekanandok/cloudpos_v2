import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck, ArrowLeft, ArrowDown, ArrowUp, ShoppingCart,
  IndianRupee, Users, Calendar, Loader2, Package, TrendingUp,
} from 'lucide-react';
import { driversAPI } from '../../utils/api';
import { format, startOfMonth, subDays } from 'date-fns';

const fmt  = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtN = (n) => Number(n || 0).toLocaleString('en-IN');

const DATE_PRESETS = [
  { label: 'Today',      days: 0 },
  { label: '7 Days',     days: 7 },
  { label: '30 Days',    days: 30 },
  { label: 'This Month', days: -1 },
];

export default function VehicleDashboardPage() {
  const navigate = useNavigate();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate,   setEndDate]   = useState(today);
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await driversAPI.dashboard({ startDate, endDate });
      setData(res.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [startDate, endDate]);

  const applyPreset = ({ days }) => {
    if (days === -1) {
      setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
      setEndDate(today);
    } else if (days === 0) {
      setStartDate(today); setEndDate(today);
    } else {
      setStartDate(format(subDays(new Date(), days), 'yyyy-MM-dd'));
      setEndDate(today);
    }
  };

  const s = data?.summary;

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/drivers')} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="page-title flex items-center gap-2"><Truck size={20} className="text-blue-600" /> Vehicle Dashboard</h1>
          <p className="page-subtitle">Overall vehicle sales performance</p>
        </div>
      </div>

      {/* Date filters */}
      <div className="card p-4 mb-5 space-y-3">
        <div className="flex flex-wrap gap-2">
          {DATE_PRESETS.map(p => (
            <button key={p.label} onClick={() => applyPreset(p)} className="btn-secondary btn-sm">{p.label}</button>
          ))}
          <div className="flex items-center gap-2 ml-auto">
            <Calendar size={14} className="text-slate-400" />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input w-36 text-sm" />
            <span className="text-slate-400">to</span>
            <input type="date" value={endDate}   onChange={e => setEndDate(e.target.value)}   className="input w-36 text-sm" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card py-20 flex justify-center"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Active Drivers',   value: fmtN(s?.activeDrivers), icon: Users,       color: 'text-blue-600',   bg: 'bg-blue-50' },
              { label: 'Total Loaded',     value: `${fmtN(s?.totalLoaded)} units`, icon: ArrowDown, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { label: 'Total Sales',      value: fmt(s?.totalSales),     icon: TrendingUp,  color: 'text-emerald-600',bg: 'bg-emerald-50' },
              { label: 'Cash Collected',   value: fmt(s?.totalCollected), icon: IndianRupee, color: 'text-blue-600',   bg: 'bg-blue-50' },
              { label: 'Credit Outstanding', value: fmt(s?.totalCredit), icon: ShoppingCart, color: 'text-amber-600',  bg: 'bg-amber-50' },
              { label: 'Total Bills',      value: fmtN(s?.totalBills),    icon: Package,     color: 'text-violet-600', bg: 'bg-violet-50' },
              { label: 'Unloaded (Return)', value: `${fmtN(s?.totalUnloaded)} units`, icon: ArrowUp, color: 'text-slate-600', bg: 'bg-slate-50' },
              { label: 'Net Vehicle Sales', value: fmt((s?.totalSales || 0) - (s?.totalCredit || 0)), icon: IndianRupee, color: 'text-emerald-700', bg: 'bg-emerald-50' },
            ].map(c => (
              <div key={c.label} className="card p-4 flex items-center gap-3">
                <div className={`${c.bg} p-2.5 rounded-xl shrink-0`}><c.icon size={18} className={c.color} /></div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{c.label}</p>
                  <p className={`text-sm font-bold ${c.color} truncate`}>{c.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Per-Driver Table */}
          <div className="card overflow-hidden mb-5">
            <div className="card-header">
              <h3 className="font-semibold text-sm text-slate-700">Driver Performance</h3>
              <span className="text-xs text-slate-400">{data?.drivers?.length || 0} drivers</span>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Driver</th>
                    <th>Vehicle</th>
                    <th className="text-center">Bills</th>
                    <th className="text-right">Total Sales</th>
                    <th className="text-right">Collected</th>
                    <th className="text-right">Credit Due</th>
                    <th>Vehicle Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.drivers || []).length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-slate-400">No data</td></tr>
                  ) : (data?.drivers || []).map(d => (
                    <tr key={d.id}>
                      <td>
                        <div className="font-medium">{d.name}</div>
                      </td>
                      <td><span className={d.vehicle ? 'badge-blue' : 'text-slate-300'}>{d.vehicle || '—'}</span></td>
                      <td className="text-center"><span className="badge-slate">{d.totalBills}</span></td>
                      <td className="text-right font-semibold">{fmt(d.totalSales)}</td>
                      <td className="text-right text-emerald-600 font-semibold">{fmt(d.totalCollected)}</td>
                      <td className="text-right">
                        {d.totalCredit > 0
                          ? <span className="text-amber-600 font-semibold">{fmt(d.totalCredit)}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td>
                        {d.vehicleStock?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {d.vehicleStock.slice(0, 4).map(vs => (
                              <span key={vs.name} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                {vs.name}: <b>{vs.qty}</b>
                              </span>
                            ))}
                            {d.vehicleStock.length > 4 && (
                              <span className="text-xs text-slate-400">+{d.vehicleStock.length - 4} more</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">No stock</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {(data?.drivers || []).length > 1 && (
                  <tfoot className="bg-slate-50 font-bold text-sm">
                    <tr>
                      <td colSpan={2} className="px-4 py-3">TOTAL</td>
                      <td className="text-center px-4">{fmtN(s?.totalBills)}</td>
                      <td className="text-right px-4">{fmt(s?.totalSales)}</td>
                      <td className="text-right px-4 text-emerald-700">{fmt(s?.totalCollected)}</td>
                      <td className="text-right px-4 text-amber-600">{fmt(s?.totalCredit)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Quick Tips */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { title: 'Stock Flow', desc: 'Shop Stock → Vehicle Load → Vehicle Sale → Unload to Shop', icon: ArrowDown, color: 'text-blue-600' },
              { title: 'Credit Control', desc: 'Monitor credit column — high credit means payment collection needed', icon: IndianRupee, color: 'text-amber-600' },
              { title: 'Settlement', desc: 'Click Settlement on a driver from /drivers page for trip-wise breakdown', icon: Package, color: 'text-emerald-600' },
            ].map(t => (
              <div key={t.title} className="card p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <t.icon size={15} className={t.color} />
                  <p className="font-semibold text-sm text-slate-700">{t.title}</p>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
