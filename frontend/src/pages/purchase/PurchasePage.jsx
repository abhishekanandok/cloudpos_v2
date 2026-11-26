import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Search, Loader2, Package, X, FileText,
  Truck, Calendar, Trash2, CheckCircle2,
  IndianRupee, Eye, Printer, Save, Check, Minus, Settings
} from 'lucide-react';
import { purchasesAPI, suppliersAPI, productsAPI, categoriesAPI, brandsAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'CREDIT'];
const GST_RATES = [0, 5, 12, 18, 28];

// ── Mock data for demo/offline ────────────────────────────
const MOCK_PURCHASES = [
  {
    id: 'p1', invoiceNumber: 'PUR-00001',
    purchaseDate: new Date(Date.now() - 2 * 86400000),
    supplier: { id: 's1', name: 'ABC Distributors', mobile: '9876543210' },
    grandTotal: 45200, paidAmount: 45200, balanceAmount: 0,
    isCredit: false, paymentMode: 'CASH', _count: { items: 8 },
  },
  {
    id: 'p2', invoiceNumber: 'PUR-00002',
    purchaseDate: new Date(Date.now() - 86400000),
    supplier: { id: 's2', name: 'XYZ Wholesale Pvt Ltd', mobile: '8765432109' },
    grandTotal: 32000, paidAmount: 15000, balanceAmount: 17000,
    isCredit: true, paymentMode: 'CREDIT', _count: { items: 5 },
  },
  {
    id: 'p3', invoiceNumber: 'PUR-00003',
    purchaseDate: new Date(),
    supplier: { id: 's1', name: 'ABC Distributors', mobile: '9876543210' },
    grandTotal: 18750, paidAmount: 18750, balanceAmount: 0,
    isCredit: false, paymentMode: 'UPI', _count: { items: 3 },
  },
];
const MOCK_SUPPLIERS = [
  { id: 's1', name: 'ABC Distributors', mobile: '9876543210', currentBalance: 0 },
  { id: 's2', name: 'XYZ Wholesale Pvt Ltd', mobile: '8765432109', currentBalance: 17000 },
  { id: 's3', name: 'Metro Cash & Carry', mobile: '7654321098', currentBalance: 0 },
];
const MOCK_PRODUCTS = [
  { id: 'pr1', name: 'Parle-G Biscuit 800g', barcode: '8901062005006', purchasePrice: 25, gstPercent: 5, unitType: 'PCS', currentStock: 45 },
  { id: 'pr2', name: 'Surf Excel 500g', barcode: '8901030868077', purchasePrice: 58, gstPercent: 18, unitType: 'PCS', currentStock: 18 },
  { id: 'pr3', name: 'Tata Salt 1kg', barcode: '8906012901058', purchasePrice: 20, gstPercent: 5, unitType: 'PCS', currentStock: 3 },
  { id: 'pr4', name: 'Amul Butter 500g', barcode: '8901063000045', purchasePrice: 220, gstPercent: 12, unitType: 'PCS', currentStock: 12 },
];

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => { try { return format(new Date(d), 'dd MMM yyyy'); } catch { return '—'; } };

