import { useState, useEffect } from 'react';
import {
  BarChart2, TrendingUp, Package, ShoppingCart, Download,
  Calendar, ArrowUp, ArrowDown, IndianRupee, FileText
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { reportsAPI } from '../../utils/api';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import PrivacyValue from '../../components/PrivacyValue';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtK = (n) => Number(n) >= 1000 ? `₹${(Number(n) / 1000).toFixed(0)}k` : `₹${Number(n).toFixed(0)}`;

const TABS = [
  { id: 'sales', label: 'Sales', icon: ShoppingCart },
  { id: 'profit', label: 'Profit', icon: TrendingUp },
  { id: 'stock', label: 'Stock', icon: Package },
  { id: 'purchases', label: 'Purchases', icon: FileText },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('sales');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [monthlyData, setMonthlyData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [profitData, setProfitData] = useState(null);
  const [stockData, setStockData] = useState({ products: [], totalStockValue: 0 });
  const [paymentData, setPaymentData] = useState([]);
  const [summary, setSummary] = useState({ revenue: 0, collected: 0, credit: 0, gst: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const [monthly, top, profit, stock, sales] = await Promise.all([
          reportsAPI.monthlySales(), reportsAPI.topProducts({ startDate, endDate }),
          reportsAPI.profit({ startDate, endDate }), reportsAPI.stock(),
          reportsAPI.dailySales({ startDate, endDate })
        ]);
        if (monthly.data?.length) setMonthlyData(monthly.data);
        // Backend now returns { products, summary } — handle both old array and new object format
        const topData = top.data?.products || (Array.isArray(top.data) ? top.data : []);
        if (topData.length) setTopProducts(topData);
        if (profit.data) setProfitData(profit.data);
        if (stock.data?.products) setStockData(stock.data);
        
        if (sales.data) {
          const s = sales.data.summary || {};
          setSummary({
            revenue: s.grandTotal || 0,
            collected: s.paidAmount || 0,
            credit: s.balanceAmount || 0,
            gst: s.totalGst || 0
          });
          if (sales.data.paymentBreakdown) {
            setPaymentData(sales.data.paymentBreakdown.map(p => ({
              name: p.paymentMode,
              value: p._sum?.paidAmount || p._sum?.amount || 0
            })));
          }
        }
      } catch (err) {
        console.error('Failed to load reports:', err);
      }
    };
    load();
  }, [startDate, endDate]);

  const exportCSV = (data, filename) => {
    if (!data?.length) return;
    const keys = Object.keys(data[0]);
    const csv = [keys.join(','), ...data.map(row => keys.map(k => `"${row[k] ?? ''}"`).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: filename }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Reports</h1><p className="page-subtitle">Detailed analysis of your business</p></div>
        <button onClick={() => exportCSV(topProducts, 'report.csv')} className="btn-secondary gap-2">
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Date Filter */}
      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {[['Today', 0], ['7 Days', 7], ['30 Days', 30]].map(([label, days]) => (
            <button key={label} onClick={() => {
              const d = days === 0 ? new Date() : subDays(new Date(), days);
              setStartDate(format(d, 'yyyy-MM-dd')); setEndDate(format(new Date(), 'yyyy-MM-dd'));
            }} className="btn-secondary btn-sm">{label}</button>
          ))}
          <button onClick={() => { setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd')); setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd')); }}
            className="btn-secondary btn-sm">This Month</button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Calendar size={14} className="text-slate-400" />
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input w-36 text-sm" />
          <span className="text-slate-400">to</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input w-36 text-sm" />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Revenue', value: fmt(summary.revenue), icon: IndianRupee, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Collected', value: fmt(summary.collected), icon: ArrowDown, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Credit Out', value: fmt(summary.credit), icon: ArrowUp, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Total GST', value: fmt(summary.gst), icon: BarChart2, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`${s.bg} p-2.5 rounded-xl`}><s.icon size={18} className={s.color} /></div>
            <div><p className="text-xs text-slate-500">{s.label}</p><p className={`text-lg font-bold ${s.color}`}><PrivacyValue value={s.value} /></p></div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {activeTab === 'sales' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="card xl:col-span-2">
            <div className="card-header"><h3 className="font-semibold text-sm text-slate-700">Monthly Revenue</h3></div>
            <div className="p-5">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyData}>
                  <defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="monthName" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
                  <Tooltip formatter={v => [fmt(v), 'Revenue']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#rev)" dot={{ fill: '#3b82f6', r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h3 className="font-semibold text-sm text-slate-700">Payment Modes</h3></div>
            <div className="p-5">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={paymentData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={v => [`${v}%`, '']} />
                  <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize: 11 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card xl:col-span-3">
            <div className="card-header">
              <h3 className="font-semibold text-sm text-slate-700">Top Selling Products</h3>
              <button onClick={() => exportCSV(topProducts, 'top-products.csv')} className="btn-secondary btn-sm gap-1"><Download size={12} />Export</button>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>#</th><th>Product</th><th className="text-right">Qty Sold</th><th className="text-right">Revenue</th></tr></thead>
                <tbody>
                  {topProducts.map((p, i) => (
                    <tr key={i}><td className="text-slate-400">{i + 1}</td><td className="font-medium">{p.name}</td>
                      <td className="text-right">{Number(p.totalQty || 0).toLocaleString('en-IN')}</td>
                      <td className="text-right font-semibold text-blue-600"><PrivacyValue value={fmt(p.totalRevenue)} /></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'profit' && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <h3 className="font-semibold text-sm text-slate-700">Profit Analysis</h3>
            <button onClick={() => exportCSV(profitData?.items || topProducts, 'profit.csv')} className="btn-secondary btn-sm gap-1"><Download size={12} />Export</button>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Product</th><th className="text-right">Revenue</th><th className="text-right">Cost</th><th className="text-right">Profit</th><th className="text-right">Margin</th></tr></thead>
              <tbody>
                {(profitData?.items || topProducts).map((p, i) => {
                  const revenue = Number(p.totalRevenue || p.revenue || 0);
                  const cost = Number(p.costOfGoods || revenue * 0.7);
                  const profit = Number(p.grossProfit || revenue - cost);
                  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;
                  return (
                    <tr key={i}><td className="font-medium">{p.productName || p.name}</td>
                      <td className="text-right"><PrivacyValue value={fmt(revenue)} /></td>
                      <td className="text-right text-slate-500"><PrivacyValue value={fmt(cost)} /></td>
                      <td className="text-right font-semibold text-emerald-600"><PrivacyValue value={fmt(profit)} /></td>
                      <td className="text-right"><span className={`badge ${Number(margin) >= 20 ? 'badge-green' : Number(margin) >= 10 ? 'badge-yellow' : 'badge-red'}`}>{margin}%</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'stock' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: 'Total Products', value: stockData.products?.length || 0 },
              { label: 'Stock Value', value: <PrivacyValue value={fmt(stockData.totalStockValue)} /> },
              { label: 'Low Stock', value: stockData.products?.filter(p => Number(p.currentStock) <= Number(p.minStockAlert) && Number(p.minStockAlert) > 0).length || 0 },
              { label: 'Out of Stock', value: stockData.products?.filter(p => Number(p.currentStock) === 0).length || 0 },
            ].map(s => (
              <div key={s.label} className="card p-4"><p className="text-xs text-slate-500">{s.label}</p><p className="text-xl font-bold text-slate-700 mt-1">{s.value}</p></div>
            ))}
          </div>
          <div className="card overflow-hidden">
            <div className="card-header">
              <h3 className="font-semibold text-sm text-slate-700">Stock Report</h3>
              <button onClick={() => exportCSV(stockData.products, 'stock-report.csv')} className="btn-secondary btn-sm gap-1"><Download size={12} />Export</button>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Product</th><th className="text-right">Stock</th><th className="text-right">Min Alert</th><th className="text-right">Value</th><th className="text-center">Status</th></tr></thead>
                <tbody>
                  {(stockData.products || []).map(p => {
                    const isLow = Number(p.minStockAlert) > 0 && Number(p.currentStock) <= Number(p.minStockAlert);
                    const isOut = Number(p.currentStock) === 0;
                    return (
                      <tr key={p.id}><td className="font-medium">{p.name}</td>
                        <td className="text-right font-semibold">{Number(p.currentStock)}</td>
                        <td className="text-right text-slate-400">{Number(p.minStockAlert)}</td>
                        <td className="text-right"><PrivacyValue value={fmt(Number(p.currentStock) * Number(p.purchasePrice))} /></td>
                        <td className="text-center"><span className={isOut ? 'badge-red' : isLow ? 'badge-yellow' : 'badge-green'}>{isOut ? 'Out of Stock' : isLow ? 'Low' : 'OK'}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'purchases' && (
        <div className="card p-10 text-center text-slate-400">
          <FileText size={40} strokeWidth={1} className="mx-auto mb-3" />
          <p className="font-semibold text-slate-600 text-lg">Purchase Report</p>
          <p className="text-sm mt-1">Set date range above and data loads from backend.</p>
        </div>
      )}
    </div>
  );
}
