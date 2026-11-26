import { useState, useEffect } from 'react';
import { productsAPI } from '../../utils/api';
import { Loader2, Package, AlertTriangle } from 'lucide-react';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function DeadStockPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchDeadStock = async () => {
    setLoading(true);
    try {
      const res = await productsAPI.deadStock({ days });
      setProducts(res.data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchDeadStock(); }, [days]);

  const stockValue = products.reduce((s, p) => s + Number(p.currentStock) * Number(p.purchasePrice), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dead Stock Report</h1>
          <p className="page-subtitle">Products with no sales in the selected period</p>
        </div>
        <select value={days} onChange={e => setDays(Number(e.target.value))} className="input w-36">
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="card p-4 bg-amber-50">
          <p className="text-xs text-amber-600 font-medium">Dead Stock Items</p>
          <p className="text-2xl font-bold text-amber-800 mt-1">{products.length}</p>
        </div>
        <div className="card p-4 bg-red-50">
          <p className="text-xs text-red-500 font-medium">Stock Value at Risk</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{fmt(stockValue)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 font-medium">Period</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{days} days</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th className="text-center">Current Stock</th>
                <th className="text-right">Stock Value</th>
                <th className="text-center">Last Sale</th>
                <th className="text-center">Days Without Sale</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-14"><Loader2 size={24} className="animate-spin text-blue-500 mx-auto" /></td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-14 text-emerald-600">
                  <Package size={36} strokeWidth={1} className="mx-auto mb-2" /><p className="font-medium">No dead stock! All products sold recently.</p>
                </td></tr>
              ) : products.map((p, i) => (
                <tr key={p.id}>
                  <td className="text-slate-400">{i + 1}</td>
                  <td>
                    <div className="font-medium text-slate-800">{p.name}</div>
                    {p.barcode && <div className="text-xs text-slate-400 font-mono">{p.barcode}</div>}
                  </td>
                  <td className="text-center"><span className={`font-semibold ${Number(p.currentStock) > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{Number(p.currentStock)} {p.unitType}</span></td>
                  <td className="text-right font-semibold text-red-600">{fmt(Number(p.currentStock) * Number(p.purchasePrice))}</td>
                  <td className="text-center text-sm text-slate-500">{p.lastSaleDate ? new Date(p.lastSaleDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : <span className="text-red-500 font-medium">Never sold</span>}</td>
                  <td className="text-center">
                    <span className={`badge ${!p.daysSinceLastSale ? 'badge-red' : p.daysSinceLastSale > 90 ? 'badge-red' : p.daysSinceLastSale > 60 ? 'badge-yellow' : 'badge-slate'}`}>
                      {p.daysSinceLastSale ? `${p.daysSinceLastSale} days` : 'Never'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
