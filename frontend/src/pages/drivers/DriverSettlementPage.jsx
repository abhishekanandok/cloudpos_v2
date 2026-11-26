import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { driversAPI } from '../../utils/api';
import { format } from 'date-fns';
import {
  Loader2, ArrowLeft, Printer, Truck,
  ArrowDown, ArrowUp, ShoppingCart,
  AlertTriangle, CheckCircle2, IndianRupee, TrendingUp
} from 'lucide-react';

const fmt  = (n) => `₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2})}`;
const fmtN = (n) => Number(n||0).toFixed(2).replace(/\.00$/,'');

// Display baseQty as mixed-unit string e.g. "1 DOZEN 5 PCS"
const formatStockQty = (baseQty, product) => {
  if (!product || !Array.isArray(product.pricingTiers) || !product.pricingTiers.length) {
    return `${baseQty} ${product?.unitType || 'PCS'}`;
  }
  const masterTier = product.pricingTiers.reduce((prev, curr) =>
    ((prev.units || []).length > (curr.units || []).length) ? prev : curr,
    product.pricingTiers[0]
  );
  const units = masterTier?.units;
  if (!units || units.length <= 1) return `${baseQty} ${product.unitType || 'PCS'}`;

  const withMult = units.map((u, idx) => {
    let mult = 1;
    for (let j = idx + 1; j < units.length; j++) mult *= (Number(units[j].quantity) || 1);
    return { name: u.name, mult };
  }).sort((a, b) => b.mult - a.mult);

  let remaining = baseQty;
  const parts = [];
  for (const { name, mult } of withMult) {
    if (mult > 1 && remaining >= mult) {
      const count = Math.floor(remaining / mult);
      if (count > 0) parts.push(`${count} ${name}`);
      remaining = remaining % mult;
    }
  }
  if (remaining > 0 || parts.length === 0) {
    parts.push(`${remaining} ${withMult[withMult.length - 1].name}`);
  }
  return parts.join(' ');
};

