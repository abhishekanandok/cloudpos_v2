import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Package, Users, IndianRupee, Truck,
  ArrowDown, ArrowUp, History, LogOut, Search, Plus,
  Minus, X, Check, Loader2, Eye, EyeOff,
  Printer, User, CreditCard, Scan
} from 'lucide-react';
import { driversAPI, driverSalesAPI, driverCustomersAPI, salesAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

// ── Driver Auth Store (session only) ──────────────────────
const getDriverSession = () => {
  try { return JSON.parse(sessionStorage.getItem('driver_session') || 'null'); } catch { return null; }
};
const setDriverSession = (data) => sessionStorage.setItem('driver_session', JSON.stringify(data));
const clearDriverSession = () => sessionStorage.removeItem('driver_session');

// ── Login Screen ──────────────────────────────────────────
function DriverLoginScreen({ onLogin }) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!loginId || !password) { toast.error('Enter login ID and password'); return; }
    setLoading(true);
    try {
      const res = await driversAPI.login({ loginId, password });
      const { token, driver } = res.data;
      setDriverSession({ token, driver });
      // Set token for API calls
      localStorage.setItem('driver_token', token);
      onLogin({ token, driver });
    } catch { toast.error('Invalid credentials'); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Truck size={32} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Driver Login</h1>
          <p className="text-sm text-slate-500 mt-1">CloudPOS Vehicle Sales</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Login ID</label>
            <input value={loginId} onChange={e => setLoginId(e.target.value)}
              className="input" placeholder="ramesh_driver"
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                className="input pr-10" placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <button onClick={handleLogin} disabled={loading}
            className="btn-primary w-full justify-center py-3 rounded-xl text-base">
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Truck size={20} />}
            {loading ? 'Logging in...' : 'Login as Driver'}
          </button>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          <a href="/login" className="hover:text-blue-600">← Owner Login</a>
        </p>
      </div>
    </div>
  );
}

// ── Unit helpers ──────────────────────────────────────────
// Returns how many base-pieces are in one of `unitName` for a given product
const getUnitBaseMultiplier = (product, unitName) => {
  if (!Array.isArray(product.pricingTiers) || !product.pricingTiers.length) return 1;
  const masterTier = product.pricingTiers.reduce((prev, curr) =>
    ((prev.units || []).length > (curr.units || []).length) ? prev : curr,
    product.pricingTiers[0]
  );
  if (!masterTier || !Array.isArray(masterTier.units)) return 1;
  const uIdx = masterTier.units.findIndex(u => u.name === unitName);
  if (uIdx === -1) return 1;
  let mult = 1;
  for (let j = uIdx + 1; j < masterTier.units.length; j++) {
    mult *= (Number(masterTier.units[j].quantity) || 1);
  }
  return mult;
};

