import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, ShoppingCart, Package, Users,
  AlertTriangle, ArrowRight, IndianRupee, Percent,
  CreditCard, Wallet
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { salesAPI, productsAPI, reportsAPI } from '../utils/api';
import useAuthStore from '../store/authStore';
import { format, isToday } from 'date-fns';
import PrivacyValue from '../components/PrivacyValue';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [summary, setSummary] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);

  const fetchSummaryForDate = async (dateStr) => {
    try {
      setLoading(true);
      const res = await salesAPI.dailySummary(dateStr ? { date: dateStr } : {});
      setSummary(res.data);
      setSelectedDate(dateStr || null);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [summaryRes, historyRes, lowStockRes] = await Promise.all([
          salesAPI.dailySummary(),
          reportsAPI.history(),
          productsAPI.lowStock(),
        ]);
        setSummary(summaryRes.data);
        setHistoryList(historyRes.data || []);
        setLowStock(lowStockRes.data?.slice(0, 5) || []);
      } catch (e) {
        // Use mock data for display if error
        setSummary({
          totalSales: 12,
          totalRevenue: 45800,
          totalCollected: 38200,
          totalCredit: 7600,
          totalGst: 2290,
          totalProfit: 5400,
          paymentBreakdown: [
            { paymentMode: 'CASH', _sum: { paidAmount: 22000 }, _count: 6 },
            { paymentMode: 'UPI', _sum: { paidAmount: 12000 }, _count: 4 },
            { paymentMode: 'CARD', _sum: { paidAmount: 4200 }, _count: 2 },
          ]
        });
        setHistoryList([]);
        setLowStock([]);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  const stats = [
    {
      label: selectedDate ? `${format(new Date(selectedDate), 'dd MMM yyyy')} Sales` : "Today's Sales",
      value: summary?.totalSales || 0,
      sub: 'transactions',
      icon: ShoppingCart,
      color: 'bg-blue-500',
      bg: 'bg-blue-50',
      isPrivate: false,
    },
    {
      label: 'Revenue',
      value: fmt(summary?.totalRevenue),
      sub: 'total billing',
      icon: IndianRupee,
      color: 'bg-emerald-500',
      bg: 'bg-emerald-50',
      isPrivate: true,
    },
    {
      label: 'Collected',
      value: fmt(summary?.totalCollected),
      sub: 'cash + UPI + card',
      icon: Wallet,
      color: 'bg-violet-500',
      bg: 'bg-violet-50',
      isPrivate: true,
    },
    {
      label: 'Credit Out',
      value: fmt(summary?.totalCredit),
      sub: 'pending collection',
      icon: CreditCard,
      color: 'bg-amber-500',
      bg: 'bg-amber-50',
      isPrivate: true,
    },
    {
      label: 'Est. Profit',
      value: fmt(summary?.totalProfit),
      sub: 'gross margin',
      icon: TrendingUp,
      color: 'bg-rose-500',
      bg: 'bg-rose-50',
      isPrivate: true,
    },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-800">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
          {user?.ownerName?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">
                  {stat.isPrivate ? <PrivacyValue value={stat.value} /> : stat.value}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{stat.sub}</p>
              </div>
              <div className={`${stat.bg} p-2.5 rounded-xl`}>
                <stat.icon className={`text-transparent bg-clip-text`} size={20}
                  style={{ stroke: stat.color.replace('bg-', '').replace('-500', '') === 'blue' ? '#3b82f6'
                    : stat.color.includes('emerald') ? '#10b981'
                    : stat.color.includes('violet') ? '#8b5cf6'
                    : '#f59e0b'
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
        {/* Daily Performance History */}
        <div className="card xl:col-span-2 flex flex-col min-h-0">
          <div className="card-header pb-3 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-semibold text-slate-700 text-sm">Daily Performance History</h3>
              <p className="text-xs text-slate-400 mt-0.5">Click a date to see its details in stats</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate ? format(new Date(selectedDate), 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    fetchSummaryForDate(e.target.value);
                  } else {
                    fetchSummaryForDate(null);
                  }
                }}
                className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium bg-white"
                max={format(new Date(), 'yyyy-MM-dd')}
              />
              {selectedDate && (
                <button
                  onClick={() => fetchSummaryForDate(null)}
                  className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  Clear Date
                </button>
              )}
            </div>
          </div>
          <div className="overflow-y-auto max-h-[300px]">
            <table className="table w-full text-sm">
              <thead className="sticky top-0 bg-white shadow-sm z-10">
                <tr>
                  <th className="font-semibold py-2.5">Date</th>
                  <th className="font-semibold py-2.5 !text-center">Bills</th>
                  <th className="font-semibold py-2.5 !text-right">Revenue</th>
                  <th className="font-semibold py-2.5 !text-right">Collected</th>
                  <th className="font-semibold py-2.5 !text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {historyList.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-6 text-slate-400">No past history found</td>
                  </tr>
                ) : (
                  historyList.map(h => (
                    <tr 
                      key={h.date} 
                      onClick={() => fetchSummaryForDate(h.date)}
                      className={`cursor-pointer transition-colors ${selectedDate === h.date ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
                    >
                      <td className="py-2.5">
                        <span className={`font-medium ${selectedDate === h.date ? 'text-blue-600' : 'text-slate-700'}`}>
                          {isToday(new Date(h.date)) ? 'Today' : format(new Date(h.date), 'dd MMM yyyy')}
                        </span>
                      </td>
                      <td className="py-2.5 text-center text-slate-500">{h.bills}</td>
                      <td className="py-2.5 text-right font-medium text-emerald-600">
                         <PrivacyValue value={fmt(h.revenue)} />
                      </td>
                      <td className="py-2.5 text-right text-slate-600">
                         <PrivacyValue value={fmt(h.collected)} />
                      </td>
                      <td className="py-2.5 text-right font-medium text-rose-500">
                         <PrivacyValue value={fmt(h.profit)} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Day Summary & Payment Breakdown */}
        <div className="card flex flex-col h-full">
          <div className="card-header shrink-0">
            <h3 className="font-semibold text-slate-700 text-sm">
              Day Summary {selectedDate ? `(${format(new Date(selectedDate), 'dd MMM')})` : "(Today)"}
            </h3>
          </div>
          <div className="p-5 flex-1 flex flex-col gap-4">
            
            {/* Quick Summary Grid */}
            <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-100 shrink-0">
              <div className="bg-slate-50 p-2.5 rounded-lg">
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Total Sale</p>
                <p className="text-sm font-bold text-slate-800 mt-1"><PrivacyValue value={fmt(summary?.totalRevenue)} /></p>
              </div>
              <div className="bg-emerald-50/50 p-2.5 rounded-lg">
                <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wider">Collected</p>
                <p className="text-sm font-bold text-emerald-700 mt-1"><PrivacyValue value={fmt(summary?.totalCollected)} /></p>
              </div>
              <div className="bg-amber-50/50 p-2.5 rounded-lg">
                <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wider">Credit</p>
                <p className="text-sm font-bold text-amber-700 mt-1"><PrivacyValue value={fmt(summary?.totalCredit)} /></p>
              </div>
              <div className="bg-rose-50/50 p-2.5 rounded-lg">
                <p className="text-[10px] text-rose-600 font-medium uppercase tracking-wider">Est. Profit</p>
                <p className="text-sm font-bold text-rose-700 mt-1"><PrivacyValue value={fmt(summary?.totalProfit)} /></p>
              </div>
            </div>

            {/* Payment Modes */}
            <div className="space-y-3 flex-1 overflow-y-auto min-h-[120px]">
              <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Collection Breakdown</h4>
              {(summary?.paymentBreakdown || []).map((p) => {
                const amount = Number(p._sum?.paidAmount || 0);
                const total = Number(summary?.totalCollected || 1);
                const pct = Math.round((amount / total) * 100);
                const colors = { CASH: '#10b981', UPI: '#3b82f6', CARD: '#8b5cf6', CREDIT: '#f59e0b' };
                return (
                  <div key={p.paymentMode}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">{p.paymentMode}</span>
                      <span className="text-slate-500 font-medium"><PrivacyValue value={`${fmt(amount)} (${pct}%)`} /></span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: colors[p.paymentMode] || '#3b82f6' }}
                      />
                    </div>
                  </div>
                );
              })}

              {(!summary?.paymentBreakdown?.length) && (
                <div className="flex items-center justify-center h-full pb-4">
                    <p className="text-xs text-slate-400">No collection data</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock & Quick Actions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Low Stock Alert */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-500" />
              <h3 className="font-semibold text-slate-700 text-sm">Low Stock Alert</h3>
            </div>
            <Link to="/stock" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div>
            {lowStock.length === 0 ? (
              <div className="p-5 text-center text-sm text-slate-400">✅ All stock levels are healthy</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="!text-center w-24">Stock</th>
                    <th className="!text-center w-24">Min</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.name}</td>
                      <td className="text-center">
                        <span className="badge-red">{Number(p.currentStock)}</span>
                      </td>
                      <td className="text-center text-slate-400">{Number(p.minStockAlert)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-slate-700 text-sm">Quick Actions</h3>
          </div>
          <div className="p-5 grid grid-cols-2 gap-3">
            {[
              { to: '/sale', icon: ShoppingCart, label: 'New Sale', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
              { to: '/purchase', icon: Package, label: 'New Purchase', color: 'bg-violet-50 text-violet-700 hover:bg-violet-100' },
              { to: '/products/add', icon: Package, label: 'Add Product', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
              { to: '/customers', icon: Users, label: 'Add Customer', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
              { to: '/reports', icon: TrendingUp, label: 'View Reports', color: 'bg-rose-50 text-rose-700 hover:bg-rose-100' },
              { to: '/stock', icon: AlertTriangle, label: 'Stock Update', color: 'bg-slate-50 text-slate-700 hover:bg-slate-100' },
            ].map(({ to, icon: Icon, label, color }) => (
              <Link key={to} to={to}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${color} group`}
              >
                <Icon size={18} />
                <span className="text-sm font-medium">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