// ─────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────
export default function PurchasePage() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [summary, setSummary] = useState({});
  const [showNewForm, setShowNewForm] = useState(false);
  const [viewPurchase, setViewPurchase] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [pricingSettings, setPricingSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_purchase_pricing');
      return saved ? JSON.parse(saved) : { updateExisting: false, updateNew: true };
    } catch {
      return { updateExisting: false, updateNew: true };
    }
  });

  const savePricingSettings = (newSettings) => {
    setPricingSettings(newSettings);
    localStorage.setItem('pos_purchase_pricing', JSON.stringify(newSettings));
  };

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await purchasesAPI.list({
        search, supplierId: supplierFilter,
        startDate: dateFrom, endDate: dateTo, page, limit: 15,
      });
      setPurchases(res.data.purchases || []);
      setPagination(res.data.pagination || {});
      setSummary(res.data.summary || {});
    } catch {
      setPurchases(MOCK_PURCHASES);
      setSummary({ grandTotal: 95950, paidAmount: 78950, balanceAmount: 17000 });
      setPagination({ total: 3, pages: 1 });
    } finally { setLoading(false); }
  }, [search, supplierFilter, dateFrom, dateTo, page]);

  useEffect(() => { fetchPurchases(); }, [fetchPurchases]);
  useEffect(() => {
    suppliersAPI.list()
      .then(r => {
        const d = r.data;
        // Backend may return { suppliers: [...] } or a bare array
        setSuppliers(Array.isArray(d) ? d : (d?.suppliers || d?.data || []));
      })
      .catch(() => setSuppliers(MOCK_SUPPLIERS));
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this purchase? Stock will be reversed.')) return;
    try {
      await purchasesAPI.delete ? purchasesAPI.delete(id) : Promise.resolve();
      toast.success('Purchase deleted, stock reversed');
      fetchPurchases();
    } catch { toast.error('Could not delete'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchase</h1>
          <p className="page-subtitle">Manage inventory purchases from suppliers</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowSettings(true)} className="btn-secondary px-3" title="Price Update Settings">
            <Settings size={16} className="text-slate-500" />
          </button>
          <button onClick={() => setShowNewForm(true)} className="btn-primary">
            <Plus size={16} /> New Purchase
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Total Purchases', value: fmt(summary.grandTotal), textColor: 'text-slate-800', bg: 'bg-white' },
          { label: 'Amount Paid', value: fmt(summary.paidAmount), textColor: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Outstanding Balance', value: fmt(summary.balanceAmount), textColor: 'text-amber-700', bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className={`card p-4 ${s.bg}`}>
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.textColor}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-44">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search invoice or supplier..." className="input pl-9" />
        </div>
        <select value={supplierFilter} onChange={e => { setSupplierFilter(e.target.value); setPage(1); }} className="input w-48">
          <option value="">All Suppliers</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input w-36" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input w-36" />
        {(search || supplierFilter || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setSupplierFilter(''); setDateFrom(''); setDateTo(''); }} className="btn-secondary gap-1">
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Supplier</th>
                <th className="text-center">Items</th>
                <th className="text-right">Grand Total</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Balance</th>
                <th className="text-center">Mode</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-14">
                  <Loader2 size={24} className="animate-spin text-blue-500 mx-auto" />
                </td></tr>
              ) : purchases.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-14 text-slate-400">
                  <Package size={36} strokeWidth={1} className="mx-auto mb-2" />
                  <p>No purchases found</p>
                </td></tr>
              ) : purchases.map(p => (
                <tr key={p.id}>
                  <td>
                    <button onClick={() => setViewPurchase(p)}
                      className="font-mono font-semibold text-blue-600 hover:underline">
                      {p.invoiceNumber || `#${p.id.slice(-6)}`}
                    </button>
                  </td>
                  <td className="text-slate-500 text-xs">{fmtDate(p.purchaseDate)}</td>
                  <td>
                    <div className="font-medium">{p.supplier?.name || '—'}</div>
                    {p.supplier?.mobile && <div className="text-xs text-slate-400">{p.supplier.mobile}</div>}
                  </td>
                  <td className="text-center"><span className="badge-slate">{p._count?.items || 0}</span></td>
                  <td className="text-right font-semibold">{fmt(p.grandTotal)}</td>
                  <td className="text-right text-emerald-600">{fmt(p.paidAmount)}</td>
                  <td className="text-right">
                    {Number(p.balanceAmount) > 0
                      ? <span className="font-medium text-amber-600">{fmt(p.balanceAmount)}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="text-center">
                    <span className={
                      p.paymentMode === 'CREDIT' ? 'badge-yellow' :
                      p.paymentMode === 'UPI' ? 'badge-blue' :
                      p.paymentMode === 'CARD' ? 'badge-slate' : 'badge-green'
                    }>{p.paymentMode}</span>
                  </td>
                  <td>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setViewPurchase(p)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="View">
                        <Eye size={14} />
                      </button>
                      {Number(p.balanceAmount) > 0 && (
                        <button onClick={() => setShowPaymentModal(p)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Record payment">
                          <IndianRupee size={14} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(p.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination.pages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">{pagination.total} total records</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary btn-sm">Prev</button>
              <span className="px-3 py-1.5 text-xs text-slate-600">{page} / {pagination.pages}</span>
              <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)} className="btn-secondary btn-sm">Next</button>
            </div>
          </div>
        )}
      </div>

      {showNewForm && (
        <NewPurchaseDrawer
          suppliers={suppliers}
          pricingSettings={pricingSettings}
          onClose={() => setShowNewForm(false)}
          onSaved={() => { setShowNewForm(false); fetchPurchases(); }}
        />
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Price Update Settings</h3>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-6">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center mt-0.5 shrink-0">
                  <input type="checkbox" className="sr-only" 
                    checked={pricingSettings.updateExisting} 
                    onChange={e => savePricingSettings({ ...pricingSettings, updateExisting: e.target.checked })} />
                  <div className={`w-10 h-5 rounded-full transition-colors ${pricingSettings.updateExisting ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
                  <div className={`absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform ${pricingSettings.updateExisting ? 'translate-x-5' : ''}`}></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">Update selling price of existing stock</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Give option to change the Selling Price for stock items if you purchase them at a different rate.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center mt-0.5 shrink-0">
                  <input type="checkbox" className="sr-only" 
                    checked={pricingSettings.updateNew} 
                    onChange={e => savePricingSettings({ ...pricingSettings, updateNew: e.target.checked })} />
                  <div className={`w-10 h-5 rounded-full transition-colors ${pricingSettings.updateNew ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
                  <div className={`absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform ${pricingSettings.updateNew ? 'translate-x-5' : ''}`}></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">Set selling price for new products</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Give option to immediately map out a Selling Price when adding and procuring a brand new product.</p>
                </div>
              </label>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button className="btn-primary w-full justify-center" onClick={() => setShowSettings(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
      {viewPurchase && (
        <PurchaseDetailModal
          purchase={viewPurchase}
          onClose={() => setViewPurchase(null)}
          onPayment={p => { setViewPurchase(null); setShowPaymentModal(p); }}
        />
      )}
      {showPaymentModal && (
        <RecordPaymentModal
          purchase={showPaymentModal}
          onClose={() => setShowPaymentModal(null)}
          onSaved={() => { setShowPaymentModal(null); fetchPurchases(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// NEW PURCHASE DRAWER
// ─────────────────────────────────────────────────────────
function NewPurchaseDrawer({ suppliers: initialSuppliers, onClose, onSaved, pricingSettings }) {
  const [allSuppliers, setAllSuppliers] = useState(initialSuppliers || []);
  const [supplier, setSupplier] = useState(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierResults, setSupplierResults] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [isCredit, setIsCredit] = useState(false);
  const [paidAmount, setPaidAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [items, setItems] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const productSearchRef = useRef(null);

  // Inline Add New Supplier modal
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', mobile: '' });
  const [addingSupplier, setAddingSupplier] = useState(false);

  // Inline Add New Product form
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', purchasePrice: '', gstPercent: '0', unitType: 'PCS', barcode: '' });
  const [addingProduct, setAddingProduct] = useState(false);

  const handleAddNewSupplier = async (e) => {
    e.preventDefault();
    if (!newSupplier.name) { toast.error('Supplier name required'); return; }
    setAddingSupplier(true);
    try {
      const res = await suppliersAPI.create(newSupplier);
      const s = res.data;
      setAllSuppliers(prev => [...prev, s]);
      setSupplier(s);
      setShowAddSupplier(false);
      setNewSupplier({ name: '', mobile: '' });
      toast.success('Supplier added!');
    } catch { toast.error('Failed to add supplier'); } finally { setAddingSupplier(false); }
  };

  const handleAddNewProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.name) { toast.error('Product name required'); return; }
    setAddingProduct(true);
    try {
      const res = await productsAPI.create({
        name: newProduct.name,
        barcode: newProduct.barcode || null,
        purchasePrice: Number(newProduct.purchasePrice) || 0,
        retailPrice: Number(newProduct.purchasePrice) || 0,
        gstPercent: Number(newProduct.gstPercent) || 0,
        unitType: newProduct.unitType || 'PCS',
        openingStock: 0,
        currentStock: 0,
        pricingTiers: [],
      });
      const p = res.data;
      addItem(p);
      setShowAddProduct(false);
      setNewProduct({ name: '', purchasePrice: '', gstPercent: '0', unitType: 'PCS', barcode: '' });
      toast.success('Product added and added to cart!');
    } catch { toast.error('Failed to add product'); } finally { setAddingProduct(false); }
  };

  useEffect(() => {
    if (!supplierSearch.trim()) { setSupplierResults([]); return; }
    const filtered = allSuppliers.filter(s =>
      s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      s.mobile?.includes(supplierSearch)
    );
    setSupplierResults(filtered);
  }, [supplierSearch, allSuppliers]);

  useEffect(() => {
    if (!productSearch.trim()) { setProductResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await productsAPI.list({ search: productSearch, limit: 8 });
        setProductResults(res.data.products || []);
      } catch {
        setProductResults(MOCK_PRODUCTS.filter(p =>
          p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
          p.barcode?.includes(productSearch)
        ));
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const addItem = (product) => {
    const exists = items.find(i => i.productId === product.id);
    if (exists) {
      setItems(items.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      let availableUnits = [];
      if (product.pricingTiers && Array.isArray(product.pricingTiers) && product.pricingTiers.length > 0) {
        const masterTier = product.pricingTiers.reduce((prev, curr) => ((prev.units || []).length > (curr.units || []).length) ? prev : curr, product.pricingTiers[0]);
        if (masterTier && Array.isArray(masterTier.units)) {
           availableUnits = masterTier.units.map(u => ({ name: u.name, costPrice: Number(u.costPrice) || 0 }));
        }
      }
      
      if (availableUnits.length === 0) {
         availableUnits = [{ name: product.unitType || 'PCS', costPrice: Number(product.purchasePrice) || 0 }];
      }

      let defaultUnit = availableUnits.find(u => u.name === product.unitType) || availableUnits[availableUnits.length - 1];

      let suggestedRetail = 0;
      if (Number(product.purchasePrice) > 0) {
         const margin = (Number(product.retailPrice) || 0) / Number(product.purchasePrice);
         suggestedRetail = (defaultUnit.costPrice || Number(product.purchasePrice)) * margin;
      } else {
         suggestedRetail = (defaultUnit.costPrice || Number(product.purchasePrice)) * 1.25; // 25% default markup
      }

      setItems([...items, {
        productId: product.id,
        name: product.name,
        barcode: product.barcode,
        unitType: defaultUnit.name,
        purchasePrice: defaultUnit.costPrice || Number(product.purchasePrice) || 0,
        suggestedRetail,
        newSellingPrice: '', // blank by default
        gstPercent: Number(product.gstPercent) || 0,
        quantity: 1,
        currentStock: Number(product.currentStock),
        availableUnits
      }]);
    }
    setProductSearch('');
    setProductResults([]);
    setTimeout(() => productSearchRef.current?.focus(), 50);
  };

  const updateItem = (productId, field, value) => {
    setItems(items.map(i => {
       if (i.productId !== productId) return i;
       if (field === 'newSellingPrice') return { ...i, [field]: value }; // Keep string to allow empty value
       return { ...i, [field]: Number(value) || 0 };
    }));
  };

  const removeItem = (productId) => setItems(items.filter(i => i.productId !== productId));

  const subtotal = items.reduce((s, i) => s + i.purchasePrice * i.quantity, 0);
  const totalGst = items.reduce((s, i) => s + (i.purchasePrice * i.quantity * i.gstPercent / 100), 0);
  const discAmt = Number(discount) || 0;
  const grandTotal = subtotal + totalGst - discAmt;
  const paid = isCredit ? (Number(paidAmount) || 0) : grandTotal;
  const balance = grandTotal - paid;

  const handleSave = async () => {
    if (items.length === 0) { toast.error('Add at least one product'); return; }
    setSaving(true);
    try {
      await purchasesAPI.create({
        supplierId: supplier?.id || null,
        invoiceNumber: invoiceNumber || null,
        purchaseDate,
        items: items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          unitType: i.unitType,
          purchasePrice: i.purchasePrice,
          gstPercent: i.gstPercent,
          newSellingPrice: i.newSellingPrice === '' ? null : Number(i.newSellingPrice)
        })),
        discount: discAmt,
        paymentMode: isCredit && paid === 0 ? 'CREDIT' : paymentMode,
        paidAmount: paid,
        isCredit,
        notes,
      });
      toast.success('Purchase saved! Stock updated.');
      onSaved();
    } catch { /* global handler */ } finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-4xl bg-white shadow-2xl flex flex-col">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
              <Package size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">New Purchase</h2>
              <p className="text-xs text-slate-400">Record inventory purchase · stock updates automatically</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* ── Left: Products ── */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-100">

            {/* Meta row */}
            <div className="p-5 border-b border-slate-100 grid grid-cols-3 gap-4">
              {/* Supplier search + Add New */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Supplier</label>
                  <button
                    type="button"
                    onClick={() => setShowAddSupplier(true)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <Plus size={11} /> Add New
                  </button>
                </div>
                <div className="relative">
                  <Truck size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={supplier ? supplier.name : supplierSearch}
                    onChange={e => { setSupplierSearch(e.target.value); if (supplier) setSupplier(null); }}
                    placeholder="Search supplier..."
                    className="input pl-8 pr-7 text-sm"
                  />
                  {supplier && (
                    <button onClick={() => { setSupplier(null); setSupplierSearch(''); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X size={12} />
                    </button>
                  )}
                </div>
                {supplierResults.length > 0 && !supplier && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-10 overflow-hidden">
                    {supplierResults.map(s => (
                      <button key={s.id}
                        onClick={() => { setSupplier(s); setSupplierSearch(''); setSupplierResults([]); }}
                        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-blue-50 text-left">
                        <span className="text-sm font-medium">{s.name}</span>
                        {Number(s.currentBalance) > 0 && (
                          <span className="text-xs text-amber-600">Due: {fmt(s.currentBalance)}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {supplier && Number(supplier.currentBalance) > 0 && (
                  <p className="text-xs text-amber-600 mt-1">Outstanding: {fmt(supplier.currentBalance)}</p>
                )}
              </div>

              <div>
                <label className="label">Supplier Invoice No.</label>
                <div className="relative">
                  <FileText size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-2024-001" className="input pl-8 text-sm" />
                </div>
              </div>

              <div>
                <label className="label">Purchase Date</label>
                <div className="relative">
                  <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)}
                    className="input pl-8 text-sm" />
                </div>
              </div>
            </div>

            {/* Product search + Add New */}
            <div className="px-5 py-3 border-b border-slate-100">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Add Items</span>
                <button
                  type="button"
                  onClick={() => setShowAddProduct(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <Plus size={11} /> New Item
                </button>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={productSearchRef}
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="Type product name or scan barcode to add items..."
                  className="input pl-9"
                />
                {productResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-10 overflow-hidden max-h-56 overflow-y-auto">
                    {productResults.map(p => (
                      <button key={p.id} onClick={() => addItem(p)}
                        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-blue-50 text-left">
                        <div>
                          <div className="text-sm font-medium">{p.name}</div>
                          <div className="text-xs text-slate-400">{p.barcode || 'No barcode'} · Stock: {p.currentStock}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">{fmt(p.purchasePrice)}</div>
                          <div className="text-xs text-slate-400">+{p.gstPercent}% GST</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Items table */}
            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-3">
                  <Package size={52} strokeWidth={0.75} />
                  <p className="text-sm text-slate-400">Add products using the search bar above</p>
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="text-center w-36">Quantity</th>
                      <th className="text-center w-32">Purchase Price</th>
                      {(pricingSettings?.updateExisting || pricingSettings?.updateNew) && (
                         <th className="text-center w-32">Selling Price</th>
                      )}
                      <th className="text-center w-24">GST %</th>
                      <th className="text-right w-32">Amount</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => {
                      const base = item.purchasePrice * item.quantity;
                      const gst = base * item.gstPercent / 100;
                      return (
                        <tr key={item.productId}>
                          <td>
                            <div className="font-medium text-slate-800">{item.name}</div>
                            <div className="mt-1 flex items-center gap-2">
                              {item.barcode && <div className="text-xs text-slate-400 font-mono">{item.barcode}</div>}
                              {item.availableUnits && item.availableUnits.length > 1 ? (
                                <select 
                                  value={item.unitType}
                                  onChange={(e) => {
                                    const selectedUnit = item.availableUnits.find(u => u.name === e.target.value);
                                    if (selectedUnit) {
                                      setItems(prev => prev.map(i => i.productId === item.productId ? {
                                        ...i, 
                                        unitType: selectedUnit.name, 
                                        purchasePrice: selectedUnit.costPrice || i.purchasePrice 
                                      } : i));
                                    }
                                  }}
                                  className="input py-0 px-1 text-[10px] w-auto h-5 inline-block border-slate-200 bg-slate-50"
                                >
                                  {item.availableUnits.map(u => (
                                    <option key={u.name} value={u.name}>{u.name}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="badge-slate text-[10px] py-0.5">{item.unitType}</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-1 justify-center">
                              <button
                                onClick={() => item.quantity > 1 ? updateItem(item.productId, 'quantity', item.quantity - 1) : removeItem(item.productId)}
                                className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-500"
                              ><Minus size={10} /></button>
                              <input type="number" min="0.001" step="0.001"
                                value={item.quantity}
                                onChange={e => updateItem(item.productId, 'quantity', e.target.value)}
                                className="w-16 input py-1 text-xs text-center" />
                              <button
                                onClick={() => updateItem(item.productId, 'quantity', item.quantity + 1)}
                                className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-500 text-sm"
                              >+</button>
                            </div>
                          </td>
                          <td>
                            <input type="number" min="0" step="0.01"
                              value={item.purchasePrice}
                              onChange={e => {
                                 const newCost = Number(e.target.value) || 0;
                                 let newSuggestedRetail = item.suggestedRetail;
                                 if (item.purchasePrice > 0) {
                                     newSuggestedRetail = newCost * (item.suggestedRetail / item.purchasePrice);
                                 }
                                 setItems(items.map(i => i.productId === item.productId ? { ...i, purchasePrice: newCost, suggestedRetail: newSuggestedRetail } : i));
                              }}
                              className="w-full input py-1 text-xs text-center font-medium" />
                          </td>
                          {(pricingSettings?.updateExisting || pricingSettings?.updateNew) && (
                            <td>
                              <input type="number" min="0" step="0.01"
                                placeholder={`Sug: ${fmt(item.suggestedRetail || 0).replace('₹', '')}`}
                                value={item.newSellingPrice}
                                onChange={e => updateItem(item.productId, 'newSellingPrice', e.target.value)}
                                className="w-full input py-1 text-xs text-center text-blue-600 font-medium placeholder:text-blue-300" />
                            </td>
                          )}
                          <td>
                            <select value={item.gstPercent}
                              onChange={e => updateItem(item.productId, 'gstPercent', e.target.value)}
                              className="w-full input py-1 text-xs text-center">
                              {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                            </select>
                          </td>
                          <td className="text-right">
                            <div className="font-semibold text-sm">{fmt(base + gst)}</div>
                            {item.gstPercent > 0 && (
                              <div className="text-xs text-slate-400">+{fmt(gst)} GST</div>
                            )}
                          </td>
                          <td>
                            <button onClick={() => removeItem(item.productId)}
                              className="text-slate-300 hover:text-red-500 transition-colors p-1">
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Notes */}
            <div className="px-5 py-3 border-t border-slate-100">
              <input value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Purchase notes (optional)..." className="input text-sm" />
            </div>
          </div>

          {/* ── Right: Bill ── */}
          <div className="w-72 flex-shrink-0 flex flex-col bg-slate-50/50">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Totals */}
              <div className="card p-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Summary</h3>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal ({items.length} items)</span>
                    <span>{fmt(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total GST</span>
                    <span>{fmt(totalGst)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Discount (₹)</span>
                    <input type="number" min="0" value={discount}
                      onChange={e => setDiscount(e.target.value)}
                      placeholder="0"
                      className="w-24 input py-1 text-xs text-right" />
                  </div>
                  <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-base">
                    <span>Grand Total</span>
                    <span className="text-blue-600">{fmt(grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Payment mode */}
              <div className="card p-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Payment</h3>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {PAYMENT_MODES.map(mode => (
                    <button key={mode}
                      onClick={() => { setPaymentMode(mode); setIsCredit(mode === 'CREDIT'); }}
                      className={`py-2 rounded-lg text-xs font-medium transition-all
                        ${paymentMode === mode ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >{mode}</button>
                  ))}
                </div>

                {isCredit ? (
                  <div>
                    <label className="label">Advance Paid (Optional)</label>
                    <input type="number" min="0" value={paidAmount}
                      onChange={e => setPaidAmount(e.target.value)}
                      placeholder="0" className="input text-sm" />
                    <div className="mt-2 flex justify-between text-xs">
                      <span className="text-slate-500">Balance due:</span>
                      <span className={`font-semibold ${balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {fmt(balance)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50 rounded-lg px-3 py-2.5 text-xs text-emerald-700 flex items-center gap-2">
                    <CheckCircle2 size={14} />
                    Full payment: {fmt(grandTotal)}
                  </div>
                )}
              </div>
            </div>

            {/* Save button */}
            <div className="p-5 border-t border-slate-200">
              <button onClick={handleSave} disabled={saving || items.length === 0}
                className="btn-primary btn-lg w-full justify-center rounded-xl">
                {saving ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : <><Save size={18} /> Save Purchase</>}
              </button>
              <p className="text-xs text-slate-400 text-center mt-2">
                Stock will be updated automatically
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Add New Supplier Modal */}
      {showAddSupplier && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800">Add New Supplier</h3>
              <button onClick={() => setShowAddSupplier(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <form onSubmit={handleAddNewSupplier} className="p-5 space-y-3">
              <div>
                <label className="label">Supplier Name <span className="text-red-500">*</span></label>
                <input type="text" required value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} className="input w-full" placeholder="e.g. ABC Distributors" autoFocus />
              </div>
              <div>
                <label className="label">Mobile Number</label>
                <input type="text" value={newSupplier.mobile} onChange={e => setNewSupplier({...newSupplier, mobile: e.target.value})} className="input w-full" placeholder="10-digit mobile" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddSupplier(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={addingSupplier} className="btn-primary flex-1 justify-center">
                  {addingSupplier ? <Loader2 size={14} className="animate-spin" /> : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800">Add New Item</h3>
              <button onClick={() => setShowAddProduct(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <form onSubmit={handleAddNewProduct} className="p-5 space-y-3">
              <div>
                <label className="label">Product Name <span className="text-red-500">*</span></label>
                <input type="text" required value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="input w-full" placeholder="e.g. Parle-G 200g" autoFocus />
              </div>
              <div>
                <label className="label">Barcode (optional)</label>
                <input type="text" value={newProduct.barcode} onChange={e => setNewProduct({...newProduct, barcode: e.target.value})} className="input w-full" placeholder="Scan or type barcode" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Purchase Price (₹)</label>
                  <input type="number" min="0" step="0.01" value={newProduct.purchasePrice} onChange={e => setNewProduct({...newProduct, purchasePrice: e.target.value})} className="input w-full" placeholder="0.00" />
                </div>
                <div>
                  <label className="label">GST %</label>
                  <select value={newProduct.gstPercent} onChange={e => setNewProduct({...newProduct, gstPercent: e.target.value})} className="input w-full">
                    {[0,5,12,18,28].map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Unit Type</label>
                <select value={newProduct.unitType} onChange={e => setNewProduct({...newProduct, unitType: e.target.value})} className="input w-full">
                  {['PCS','KG','LTR','BOX','DOZEN','PACK','BAG','BUNDLE'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddProduct(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={addingProduct} className="btn-primary flex-1 justify-center">
                  {addingProduct ? <Loader2 size={14} className="animate-spin" /> : 'Add to Cart'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────
function PurchaseDetailModal({ purchase, onClose, onPayment }) {
  const [detail, setDetail] = useState(purchase);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    purchasesAPI.get(purchase.id)
      .then(r => setDetail(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [purchase.id]);

  const p = detail;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h2 className="font-semibold text-slate-800">
                Purchase — {p.invoiceNumber || `#${p.id?.slice(-6)}`}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {fmtDate(p.purchaseDate)} · {p.supplier?.name || 'No supplier'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-secondary btn-sm gap-1"><Printer size={13} /> Print</button>
              <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="text-center py-10"><Loader2 size={24} className="animate-spin text-blue-500 mx-auto" /></div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 mb-5">
                  {[
                    { label: 'Supplier', value: p.supplier?.name || '—' },
                    { label: 'Invoice #', value: p.invoiceNumber || '—' },
                    { label: 'Date', value: fmtDate(p.purchaseDate) },
                  ].map(m => (
                    <div key={m.label} className="bg-slate-50 rounded-xl p-3">
                      <div className="text-xs text-slate-500">{m.label}</div>
                      <div className="font-medium text-slate-700 mt-0.5 text-sm">{m.value}</div>
                    </div>
                  ))}
                </div>

                {(p.items || []).length > 0 && (
                  <div className="table-wrapper mb-5">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Product</th>
                          <th className="text-center">Qty</th>
                          <th className="text-right">Price</th>
                          <th className="text-right">GST</th>
                          <th className="text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.items.map((item, i) => (
                          <tr key={item.id || i}>
                            <td className="text-slate-400">{i + 1}</td>
                            <td>
                              <div className="font-medium">{item.product?.name || item.name}</div>
                              <div className="text-xs text-slate-400">{item.unitType}</div>
                            </td>
                            <td className="text-center">{item.quantity}</td>
                            <td className="text-right">{fmt(item.purchasePrice)}</td>
                            <td className="text-right text-slate-500">{fmt(item.gstAmount)}</td>
                            <td className="text-right font-semibold">{fmt(item.totalAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
                  {[
                    { label: 'Subtotal', value: fmt(p.subtotal) },
                    { label: 'Total GST', value: fmt(p.totalGst) },
                    { label: 'Discount', value: Number(p.totalDiscount) > 0 ? `-${fmt(p.totalDiscount)}` : '—' },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between text-slate-600">
                      <span>{r.label}</span><span>{r.value}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-base">
                    <span>Grand Total</span><span>{fmt(p.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>Paid</span><span>{fmt(p.paidAmount)}</span>
                  </div>
                  {Number(p.balanceAmount) > 0 && (
                    <div className="flex justify-between text-amber-600 font-semibold">
                      <span>Balance Due</span><span>{fmt(p.balanceAmount)}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {Number(p.balanceAmount) > 0 && (
            <div className="px-6 py-4 border-t border-slate-100">
              <button onClick={() => onPayment(p)} className="btn-primary w-full justify-center">
                <IndianRupee size={16} /> Record Payment — {fmt(p.balanceAmount)} due
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// RECORD PAYMENT MODAL
// ─────────────────────────────────────────────────────────
function RecordPaymentModal({ purchase, onClose, onSaved }) {
  const [amount, setAmount] = useState(String(Number(purchase.balanceAmount || 0).toFixed(2)));
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (amt > Number(purchase.balanceAmount)) { toast.error('Amount exceeds balance'); return; }
    setSaving(true);
    try {
      await purchasesAPI.recordPayment(purchase.id, { amount: amt, paymentMode, notes });
      toast.success('Payment recorded');
      onSaved();
    } catch { toast.success('Payment recorded (demo)'); onSaved(); } finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Record Payment</h2>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-amber-50 rounded-xl p-4 text-sm border border-amber-100">
              <div className="flex justify-between mb-1.5">
                <span className="text-amber-700">Supplier</span>
                <span className="font-semibold">{purchase.supplier?.name}</span>
              </div>
              <div className="flex justify-between mb-1.5">
                <span className="text-amber-700">Invoice</span>
                <span className="font-medium">{purchase.invoiceNumber || '—'}</span>
              </div>
              <div className="flex justify-between pt-2 mt-1 border-t border-amber-200 text-base font-bold">
                <span className="text-amber-700">Balance Due</span>
                <span className="text-amber-800">{fmt(purchase.balanceAmount)}</span>
              </div>
            </div>

            <div>
              <label className="label">Payment Amount (₹)</label>
              <input type="number" min="0.01" step="0.01" max={purchase.balanceAmount}
                value={amount} onChange={e => setAmount(e.target.value)}
                className="input text-xl font-bold" autoFocus />
            </div>

            <div>
              <label className="label">Payment Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {['CASH', 'UPI', 'CARD'].map(mode => (
                  <button key={mode} onClick={() => setPaymentMode(mode)}
                    className={`py-2 rounded-lg text-sm font-medium transition-all
                      ${paymentMode === mode ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Notes (optional)</label>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Paid via NEFT Ref #12345" className="input" />
            </div>
          </div>

          <div className="px-6 pb-6 flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {saving ? 'Saving...' : 'Record Payment'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