// Display baseQty as mixed-unit string e.g. "1 DOZEN 5 PCS"
const formatStockQty = (baseQty, product) => {
  if (!Array.isArray(product.pricingTiers) || !product.pricingTiers.length) {
    return `${baseQty} ${product.unitType || 'PCS'}`;
  }
  const masterTier = product.pricingTiers.reduce((prev, curr) =>
    ((prev.units || []).length > (curr.units || []).length) ? prev : curr,
    product.pricingTiers[0]
  );
  const units = masterTier?.units;
  if (!units || units.length <= 1) return `${baseQty} ${product.unitType || 'PCS'}`;

  // Build multiplier list and sort largest→smallest
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

// ── Generic Bill Print Helper ─────────────────────────────
const printDriverBill = (d) => {
  if (!d) return;
  const { sale, items, customer: cust, subtotal: sub, totalGst: gst, grandTotal: gt, paymentsArr } = d;

  const dateStr = new Date(sale.saleDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = new Date(sale.saleDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const rows = (items || []).map(item => {
    const lineTotal = Number(item.totalAmount || (Number(item.unitPrice) * Number(item.quantity)));
    return `<tr>
      <td class="item-name">${item.product?.name || 'Unknown'}<br/><small style="color:#666">${item.unitType || ''}</small></td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">₹${Number(item.unitPrice).toFixed(2)}</td>
      <td style="text-align:right">${Number(item.gstPercent) > 0 ? item.gstPercent + '%' : '-'}</td>
      <td style="text-align:right">₹${lineTotal.toFixed(2)}</td>
    </tr>`;
  }).join('');

  const paymentRows = (paymentsArr || []).map(p =>
    `<tr><td>${p.paymentMode}</td><td style="text-align:right">₹${Number(p.amount).toFixed(2)}</td></tr>`
  ).join('') || `<tr><td>${sale.paymentMode || 'CASH'}</td><td style="text-align:right">₹${Number(gt || sale.grandTotal).toFixed(2)}</td></tr>`;

  const billContent = `
    <div style="padding:10px;">
      <div class="center bold" style="font-size:18px;margin-bottom:2px;text-transform:uppercase;">ASHA FMCG</div>
      <div class="center bold" style="font-size:14px;margin-bottom:4px;">Ph: 7070474780</div>
      <div class="center" style="font-size:10px;color:#444">Invoice: ${sale.invoiceNumber}</div>
      <div class="center" style="font-size:10px;color:#444;margin-bottom:6px">Date: ${dateStr} ${timeStr}</div>
      ${cust ? `<div class="divider"></div>
      <div style="margin:4px 0">
        <div class="bold">Customer: ${cust.name}</div>
        ${cust.mobile ? `<div>Phone: ${cust.mobile}</div>` : ''}
      </div>` : ''}
      <div class="divider"></div>
      <table>
        <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">GST</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="divider"></div>
      <table style="margin-top:4px">
        <tr><td>Subtotal</td><td style="text-align:right">₹${Number(sub || sale.subtotal).toFixed(2)}</td></tr>
        <tr><td>Total GST</td><td style="text-align:right">₹${Number(gst || sale.totalGst).toFixed(2)}</td></tr>
        <tr class="total-row"><td class="grand">Grand Total</td><td class="grand" style="text-align:right">₹${Number(gt || sale.grandTotal).toFixed(2)}</td></tr>
      </table>
      <div class="divider"></div>
      <div class="bold" style="margin:4px 0">Payment Details:</div>
      <table>${paymentRows}</table>
      ${Number(sale.balanceAmount) > 0 ? `<div style="margin-top:2px;font-weight:bold;color:#d97706">Balance Due: ₹${Number(sale.balanceAmount).toFixed(2)}</div>` : ''}
      <div class="divider"></div>
      <div class="center" style="margin-top:8px">Thanks for your business!</div>
      <div class="center" style="font-size:8px;margin-top:2px;color:#666">Powered by POS Counter</div>
    </div>
  `;

  if (!document.getElementById('thermal-print-styles')) {
    const styleNode = document.createElement('style');
    styleNode.id = 'thermal-print-styles';
    styleNode.innerHTML = `
      @media screen {
        #thermal-print-container { display: none !important; }
      }
      @media print {
        body > *:not(#thermal-print-container):not(#thermal-print-styles) {
          display: none !important;
        }
        @page { margin: 0; size: 80mm auto; }
        body, html { margin: 0 !important; padding: 0 !important; background: white !important; }
        
        #thermal-print-container {
          display: block !important;
          width: 80mm;
          margin: 0; padding: 0;
          font-family: monospace; font-size: 14px; font-weight: 600; color: #000;
          position: absolute; top: 0; left: 0;
        }
        #thermal-print-container * { box-sizing: border-box; }
        #thermal-print-container .center { text-align: center; }
        #thermal-print-container .bold { font-weight: 800; }
        #thermal-print-container .divider { border-top: 1.5px dashed #000; margin: 5px 0; }
        #thermal-print-container table { width: 100%; border-collapse: collapse; }
        #thermal-print-container th { text-align: left; font-size: 13px; border-bottom: 1.5px solid #000; padding: 3px 0; font-weight: 800; }
        #thermal-print-container td { padding: 4px 0; font-size: 13.5px; font-weight: 700; vertical-align: top; }
        #thermal-print-container .item-name { max-width: 35mm; word-wrap: break-word; }
        #thermal-print-container .total-row { font-weight: 800; border-top: 1.5px solid #000; }
        #thermal-print-container .grand { font-size: 16px; font-weight: 800; }
      }
    `;
    document.head.appendChild(styleNode);
  }

  let printContainer = document.getElementById('thermal-print-container');
  if (!printContainer) {
    printContainer = document.createElement('div');
    printContainer.id = 'thermal-print-container';
    document.body.appendChild(printContainer);
  }
  
  printContainer.innerHTML = billContent;
  setTimeout(() => { window.print(); }, 200);
};

// ── Vehicle Stock Screen ──────────────────────────────────
function VehicleStockScreen({ driver }) {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    driversAPI.vehicleStock(driver.id)
      .then(r => setStock(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [driver.id]);

  const totalValue = stock.reduce((s, item) => s + Number(item.quantity) * Number(item.product?.retailPrice || 0), 0);

  return (
    <div className="p-4">
      <div className="bg-blue-50 rounded-xl p-4 mb-4 flex justify-between items-center">
        <div>
          <p className="text-xs text-blue-600 font-medium">Total Stock Value</p>
          <p className="text-xl font-bold text-blue-800">{fmt(totalValue)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">{stock.length} products</p>
          <p className="text-sm font-medium text-slate-700">{driver.vehicle || 'Vehicle'}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : stock.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Package size={48} strokeWidth={1} className="mx-auto mb-3" />
          <p className="font-medium">No stock loaded</p>
          <p className="text-sm mt-1">Ask owner to load stock to your vehicle</p>
        </div>
      ) : (
        <div className="space-y-2">
          {stock.map(s => (
            <div key={s.id} className="bg-white rounded-xl p-4 border border-slate-100 flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-800">{s.product.name}</p>
                <p className="text-xs text-slate-400 font-mono">{s.product.barcode || 'No barcode'}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-blue-600">{formatStockQty(Number(s.quantity), s.product)}</p>
                <p className="text-xs text-slate-400">({Number(s.quantity)} base pcs)</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Collect Payment Screen ────────────────────────────────
function CollectPaymentScreen({ driver }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!search.trim() || customer) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await driverCustomersAPI.list({ search, limit: 8 });
        setResults(res.data.customers || res.data || []);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [search, customer]);

  const handleCollect = async () => {
    if (!customer) { toast.error('Select a customer'); return; }
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error('Enter valid amount'); return; }
    if (amt > Number(customer.currentBalance || 0)) {
      toast.error(`Amount exceeds due balance ₹${Number(customer.currentBalance || 0).toFixed(2)}`); return;
    }
    setSaving(true);
    try {
      const res = await driversAPI.collectPayment({
        customerId: customer.id, amount: amt, paymentMode, driverId: driver.id,
      });
      toast.success(`₹${amt} collected from ${customer.name}! New balance: ₹${res.data.newBalance.toFixed(2)}`);
      setCustomer(null); setSearch(''); setAmount('');
    } catch {} finally { setSaving(false); }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-blue-50 rounded-xl p-4 text-center">
        <CreditCard size={28} className="text-blue-500 mx-auto mb-2" />
        <p className="font-semibold text-blue-800">Collect Payment</p>
        <p className="text-xs text-blue-500 mt-0.5">Receive outstanding payment from customer</p>
      </div>

      {/* Customer search */}
      {!customer ? (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search customer by name / mobile..."
            className="input pl-9 text-sm" />
          {results.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
              {results.map(c => (
                <button key={c.id} onClick={() => { setCustomer(c); setResults([]); setSearch(''); }}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-50 text-left border-b border-slate-50 last:border-0">
                  <div>
                    <div className="font-medium text-sm">{c.name}</div>
                    <div className="text-xs text-slate-400">{c.mobile || 'No mobile'}</div>
                  </div>
                  <div className="text-right">
                    {Number(c.currentBalance) > 0
                      ? <span className="text-xs font-bold text-amber-600">Due: ₹{Number(c.currentBalance).toFixed(2)}</span>
                      : <span className="text-xs text-emerald-500">No due</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-800">{customer.name}</p>
              <p className="text-xs text-slate-400">{customer.mobile || 'No mobile'}</p>
            </div>
            <button onClick={() => { setCustomer(null); setAmount(''); }}
              className="text-slate-400 hover:text-red-500"><X size={16} /></button>
          </div>
          <div className="mt-3 pt-3 border-t border-amber-200 flex justify-between">
            <span className="text-sm text-slate-600">Outstanding Due</span>
            <span className="text-lg font-bold text-amber-700">₹{Number(customer.currentBalance || 0).toFixed(2)}</span>
          </div>
        </div>
      )}

      {customer && Number(customer.currentBalance) > 0 && (
        <>
          <div>
            <label className="label text-xs">Amount to Collect (₹)</label>
            <input type="text" inputMode="decimal"
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder={`Max: ₹${Number(customer.currentBalance).toFixed(2)}`}
              className="input text-lg font-bold" />
            <div className="flex gap-2 mt-2">
              {[100, 200, 500].map(q => (
                <button key={q} onClick={() => setAmount(Math.min(q, Number(customer.currentBalance)))}
                  className="btn-secondary btn-sm flex-1">₹{q}</button>
              ))}
              <button onClick={() => setAmount(Number(customer.currentBalance))}
                className="btn-secondary btn-sm flex-1 text-emerald-600">Full</button>
            </div>
          </div>

          <div>
            <label className="label text-xs">Payment Mode</label>
            <div className="grid grid-cols-4 gap-1.5">
              {['CASH', 'UPI', 'CARD', 'CHEQUE'].map(m => (
                <button key={m} onClick={() => setPaymentMode(m)}
                  className={`py-2 rounded-lg text-xs font-medium transition-all
                    ${paymentMode === m ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleCollect} disabled={saving || !amount}
            className="btn-primary w-full justify-center py-3 rounded-xl text-base">
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
            {saving ? 'Processing...' : `Collect ₹${amount || 0} via ${paymentMode}`}
          </button>
        </>
      )}

      {customer && Number(customer.currentBalance) <= 0 && (
        <div className="text-center py-8 text-emerald-600">
          <Check size={40} className="mx-auto mb-2" />
          <p className="font-semibold">No outstanding due!</p>
          <p className="text-sm text-slate-400 mt-1">This customer has no pending balance.</p>
        </div>
      )}
    </div>
  );
}

// ── Create Sale Screen ────────────────────────────────────
function CreateSaleScreen({ driver, onSaleDone }) {
  const [vehicleStock, setVehicleStock] = useState([]);
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: '', mobile: '' });
  const [productSearch, setProductSearch] = useState('');
  const [priceType, setPriceType] = useState('Retail');
  const [availableTiers, setAvailableTiers] = useState(['Retail', 'Wholesale']);
  // Split payment fields
  const [cashAmt, setCashAmt] = useState('');
  const [upiAmt, setUpiAmt]   = useState('');
  const [cardAmt, setCardAmt] = useState('');
  const [saving, setSaving]   = useState(false);
  const [loadingStock, setLoadingStock] = useState(true);
  const [scanMode, setScanMode] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const searchRef = useRef(null);
  const barcodeInputRef = useRef(null);
  const barcodeBuffer = useRef('');
  const barcodeTimer = useRef(null);
  const vehicleStockRef = useRef([]);
  const priceTypeRef = useRef('Retail');
  const addToCartRef = useRef(null);

  // Print support
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [completedSaleData, setCompletedSaleData] = useState(null);

  const handlePrint = (dataObj) => {
    printDriverBill(dataObj || completedSaleData);
  };

  useEffect(() => {
    driversAPI.vehicleStock(driver.id)
      .then(r => {
        const stock = r.data || [];
        setVehicleStock(stock);
        vehicleStockRef.current = stock; // keep ref in sync for global scanner
        const tNames = new Set(['Retail', 'Wholesale']);
        stock.forEach(s => {
          if (Array.isArray(s.product?.pricingTiers)) {
            s.product.pricingTiers.forEach(t => { if (t.name) tNames.add(t.name); });
          }
        });
        setAvailableTiers(Array.from(tNames));
      })
      .catch(() => {})
      .finally(() => setLoadingStock(false));
  }, [driver.id]);

  // Keep vehicleStockRef in sync whenever vehicleStock state changes
  useEffect(() => {
    vehicleStockRef.current = vehicleStock;
  }, [vehicleStock]);

  // ── Global Barcode Scanner Support (keyboard wedge) ───────────
  // Works exactly like SalePage: accumulates chars fast, fires on Enter
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in any input/textarea/select
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Enter' && barcodeBuffer.current.length > 2) {
        const scanned = barcodeBuffer.current.trim();
        barcodeBuffer.current = '';
        clearTimeout(barcodeTimer.current);
        // Find in current vehicle stock by barcode
        const stockItem = vehicleStockRef.current.find(
          s => (s.product.barcode || '').trim() === scanned
        );
        if (stockItem) {
          addToCartRef.current(stockItem);
        } else {
          toast.error(`Barcode "${scanned}" not found in vehicle stock`);
        }
      } else if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
        clearTimeout(barcodeTimer.current);
        barcodeTimer.current = setTimeout(() => {
          barcodeBuffer.current = '';
        }, 150);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Customer search
  useEffect(() => {
    if (!customerSearch.trim()) { setCustomerResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await driverCustomersAPI.list({ search: customerSearch, limit: 6 });
        setCustomerResults(res.data.customers || res.data || []);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  // Product search + barcode scan auto-add
  const filteredProducts = productSearch.trim()
    ? vehicleStock.filter(s =>
        s.product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (s.product.barcode || '').includes(productSearch)
      )
    : [];

  // Handle Enter in search input: exact barcode match or single result
  const handleProductSearchKey = (e) => {
    if (e.key === 'Enter' && productSearch.trim()) {
      // First try exact barcode match
      const exact = vehicleStock.find(s => (s.product.barcode || '').trim() === productSearch.trim());
      if (exact) { addToCart(exact); return; }
      // If only one result, add it
      if (filteredProducts.length === 1) { addToCart(filteredProducts[0]); return; }
      // Try partial barcode match
      const partial = vehicleStock.find(s => (s.product.barcode || '').includes(productSearch.trim()));
      if (partial) { addToCart(partial); }
    }
  };

  // Get matching tier for product by tier name
  const getTierForProduct = (product, targetTierName) => {
    if (!product?.pricingTiers?.length) {
      return { price: product?.retailPrice || 0, units: [{ name: product?.unitType || 'PCS' }] };
    }
    let matched = product.pricingTiers.find(t => t.name.toLowerCase() === targetTierName.toLowerCase());
    if (matched) return matched;
    // Fallback: retail → highest price tier, wholesale → lowest
    const sorted = [...product.pricingTiers].sort((a, b) => Number(a.price) - Number(b.price));
    if (targetTierName.toLowerCase().includes('retail')) return sorted[sorted.length - 1];
    return sorted[0] || product.pricingTiers[0];
  };

  // Get master units (tier with most units)
  const getMasterUnitsForProduct = (product) => {
    if (!product?.pricingTiers?.length) return [{ name: product?.unitType || 'PCS', quantity: 1 }];
    const master = product.pricingTiers.reduce(
      (prev, curr) => ((prev.units || []).length > (curr.units || []).length) ? prev : curr,
      product.pricingTiers[0]
    );
    return master?.units || [{ name: 'PCS', quantity: 1 }];
  };

  // Get price for a unit within a tier (same logic as SalePage)
  const getUnitPriceForTier = (product, tierName, targetUnitName) => {
    const tier = getTierForProduct(product, tierName);

    // 1. Exact match in tier units
    const exactUnit = tier.units?.find(u => u.name === targetUnitName);
    if (exactUnit) {
      if (exactUnit.driverPrice != null) return Number(exactUnit.driverPrice);
      if (Number(exactUnit.price) > 0) return Number(exactUnit.price);
    }

    // 2. Calculate from master units multiplier
    const masterUnits = getMasterUnitsForProduct(product);
    const uIdx = masterUnits.findIndex(u => u.name === targetUnitName);
    let multiplier = 1;
    if (uIdx !== -1) {
      for (let j = uIdx + 1; j < masterUnits.length; j++) multiplier *= (Number(masterUnits[j].quantity) || 1);
    }

    // 3. Use tier's base (last) unit price * multiplier
    if (tier.units?.length > 0) {
      const baseTierUnit = tier.units[tier.units.length - 1];
      if (baseTierUnit.driverPrice != null) return Number(baseTierUnit.driverPrice) * multiplier;
      if (Number(baseTierUnit.price) > 0) return Number(baseTierUnit.price) * multiplier;
    }

    // 4. Fallback to legacy tier.price or retailPrice
    if (Number(tier.price) > 0) return Number(tier.price) * multiplier;
    return Number(product.retailPrice || 0) * multiplier;
  };

  const handleSaleTypeChange = (newType) => {
    setPriceType(newType);
    priceTypeRef.current = newType; // keep ref in sync
    setCart(cart.map(i => {
      const p = vehicleStock.find(s => s.product.id === i.productId)?.product;
      if (!p) return i;
      const price = getUnitPriceForTier(p, newType, i.unitType);
      return { ...i, saleType: newType, price };
    }));
  };

  const addToCart = (stockItem) => {
    const pid = stockItem.product.id;
    const existing = cart.find(c => c.productId === pid);
    const maxQtyBase = Number(stockItem.quantity);
    if (existing) {
      const newBase = (existing.quantity + 1) * existing.unitMult;
      if (newBase > maxQtyBase) { toast.error('Not enough vehicle stock'); return; }
      setCart(prev => prev.map(c => c.productId === pid ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      const p = stockItem.product;
      const tier = getTierForProduct(p, priceType);
      const masterUnits = getMasterUnitsForProduct(p);

      // Use tier's defaultSellUnit if valid, else first master unit
      const tierDefault = tier?.defaultSellUnit;
      let selectedUnit;
      if (tierDefault && masterUnits.some(u => u.name === tierDefault)) {
        selectedUnit = tierDefault;
      } else {
        selectedUnit = masterUnits[0]?.name || p.unitType || 'PCS';
      }

      const price = getUnitPriceForTier(p, priceType, selectedUnit);
      const unitMult = getUnitBaseMultiplier(p, selectedUnit);

      setCart(prev => [...prev, {
        productId: pid,
        name: p.name,
        unitType: selectedUnit,
        quantity: 1,
        maxQtyBase,
        unitMult,
        price,
        saleType: priceType,
        gstPercent: Number(p.gstPercent) || 0,
        masterUnits, // store for dropdown
      }]);
    }
    setProductSearch('');
    setTimeout(() => searchRef.current?.focus(), 50);
  };
  // Keep addToCartRef in sync (used by global barcode scanner to avoid stale closure)
  addToCartRef.current = addToCart;

  // Allow typing quantity directly
  const updateQty = (productId, val) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1) return;
    setCart(prev => prev.map(c => {
      if (c.productId !== productId) return c;
      const maxAllowed = Math.floor(c.maxQtyBase / (c.unitMult || 1));
      if (num > maxAllowed) { toast.error('Not enough vehicle stock'); return { ...c, quantity: maxAllowed }; }
      return { ...c, quantity: num };
    }));
  };

  // Update unit type per cart item
  const updateCartUnit = (productId, newUnitName) => {
    setCart(prev => prev.map(c => {
      if (c.productId !== productId) return c;
      const p = vehicleStock.find(s => s.product.id === productId)?.product;
      if (!p) return c;
      const price = getUnitPriceForTier(p, c.saleType || priceType, newUnitName);
      const newUnitMult = getUnitBaseMultiplier(p, newUnitName);
      const maxAllowed = Math.floor(c.maxQtyBase / newUnitMult);
      return {
        ...c,
        unitType: newUnitName,
        unitMult: newUnitMult,
        price,
        quantity: Math.min(c.quantity, Math.max(1, maxAllowed)),
      };
    }));
  };

  // Update per-item tier
  const updateCartTier = (productId, newTierName) => {
    setCart(prev => prev.map(c => {
      if (c.productId !== productId) return c;
      const p = vehicleStock.find(s => s.product.id === productId)?.product;
      if (!p) return c;
      const price = getUnitPriceForTier(p, newTierName, c.unitType);
      const newUnitMult = getUnitBaseMultiplier(p, c.unitType);
      const maxAllowed = Math.floor(c.maxQtyBase / newUnitMult);
      return {
        ...c,
        saleType: newTierName,
        price,
        unitMult: newUnitMult,
        quantity: Math.min(c.quantity, Math.max(1, maxAllowed)),
      };
    }));
  };

  const subtotal   = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalGst   = cart.reduce((s, i) => s + (i.price * i.quantity * i.gstPercent / 100), 0);
  const grandTotal = subtotal + totalGst;

  // Split payment calculations
  const cash     = Number(cashAmt)  || 0;
  const upi      = Number(upiAmt)   || 0;
  const card     = Number(cardAmt)  || 0;
  const totalPaid = cash + upi + card;
  const credit   = Math.max(0, grandTotal - totalPaid);
  const overpaid = totalPaid > grandTotal + 0.01;

  const handleSave = async () => {
    if (cart.length === 0) { toast.error('Add at least one product'); return; }
    if (overpaid && !customer) { toast.error('Customer required to save advance payment!'); return; }
    if (credit > 0 && !customer) {
      toast.error('Customer is required for credit bills!');
      searchRef.current?.focus(); // Focus something or just return
      return;
    }
    setSaving(true);
    try {
      const res = await driverSalesAPI.create({
        customerId: customer?.id || null,
        driverId: driver.id,
        saleType: priceType,
        items: cart.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          unitType: i.unitType,
          saleType: i.saleType || priceType,
          unitPrice: i.price,
          gstPercent: i.gstPercent,
        })),
        paymentMode: totalPaid === 0 ? 'CREDIT' : cash >= upi && cash >= card ? 'CASH' : upi >= card ? 'UPI' : 'CARD',
        paidAmount: totalPaid,
        isCredit: credit > 0,
        isVehicleSale: true,
      });

      setCompletedSaleData({
        sale: res.data,
        items: [...cart],
        customer,
        subtotal,
        totalGst,
        grandTotal,
        paymentsArr: [
            ...(cash > 0 ? [{paymentMode: 'CASH', amount: cash}] : []),
            ...(upi > 0 ? [{paymentMode: 'UPI', amount: upi}] : []),
            ...(card > 0 ? [{paymentMode: 'CARD', amount: card}] : []),
        ]
      });

      toast.success('Bill created! Vehicle stock updated.');
      setShowPrintModal(true);

      setCart([]); setCustomer(null);
      setCashAmt(''); setUpiAmt(''); setCardAmt('');
      setProductSearch('');
      driversAPI.vehicleStock(driver.id).then(r => setVehicleStock(r.data || [])).catch(() => {});
      onSaleDone && onSaleDone();
    } catch {} finally { setSaving(false); }
  };

  const handleAddCustomerInline = async () => {
    if (!customerForm.name) { toast.error('Customer name required'); return; }
    setSaving(true);
    try {
      const res = await driverCustomersAPI.create(customerForm);
      toast.success('Customer added');
      // The API returns the created customer, usually in res.data
      setCustomer(res.data.customer || res.data);
      setShowAddCustomer(false);
      setCustomerSearch('');
      setCustomerForm({ name: '', mobile: '' });
    } catch {} finally { setSaving(false); }
  };

  if (loadingStock) return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500" /></div>;

  return (
    <div className="flex flex-col h-full">
      {/* Price type dropdown */}
      <div className="p-3 bg-slate-50 border-b border-slate-100">
        <div className="flex bg-white rounded-lg border border-slate-200 p-1">
          <select value={priceType} onChange={e => handleSaleTypeChange(e.target.value)}
            className="w-full bg-transparent text-sm font-semibold text-blue-700 outline-none px-2 py-1.5 cursor-pointer">
            {availableTiers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Product search / barcode scan */}
      <div className="p-3 border-b border-slate-100 relative">

        {/* ── Search + Scan button row ── */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input ref={searchRef} value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              onKeyDown={handleProductSearchKey}
              placeholder="enter the name or barcode..."
              autoComplete="off"
              className="input pl-9 text-sm w-full" />
          </div>

          {/* Scan Mode Toggle Button */}
          <button
            onClick={() => {
              setScanMode(prev => {
                const next = !prev;
                setBarcodeInput('');
                if (next) {
                  setTimeout(() => barcodeInputRef.current?.focus(), 80);
                } else {
                  setTimeout(() => searchRef.current?.focus(), 80);
                }
                return next;
              });
            }}
            title={scanMode ? 'Scan Mode Band Karo' : 'Scan Mode Shuru Karo'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-all flex-shrink-0
              ${
                scanMode
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-200 animate-pulse-slow'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600'
              }`}
          >
            <Scan size={16} />
            <span className="hidden sm:inline">{scanMode ? 'Scanning...' : 'Scan'}</span>
          </button>
        </div>

        {/* ── Scan Mode Active: dedicated barcode input ── */}
        {scanMode && (
          <div className="mt-2 relative">
            <div className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 transition-all
              ${scanning ? 'border-blue-400 bg-blue-50' : 'border-emerald-400 bg-emerald-50'}`}>
              <Scan size={18} className={`flex-shrink-0 ${scanning ? 'text-blue-500 animate-spin' : 'text-emerald-500'}`} />
              <input
                ref={barcodeInputRef}
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && barcodeInput.trim()) {
                    const code = barcodeInput.trim();
                    setBarcodeInput('');
                    // Find in vehicle stock by barcode
                    const stockItem = vehicleStockRef.current.find(
                      s => (s.product.barcode || '').trim() === code
                    );
                    if (stockItem) {
                      setScanning(true);
                      addToCartRef.current(stockItem);
                      setTimeout(() => {
                        setScanning(false);
                        barcodeInputRef.current?.focus();
                      }, 300);
                    } else {
                      toast.error(`Barcode "${code}" vehicle stock mein nahi mila`);
                      barcodeInputRef.current?.focus();
                    }
                  }
                }}
                onBlur={() => {
                  // Re-focus automatically so scanner always has a target
                  if (scanMode) setTimeout(() => barcodeInputRef.current?.focus(), 100);
                }}
                autoComplete="off"
                placeholder={scanning ? 'Adding...' : 'scan barcode ↵'}
                className="flex-1 bg-transparent outline-none text-sm font-medium text-emerald-800 placeholder-emerald-400"
              />
              {scanning && <Loader2 size={16} className="animate-spin text-blue-500 flex-shrink-0" />}
              <button
                onClick={() => { setScanMode(false); setBarcodeInput(''); setTimeout(() => searchRef.current?.focus(), 80); }}
                className="text-emerald-400 hover:text-red-500 flex-shrink-0 transition-colors"
                title="Scan Mode Band Karo"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-[10px] text-emerald-600 font-medium mt-1 pl-1">
              ✓ Scan Mode ON — barcode scan karo, product auto-add hoga cart mein
            </p>
          </div>
        )}

        {/* Dropdown results when typing in search */}
        {!scanMode && filteredProducts.length > 0 && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-52 overflow-y-auto">
            {filteredProducts.map(s => (
              <button key={s.id} onMouseDown={() => addToCart(s)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-50 text-left border-b border-slate-50 last:border-0">
                <div>
                  <div className="text-sm font-medium">{s.product.name}</div>
                  <div className="text-xs text-slate-400">Gadi Stock: {formatStockQty(Number(s.quantity), s.product)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-blue-600">{fmt(getTierForProduct(s.product, priceType).price)}</div>
                  <div className="text-xs text-slate-400">+{s.product.gstPercent}% GST</div>
                </div>
              </button>
            ))}
          </div>
        )}
        {!scanMode && productSearch && filteredProducts.length === 0 && (
          <p className="text-xs text-slate-400 mt-2 pl-1">Koi product nahi mila vehicle stock mein</p>
        )}
      </div>

      {/* Cart */}
      <div className="flex-1">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 py-12">
            <ShoppingCart size={48} strokeWidth={0.75} />
            <p className="text-sm font-medium">Search products to add to cart</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {cart.map(item => {
              const amt = item.price * item.quantity;
              const gst = amt * item.gstPercent / 100;
              return (
                <div key={item.productId} className="p-3 bg-white rounded-xl shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 min-w-0 pr-2">
                       <p className="font-semibold text-sm text-slate-800 truncate">{item.name}</p>
                       <div className="flex items-center gap-2 mt-1 flex-wrap">
                         {/* Sale type dropdown */}
                         <select value={item.saleType || priceType} onChange={e => updateCartTier(item.productId, e.target.value)}
                           className="text-[11px] bg-indigo-50 border border-indigo-100 rounded-md px-1.5 py-0.5 text-indigo-700 font-medium outline-none cursor-pointer">
                           {availableTiers.map(t => <option key={t} value={t}>{t}</option>)}
                         </select>
                         {/* Unit dropdown — all master units */}
                         {(item.masterUnits?.length > 1) ? (
                           <select
                             value={item.unitType}
                             onChange={e => updateCartUnit(item.productId, e.target.value)}
                             className="text-[11px] bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5 text-slate-600 font-medium outline-none cursor-pointer"
                           >
                             {item.masterUnits.map((u, idx) => (
                               <option key={idx} value={u.name}>{u.name}</option>
                             ))}
                           </select>
                         ) : (
                           <span className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-md px-1.5 py-0.5">{item.unitType}</span>
                         )}
                       </div>
                    </div>
                    <button onClick={() => setCart(prev => prev.filter(c => c.productId !== item.productId))}
                      className="text-slate-300 hover:text-red-500 p-1.5 bg-slate-50 rounded-lg"><X size={14} /></button>
                  </div>
                  <div className="flex items-end gap-2">
                    {/* Editable Rate */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-500 mb-1">
                        Rate ₹ {item.price === 0 && <span className="text-red-500 font-bold">⚠ 0</span>}
                      </p>
                      <input
                        type="text" inputMode="decimal"
                        value={item.price === 0 ? '' : item.price}
                        placeholder="0.00"
                        onChange={e => {
                          const p = parseFloat(e.target.value) || 0;
                          setCart(prev => prev.map(c => c.productId === item.productId ? { ...c, price: p } : c));
                        }}
                        className={`w-full text-sm font-bold border rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 transition-colors ${item.price === 0 ? 'border-red-300 bg-red-50 placeholder-red-300' : 'border-slate-200 bg-slate-50'}`}
                      />
                    </div>
                    {/* Qty */}
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1 text-center">Qty</p>
                      <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                        <button onClick={() => setCart(prev => prev.map(c => c.productId === item.productId ? { ...c, quantity: Math.max(1, c.quantity - 1) } : c))}
                          className="w-7 h-7 rounded-md bg-white shadow-sm flex items-center justify-center text-slate-600 active:scale-95"><Minus size={14} /></button>
                        <input type="text" inputMode="decimal" value={item.quantity}
                          onChange={e => updateQty(item.productId, e.target.value)}
                          className="w-10 text-center text-sm font-bold bg-transparent outline-none" />
                        <button onClick={() => {
                          const maxAllowed = Math.floor(item.maxQtyBase / (item.unitMult || 1));
                          if (item.quantity >= maxAllowed) { toast.error('Not enough vehicle stock'); return; }
                          setCart(prev => prev.map(c => c.productId === item.productId ? { ...c, quantity: c.quantity + 1 } : c));
                        }} className="w-7 h-7 rounded-md bg-white shadow-sm flex items-center justify-center text-slate-600 active:scale-95"><Plus size={14} /></button>
                      </div>
                    </div>
                    {/* Total */}
                    <div className="text-right min-w-[64px]">
                      <p className="text-[10px] text-slate-500 mb-1">Total</p>
                      <p className="font-bold text-sm text-blue-700">{fmt((item.price * item.quantity) * (1 + item.gstPercent / 100))}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bill footer */}
      {cart.length > 0 && (
        <div className="border-t border-slate-200 bg-white p-4 space-y-4">
          {/* Customer */}
          <div>
            {!showAddCustomer ? (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={customer ? customer.name : customerSearch}
                    onChange={e => { setCustomerSearch(e.target.value); if (customer) setCustomer(null); }}
                    placeholder="Select customer (required for credit)..."
                    className={`input pl-9 text-sm py-2 ${credit > 0 && !customer ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-100' : ''}`} />
                  {customerResults.length > 0 && !customer && (
                     <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-[0_-5px_15px_rgba(0,0,0,0.1)] z-20 max-h-40 overflow-y-auto">
                      {customerResults.map(c => (
                        <button key={c.id} onClick={() => { setCustomer(c); setCustomerSearch(''); setCustomerResults([]); }}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-50 text-left border-b border-slate-50 last:border-0">
                          <span className="text-sm font-medium">{c.name}</span>
                          {Number(c.currentBalance) > 0 && <span className="text-xs font-bold text-amber-600">Due: {fmt(c.currentBalance)}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {!customer && (
                  <button onClick={() => setShowAddCustomer(true)} className="btn-secondary px-4 text-sm font-semibold whitespace-nowrap">
                    <Plus size={16} className="mr-1" /> Add
                  </button>
                )}
                {customer && (
                  <button onClick={() => setCustomer(null)} className="btn-secondary px-4 text-red-500 font-semibold bg-red-50 border-red-200">
                    <X size={16} />
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-200 space-y-2">
                <p className="text-xs font-bold text-blue-800 flex justify-between tracking-wide uppercase">
                  <span>New Customer</span>
                  <button onClick={() => setShowAddCustomer(false)} className="text-slate-400 hover:text-red-500 p-1 bg-white rounded-md"><X size={14} /></button>
                </p>
                <input value={customerForm.name} onChange={e => setCustomerForm(f => ({...f, name: e.target.value}))} placeholder="Customer Name *" className="input text-sm py-2" />
                <input value={customerForm.mobile} onChange={e => setCustomerForm(f => ({...f, mobile: e.target.value}))} placeholder="Mobile Number" className="input text-sm py-2" />
                <button onClick={handleAddCustomerInline} disabled={saving} className="btn-primary w-full py-2.5 text-sm font-semibold justify-center">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save & Select
                </button>
              </div>
            )}
            {credit > 0 && !customer && !showAddCustomer && (
              <p className="text-xs font-semibold text-amber-600 mt-1.5 pl-1 flex items-center"><span className="text-lg leading-none mr-1">⚠</span> Customer is required for credit bills</p>
            )}
          </div>

          {/* Totals */}
          <div className="bg-slate-100/70 rounded-xl p-3 text-sm space-y-1.5 font-medium">
            <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            <div className="flex justify-between text-slate-600"><span>GST</span><span>{fmt(totalGst)}</span></div>
            <div className="flex justify-between font-bold text-base pt-2 border-t border-slate-300">
              <span>Grand Total</span><span className="text-blue-700">{fmt(grandTotal)}</span>
            </div>
          </div>

          {/* ── Split Payment ── */}
          <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden shadow-sm">
             <div className="px-3 py-2 bg-slate-100/50 border-b border-slate-200 flex justify-between items-center">
              <p className="text-xs font-bold text-slate-700 tracking-wide uppercase">Payment Breakdown</p>
              <span className="text-[10px] text-slate-500 font-medium">Tap 'Full' to auto-fill</span>
            </div>
            <div className="p-3 space-y-3">
              {/* Cash */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-600 w-16 flex-shrink-0">💵 Cash</span>
                <input type="text" inputMode="decimal" placeholder="0"
                  value={cashAmt} onChange={e => setCashAmt(e.target.value)}
                  className="input flex-1 text-base py-1.5 text-right font-bold tracking-wide" />
                <button onClick={() => setCashAmt(String(Math.max(0, grandTotal - upi - card).toFixed(2)))}
                  className="text-xs font-semibold px-3 py-2 bg-slate-100 rounded-lg text-slate-600 hover:bg-blue-100 hover:text-blue-700 flex-shrink-0 transition-colors">Full</button>
              </div>
              {/* UPI */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-600 w-16 flex-shrink-0">📱 UPI</span>
                <input type="text" inputMode="decimal" placeholder="0"
                  value={upiAmt} onChange={e => setUpiAmt(e.target.value)}
                  className="input flex-1 text-base py-1.5 text-right font-bold tracking-wide" />
                <button onClick={() => setUpiAmt(String(Math.max(0, grandTotal - cash - card).toFixed(2)))}
                   className="text-xs font-semibold px-3 py-2 bg-slate-100 rounded-lg text-slate-600 hover:bg-blue-100 hover:text-blue-700 flex-shrink-0 transition-colors">Full</button>
              </div>
              {/* Card */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-600 w-16 flex-shrink-0">💳 Card</span>
                <input type="text" inputMode="decimal" placeholder="0"
                  value={cardAmt} onChange={e => setCardAmt(e.target.value)}
                  className="input flex-1 text-base py-1.5 text-right font-bold tracking-wide" />
                <button onClick={() => setCardAmt(String(Math.max(0, grandTotal - cash - upi).toFixed(2)))}
                   className="text-xs font-semibold px-3 py-2 bg-slate-100 rounded-lg text-slate-600 hover:bg-blue-100 hover:text-blue-700 flex-shrink-0 transition-colors">Full</button>
              </div>
              {/* Summary */}
              <div className="border-t-2 border-slate-100 pt-3 space-y-1 bg-slate-50/50 -mx-3 -mb-3 px-3 pb-3">
                <div className="flex justify-between text-xs text-slate-500 font-medium tracking-wide">
                  <span>TOTAL PAID</span>
                  <span className={`font-bold text-sm ${overpaid ? 'text-red-600' : 'text-emerald-600'}`}>{fmt(totalPaid)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold items-center py-1">
                  <span className={credit > 0 ? 'text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-xs tracking-wide uppercase' : 'text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs tracking-wide uppercase'}>
                    {credit > 0 ? '⏳ Credit Due' : '✓ Fully Paid'}
                  </span>
                  <span className={credit > 0 ? 'text-amber-600' : 'text-emerald-600'}>{credit > 0 ? fmt(credit) : ''}</span>
                </div>
                {overpaid && <p className={`text-xs font-semibold mt-1 ${!customer ? 'text-red-500' : 'text-emerald-600'}`}>{!customer ? '⚠ Customer required to add extra as advance' : `✓ ${fmt(totalPaid - grandTotal)} will be added to advance`}</p>}
              </div>
            </div>
          </div>

          <button onClick={handleSave} disabled={saving || (overpaid && !customer) || (credit > 0 && !customer)}
            className="btn-primary w-full justify-center py-4 rounded-xl text-lg font-bold disabled:opacity-50 shadow-lg mt-2 mb-10 transition-transform active:scale-[0.98]">
            {saving ? <Loader2 size={24} className="animate-spin mr-2" /> : <Check size={24} className="mr-2" />}
            {saving ? 'Processing...' : `Create Bill — ${fmt(grandTotal)}`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sales History Screen ──────────────────────────────────
function SalesHistoryScreen({ driver }) {
  const [sales, setSales] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);

  // Print support
  const [printingId, setPrintingId] = useState(null);

  const handlePrintSale = async (id) => {
    setPrintingId(id);
    try {
      let saleData = null;
      // Try driver-specific endpoint first (works with driver_token)
      try {
        const res = await driverSalesAPI.getSaleForPrint(id);
        saleData = res.data;
      } catch {
        // Fallback: owner token via regular sales API (when owner is viewing driver history)
        const res = await salesAPI.get(id);
        saleData = res.data;
      }
      if (saleData) {
        printDriverBill({
          sale: saleData,
          items: saleData.items || [],
          customer: saleData.customer,
          subtotal: saleData.subtotal,
          totalGst: saleData.totalGst,
          grandTotal: saleData.grandTotal,
          paymentsArr: saleData.payments || []
        });
      }
    } catch (err) {
      console.error('Print error:', err);
      toast.error('Failed to load sale details for printing');
    } finally {
      setPrintingId(null);
    }
  };


  const fetchSales = async () => {
    setLoading(true);
    try {
      const res = await driverSalesAPI.list({ driverId: driver.id, startDate: dateFrom, endDate: dateTo, limit: 50 });
      setSales(res.data.sales || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchSales(); }, []);

  return (
    <div className="p-4">
      <div className="flex gap-2 mb-4">
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input flex-1 text-sm" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input flex-1 text-sm" />
        <button onClick={fetchSales} className="btn-primary px-3">Go</button>
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : sales.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <History size={40} strokeWidth={1} className="mx-auto mb-2" />
          <p>No sales found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sales.map(s => (
            <div key={s.id} className="bg-white rounded-xl p-4 border border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-sm font-semibold text-blue-600">{s.invoiceNumber}</span>
                <span className="text-xs text-slate-400">{format(new Date(s.saleDate), 'dd MMM, hh:mm a')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{s.customer?.name || 'Walk-in'}</span>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="font-bold">{fmt(s.grandTotal)}</p>
                  {Number(s.balanceAmount) > 0 && <p className="text-xs text-amber-600">Due: {fmt(s.balanceAmount)}</p>}
                  <button onClick={() => handlePrintSale(s.id)} disabled={printingId === s.id} className="btn-secondary btn-sm h-7 px-2 mt-1">
                     {printingId === s.id ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />}
                     Print Bill
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Customers Screen ──────────────────────────────────────
function CustomersScreen({ driver }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', mobile: '', address: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await driverCustomersAPI.list({ search, limit: 50 });
      setCustomers(res.data.customers || res.data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchCustomers(); }, [search]);

  const handleAddCustomer = async () => {
    if (!form.name) { toast.error('Customer name required'); return; }
    setSaving(true);
    try {
      await driverCustomersAPI.create(form);
      toast.success('Customer added');
      setShowAdd(false);
      setForm({ name: '', mobile: '', address: '', notes: '' });
      fetchCustomers();
    } catch {} finally { setSaving(false); }
  };

  return (
    <div className="p-4">
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..." className="input pl-9 text-sm" />
        </div>
        <button onClick={() => setShowAdd(v => !v)} className="btn-primary px-3"><Plus size={16} /></button>
      </div>

      {showAdd && (
        <div className="bg-blue-50 rounded-xl p-4 mb-4 space-y-3 border border-blue-100">
          <p className="font-semibold text-sm text-blue-800">Add New Customer</p>
          <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Customer Name *" className="input text-sm" />
          <input value={form.mobile} onChange={e => setForm(f => ({...f, mobile: e.target.value}))} placeholder="Mobile Number" className="input text-sm" />
          <input value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} placeholder="Address / Area" className="input text-sm" />
          <input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Notes (optional)" className="input text-sm" />
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1 justify-center text-sm">Cancel</button>
            <button onClick={handleAddCustomer} disabled={saving} className="btn-primary flex-1 justify-center text-sm">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : customers.map(c => (
        <div key={c.id} className="bg-white rounded-xl p-4 border border-slate-100 mb-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-slate-400">{c.mobile || 'No mobile'} · {c.address || 'No address'}</p>
            </div>
            {Number(c.currentBalance) > 0 && (
              <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">Due: {fmt(c.currentBalance)}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── MAIN DRIVER POS ───────────────────────────────────────
const SCREENS = [
  { id: 'sale',    icon: ShoppingCart,  label: 'New Bill' },
  { id: 'stock',   icon: Package,       label: 'Stock' },
  { id: 'collect', icon: CreditCard,    label: 'Collect' },
  { id: 'customers', icon: Users,       label: 'Customers' },
  { id: 'history', icon: History,       label: 'History' },
];

export default function DriverPOS() {
  const [session, setSession] = useState(getDriverSession());
  const [screen, setScreen] = useState('sale');

  const handleLogin = (data) => setSession(data);
  const handleLogout = () => {
    clearDriverSession();
    localStorage.removeItem('driver_token');
    setSession(null);
  };

  if (!session) return <DriverLoginScreen onLogin={handleLogin} />;

  const { driver } = session;

  return (
    <div className="min-h-[100dvh] bg-slate-200 flex flex-col max-w-md mx-auto shadow-xl">
      {/* Header */}
      <div className="bg-blue-800 text-white px-4 py-3 flex items-center justify-between flex-shrink-0 shadow-sm border-b border-blue-900">
        <div>
          <p className="font-bold text-sm tracking-wide">{driver.name}</p>
          <p className="text-[11px] text-blue-200 mt-0.5">{driver.vehicle || 'No vehicle'} · {driver.shop?.name}</p>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-blue-200 hover:text-white text-xs font-semibold px-2 py-1 rounded bg-blue-900/30">
          <LogOut size={14} /> Logout
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-4">
        {screen === 'sale'      && <CreateSaleScreen driver={driver} />}
        {screen === 'stock'     && <VehicleStockScreen driver={driver} />}
        {screen === 'collect'   && <CollectPaymentScreen driver={driver} />}
        {screen === 'customers' && <CustomersScreen driver={driver} />}
        {screen === 'history'   && <SalesHistoryScreen driver={driver} />}
      </div>

      {/* Bottom Nav */}
      <div className="border-t border-slate-200 bg-white grid grid-cols-5 flex-shrink-0 pb-safe">
        {SCREENS.map(s => (
          <button key={s.id} onClick={() => setScreen(s.id)}
            className={`flex flex-col items-center justify-center py-3 gap-0.5 transition-colors
              ${screen === s.id ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600'}`}>
            <s.icon size={18} />
            <span className="text-[10px] font-medium">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