export default function DriverSettlementPage() {
  const { driverId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateTo,   setDateTo]   = useState(format(new Date(), 'yyyy-MM-dd'));

  const fetchSettlement = async () => {
    setLoading(true);
    try {
      const res = await driversAPI.settlement(driverId, { startDate: dateFrom, endDate: dateTo });
      setData(res.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchSettlement(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={28} className="animate-spin text-blue-500" />
    </div>
  );

  if (!data) return <div className="text-center py-20 text-slate-400">Could not load settlement data</div>;

  const { driver, totals, productSummary, paymentBreakdown, period } = data;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/drivers')} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="page-title">Trip Settlement — {driver?.name}</h1>
          <p className="page-subtitle">{driver?.vehicle || 'No vehicle'} · {driver?.mobile || ''}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input w-36 text-sm" />
          <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   className="input w-36 text-sm" />
          <button onClick={fetchSettlement} className="btn-primary text-sm">Apply</button>
          <button onClick={() => window.print()} className="btn-secondary gap-1 text-sm">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="card p-4 bg-blue-50">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDown size={15} className="text-blue-600" />
            <span className="text-xs font-medium text-blue-600">Loaded to Vehicle</span>
          </div>
          <p className="text-2xl font-bold text-blue-800">{fmtN(totals.totalLoaded)}</p>
          <p className="text-xs text-slate-500 mt-0.5">units given</p>
        </div>
        <div className="card p-4 bg-emerald-50">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart size={15} className="text-emerald-600" />
            <span className="text-xs font-medium text-emerald-600">Sold</span>
          </div>
          <p className="text-2xl font-bold text-emerald-800">{fmtN(totals.totalSold)}</p>
          <p className="text-xs text-slate-500 mt-0.5">{totals.totalBills} bills</p>
        </div>
        <div className="card p-4 bg-amber-50">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUp size={15} className="text-amber-600" />
            <span className="text-xs font-medium text-amber-600">Returned</span>
          </div>
          <p className="text-2xl font-bold text-amber-800">{fmtN(totals.totalReturned)}</p>
          <p className="text-xs text-slate-500 mt-0.5">units returned</p>
        </div>
        <div className={`card p-4 ${totals.totalMissing > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
          <div className="flex items-center gap-2 mb-1">
            {totals.totalMissing > 0
              ? <AlertTriangle size={15} className="text-red-500" />
              : <CheckCircle2 size={15} className="text-emerald-500" />}
            <span className={`text-xs font-medium ${totals.totalMissing > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
              {totals.totalMissing > 0 ? 'Missing' : 'All Accounted'}
            </span>
          </div>
          <p className={`text-2xl font-bold ${totals.totalMissing > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
            {fmtN(totals.totalMissing)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">units unaccounted</p>
        </div>
      </div>

      {/* Cash Collection & Profit Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div className="card p-5">
          <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <IndianRupee size={16} className="text-blue-600" /> Cash Collection
          </h3>
          <div className="space-y-2.5 text-sm">
            {[
              { label: 'Total Sales Value', value: fmt(totals.totalSalesAmt), bold: false, color: 'text-slate-700' },
              { label: 'Cash Collected',    value: fmt(paymentBreakdown.CASH || 0), bold: false, color: 'text-emerald-600' },
              { label: 'UPI Collected',     value: fmt(paymentBreakdown.UPI  || 0), bold: false, color: 'text-blue-600' },
              { label: 'Card Collected',    value: fmt(paymentBreakdown.CARD || 0), bold: false, color: 'text-purple-600' },
              { label: 'Credit (Due)',      value: fmt(totals.totalCredit),         bold: false, color: 'text-amber-600' },
            ].map(r => (
              <div key={r.label} className="flex justify-between">
                <span className="text-slate-500">{r.label}</span>
                <span className={`font-semibold ${r.color}`}>{r.value}</span>
              </div>
            ))}
            <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-base">
              <span>Total Collected</span>
              <span className="text-emerald-700">{fmt(totals.totalCollected)}</span>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-slate-700 mb-3">Stock Accountability</h3>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Given to Driver</span>
              <span className="font-semibold text-blue-700">{fmtN(totals.totalLoaded)} units</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Sold</span>
              <span className="font-semibold text-emerald-700">− {fmtN(totals.totalSold)} units</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Returned</span>
              <span className="font-semibold text-amber-700">− {fmtN(totals.totalReturned)} units</span>
            </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-base">
              <span>Unaccounted</span>
              <span className={totals.totalMissing > 0 ? 'text-red-600' : 'text-emerald-600'}>
                {totals.totalMissing > 0 ? `⚠ ${fmtN(totals.totalMissing)} units` : '✓ All clear'}
              </span>
            </div>
          </div>
        </div>

        {/* Driver Profit Summary */}
        <div className="card p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100">
          <h3 className="font-semibold text-emerald-800 mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-600" /> Driver Profit
          </h3>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-emerald-700/80">Total Sales Value</span>
              <span className="font-semibold text-emerald-700">{fmt(totals.totalSalesAmt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-700/80">Total Cost Price</span>
              <span className="font-semibold text-emerald-700">− {fmt(totals.totalSalesAmt - (totals.totalProfit || 0))}</span>
            </div>
            <div className="border-t border-emerald-200/60 pt-2 mt-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-emerald-900">Net Profit</span>
                <span className="text-xl font-black text-emerald-600">{fmt(totals.totalProfit || 0)}</span>
              </div>
              <p className="text-[10px] text-emerald-600/60 text-right mt-1">Calculated from item mapped costs</p>
            </div>
          </div>
        </div>
      </div>

      {/* Product-wise Detail Table */}
      <div className="card overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700">Product-wise Breakdown</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Loaded = Given to driver · Sold = Billed · Returned = Wapas laya · Missing = Loaded − Sold − Returned
          </p>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th className="text-center text-blue-600">Loaded</th>
                <th className="text-center text-emerald-600">Sold</th>
                <th className="text-center text-amber-600">Returned</th>
                <th className="text-center text-red-500">Missing</th>
                <th className="text-right">Sale Value</th>
              </tr>
            </thead>
            <tbody>
              {productSummary.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400">No data for this period</td></tr>
              ) : productSummary.map((p, i) => (
                <tr key={p.productId} className={p.missingQty > 0 ? 'bg-red-50/30' : ''}>
                  <td className="text-slate-400">{i + 1}</td>
                  <td>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-slate-400">{p.unitType}</div>
                  </td>
                  <td className="text-center">
                    <span className="font-semibold text-blue-700">{formatStockQty(p.loadedQty, p)}</span>
                  </td>
                  <td className="text-center">
                    <span className="font-semibold text-emerald-700">{formatStockQty(p.soldQty, p)}</span>
                  </td>
                  <td className="text-center">
                    <span className="font-semibold text-amber-700">{formatStockQty(p.returnedQty, p)}</span>
                  </td>
                  <td className="text-center">
                    {p.missingQty > 0
                      ? <span className="font-bold text-red-600 flex items-center justify-center gap-1"><AlertTriangle size={12}/>{formatStockQty(p.missingQty, p)}</span>
                      : <span className="text-emerald-500">✓</span>}
                  </td>
                  <td className="text-right font-semibold">{fmt(p.soldValue)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-bold">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-sm">TOTAL</td>
                <td className="text-center text-blue-700">{fmtN(totals.totalLoaded)}</td>
                <td className="text-center text-emerald-700">{fmtN(totals.totalSold)}</td>
                <td className="text-center text-amber-700">{fmtN(totals.totalReturned)}</td>
                <td className="text-center text-red-600">{fmtN(totals.totalMissing)}</td>
                <td className="text-right">{fmt(totals.totalSalesAmt)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Bill List */}
      {data.sales?.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-700">Bills Created ({data.sales.length})</h3>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Time</th>
                  <th>Customer</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Due</th>
                  <th className="text-center">Mode</th>
                </tr>
              </thead>
              <tbody>
                {data.sales.map(s => (
                  <tr key={s.id}>
                    <td className="font-mono text-sm text-blue-600">{s.invoiceNumber}</td>
                    <td className="text-xs text-slate-500">{format(new Date(s.saleDate),'dd MMM, hh:mm a')}</td>
                    <td>{s.customer?.name || <span className="text-slate-400">Walk-in</span>}</td>
                    <td className="text-right font-semibold">{fmt(s.grandTotal)}</td>
                    <td className="text-right text-emerald-600">{fmt(s.paidAmount)}</td>
                    <td className="text-right">
                      {Number(s.balanceAmount) > 0
                        ? <span className="text-amber-600 font-medium">{fmt(s.balanceAmount)}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="text-center">
                      <span className={s.paymentMode === 'CREDIT' ? 'badge-yellow' : s.paymentMode === 'UPI' ? 'badge-blue' : 'badge-green'}>
                        {s.paymentMode}
                      </span>
                    </td>
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
