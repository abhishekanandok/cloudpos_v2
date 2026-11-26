import { useState, useEffect } from 'react';
import {
  Trophy, TrendingUp, Package, ShoppingCart, Download,
  Calendar, Loader2, Filter, ArrowUpDown, Truck, BarChart2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { reportsAPI, categoriesAPI, branchesAPI } from '../../utils/api';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

const fmt  = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtN = (n) => Number(n || 0).toLocaleString('en-IN');

const RANK_COLORS = ['#f59e0b', '#94a3b8', '#cd7c2e'];  // gold, silver, bronze
const BAR_COLORS  = ['#3b82f6','#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16'];

const MEDAL = ['🥇','🥈','🥉'];

const DATE_PRESETS = [
  { label: 'Today',      days: 0 },
  { label: '7 Days',     days: 7 },
  { label: '30 Days',    days: 30 },
  { label: 'This Month', days: -1 },
];

const LIMIT_OPTIONS = [10, 20, 50];
const SORT_OPTIONS  = [
  { value: 'revenue', label: 'Top Revenue' },
  { value: 'qty',     label: 'Top Quantity' },
];

export default function BestSellingPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate,   setEndDate]   = useState(today);

  const [categoryId,   setCategoryId]   = useState('');
  const [branchId,     setBranchId]     = useState('');
  const [vehicleOnly,  setVehicleOnly]  = useState(false);
  const [sortBy,       setSortBy]       = useState('revenue');
  const [limit,        setLimit]        = useState(20);

  const [products, setProducts]   = useState([]);
  const [summary,  setSummary]    = useState(null);
  const [loading,  setLoading]    = useState(true);

  const [categories, setCategories] = useState([]);
  const [branches,   setBranches]   = useState([]);

  // Load dropdowns once
  useEffect(() => {
    categoriesAPI.list().then(r => setCategories(r.data || [])).catch(() => {});
    branchesAPI.list().then(r => setBranches(r.data || [])).catch(() => {});
  }, []);

  // Fetch report
  useEffect(() => { fetchReport(); }, [startDate, endDate, categoryId, branchId, vehicleOnly, sortBy, limit]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = { startDate, endDate, sortBy, limit };
      if (categoryId)  params.categoryId  = categoryId;
      if (branchId)    params.branchId    = branchId;
      if (vehicleOnly) params.vehicleOnly = 'true';

      const res = await reportsAPI.bestSelling(params);
      setProducts(res.data?.products || []);
      setSummary(res.data?.summary   || null);
    } catch (e) {
      setProducts([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = ({ days }) => {
    if (days === -1) {
      setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    } else if (days === 0) {
      setStartDate(today); setEndDate(today);
    } else {
      setStartDate(format(subDays(new Date(), days), 'yyyy-MM-dd'));
      setEndDate(today);
    }
  };

  const exportCSV = () => {
    if (!products.length) return;
    const rows = products.map(p => ({
      Rank: p.rank,
      Product: p.name,
      Category: p.categoryName || '—',
      'Qty Sold': p.totalQty,
      'Revenue (₹)': p.totalRevenue,
      Orders: p.totalOrders,
      'Revenue Share %': p.revenueShare,
      'Qty Share %': p.qtyShare,
    }));
    const keys = Object.keys(rows[0]);
    const csv  = [keys.join(','), ...rows.map(r => keys.map(k => `"${r[k] ?? ''}"`).join(','))].join('\n');
    const url  = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: `best-selling-${startDate}-to-${endDate}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  const chartData = products.slice(0, 10).map(p => ({
    name:    p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name,
    value:   sortBy === 'qty' ? p.totalQty : p.totalRevenue,
    share:   sortBy === 'qty' ? p.qtyShare : p.revenueShare,
  }));

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Trophy size={22} className="text-amber-500" /> Best Selling Products
          </h1>
          <p className="page-subtitle">Ranked report by sales performance</p>
        </div>
        <button onClick={exportCSV} disabled={!products.length} className="btn-secondary gap-2">
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 space-y-3">
        {/* Date presets + range */}
        <div className="flex flex-wrap items-center gap-2">
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

        {/* Secondary filters */}
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-100">
          <Filter size={14} className="text-slate-400" />

          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="input w-44 text-sm">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {branches.length > 0 && (
            <select value={branchId} onChange={e => setBranchId(e.target.value)} className="input w-44 text-sm">
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}

          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input w-40 text-sm">
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <select value={limit} onChange={e => setLimit(Number(e.target.value))} className="input w-28 text-sm">
            {LIMIT_OPTIONS.map(l => <option key={l} value={l}>Top {l}</option>)}
          </select>

          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={vehicleOnly}
              onChange={e => setVehicleOnly(e.target.checked)}
              className="rounded"
            />
            <Truck size={14} /> Vehicle Sales Only
          </label>
        </div>
      </div>

      {loading ? (
        <div className="card py-20 flex justify-center">
          <Loader2 size={30} className="animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Products Ranked',   value: fmtN(summary.totalProducts), icon: Package,      color: 'text-blue-600',   bg: 'bg-blue-50' },
                { label: 'Total Qty Sold',     value: fmtN(summary.totalQty),     icon: ArrowUpDown,  color: 'text-violet-600', bg: 'bg-violet-50' },
                { label: 'Total Revenue',      value: fmt(summary.totalRevenue),  icon: TrendingUp,   color: 'text-emerald-600',bg: 'bg-emerald-50' },
                { label: 'Top Product',        value: summary.topProduct || '—',  icon: Trophy,       color: 'text-amber-600',  bg: 'bg-amber-50' },
              ].map(s => (
                <div key={s.label} className="card p-4 flex items-center gap-3">
                  <div className={`${s.bg} p-2.5 rounded-xl shrink-0`}><s.icon size={18} className={s.color} /></div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">{s.label}</p>
                    <p className={`text-base font-bold ${s.color} truncate`}>{s.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {products.length === 0 ? (
            <div className="card py-20 text-center text-slate-400">
              <BarChart2 size={40} strokeWidth={1} className="mx-auto mb-3" />
              <p className="font-semibold text-slate-600">No sales data found</p>
              <p className="text-sm mt-1">Try a different date range or filters</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Bar Chart — Top 10 */}
              <div className="card">
                <div className="card-header">
                  <h3 className="font-semibold text-sm text-slate-700">
                    Top {Math.min(10, products.length)} Products — {sortBy === 'qty' ? 'Qty Sold' : 'Revenue'}
                  </h3>
                </div>
                <div className="p-5">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                        tickFormatter={v => sortBy === 'qty' ? fmtN(v) : `₹${(v/1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(v, n, props) => [
                          sortBy === 'qty' ? `${fmtN(v)} units` : fmt(v),
                          sortBy === 'qty' ? 'Qty Sold' : 'Revenue'
                        ]}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
                        {chartData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Rank Table */}
              <div className="card overflow-hidden">
                <div className="card-header">
                  <h3 className="font-semibold text-sm text-slate-700">Full Rankings</h3>
                  <span className="text-xs text-slate-400">{products.length} products</span>
                </div>
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="w-12">#</th>
                        <th>Product</th>
                        <th>Category</th>
                        <th className="text-right">Qty Sold</th>
                        <th className="text-right">Revenue</th>
                        <th className="text-right">Orders</th>
                        <th className="text-right">
                          {sortBy === 'qty' ? 'Qty Share' : 'Rev Share'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => {
                        const share = sortBy === 'qty' ? Number(p.qtyShare) : Number(p.revenueShare);
                        const isTop3 = p.rank <= 3;
                        return (
                          <tr key={p.id} className={isTop3 ? 'bg-amber-50/30' : ''}>
                            <td>
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold
                                ${p.rank === 1 ? 'bg-amber-100 text-amber-700' :
                                  p.rank === 2 ? 'bg-slate-100 text-slate-600' :
                                  p.rank === 3 ? 'bg-orange-100 text-orange-700' :
                                  'text-slate-400'}`}>
                                {p.rank <= 3 ? MEDAL[p.rank - 1] : p.rank}
                              </span>
                            </td>
                            <td>
                              <div className="font-medium text-slate-800">{p.name}</div>
                              {p.barcode && <div className="text-xs text-slate-400 font-mono">{p.barcode}</div>}
                            </td>
                            <td>
                              <span className="badge-slate text-xs">{p.categoryName || '—'}</span>
                            </td>
                            <td className="text-right font-semibold">{fmtN(p.totalQty)} <span className="text-xs font-normal text-slate-400">{p.unitType}</span></td>
                            <td className="text-right font-semibold text-blue-600">{fmt(p.totalRevenue)}</td>
                            <td className="text-right text-slate-500">{fmtN(p.totalOrders)}</td>
                            <td className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(share, 100)}%` }} />
                                </div>
                                <span className="text-xs text-slate-500 w-10 text-right">{share}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
