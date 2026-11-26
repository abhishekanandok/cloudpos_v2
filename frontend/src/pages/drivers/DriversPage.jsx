import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit2, Loader2, X, Check, Eye, EyeOff, BarChart3, Truck, Package, ArrowUp, ArrowDown, History,FileText } from 'lucide-react';
import { driversAPI, productsAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

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

// ── Driver Form Modal ─────────────────────────────────────
function DriverModal({ driver, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: driver?.name || '', mobile: driver?.mobile || '',
    loginId: driver?.loginId || '', password: '',
    vehicle: driver?.vehicle || '',
  });
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSave = async () => {
    if (!form.name || !form.loginId) { toast.error('Name and Login ID required'); return; }
    if (!driver && !form.password) { toast.error('Password required'); return; }
    setSaving(true);
    try {
      driver ? await driversAPI.update(driver.id, form) : await driversAPI.create(form);
      toast.success(driver ? 'Driver updated' : 'Driver created');
      onSaved();
    } catch {} finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">{driver ? 'Edit Driver' : 'Add Driver'}</h2>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Driver Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="input" placeholder="e.g. Ramesh" />
              </div>
              <div>
                <label className="label">Mobile</label>
                <input value={form.mobile} onChange={e => setForm(f => ({...f, mobile: e.target.value}))} className="input" placeholder="9876543210" />
              </div>
            </div>
            <div>
              <label className="label">Vehicle / Van Name</label>
              <input value={form.vehicle} onChange={e => setForm(f => ({...f, vehicle: e.target.value}))} className="input" placeholder="e.g. Van 1, Bike 2" />
            </div>
            <div>
              <label className="label">Login ID *</label>
              <input value={form.loginId} onChange={e => setForm(f => ({...f, loginId: e.target.value}))} className="input" placeholder="ramesh_driver" disabled={!!driver} />
            </div>
            <div>
              <label className="label">{driver ? 'New Password (blank = no change)' : 'Password *'}</label>
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
              {saving ? 'Saving...' : 'Save Driver'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Vehicle Stock Modal ───────────────────────────────────
function VehicleStockModal({ driver, onClose }) {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    driversAPI.vehicleStock(driver.id)
      .then(r => setStock(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [driver.id]);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h2 className="font-semibold text-slate-800">Vehicle Stock — {driver.name}</h2>
              <p className="text-xs text-slate-400">{driver.vehicle || 'No vehicle assigned'}</p>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
            ) : stock.length === 0 ? (
              <div className="text-center py-12 text-slate-400"><Package size={36} strokeWidth={1} className="mx-auto mb-2" /><p>No stock loaded</p></div>
            ) : (
              <table className="table">
                <thead><tr><th>Product</th><th>Barcode</th><th className="text-right">Qty</th></tr></thead>
                <tbody>
                  {stock.map(s => (
                    <tr key={s.id}>
                      <td className="font-medium">{s.product.name}</td>
                      <td className="font-mono text-xs text-slate-400">{s.product.barcode || '—'}</td>
                      <td className="text-right font-bold text-blue-600">{formatStockQty(Number(s.quantity), s.product)}</td>
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

// ── Load/Unload Stock Modal ───────────────────────────────
const getMasterTierUnits = (product) => {
  let units = [{ name: product.unitType || 'PCS', quantity: 1 }];
  if (Array.isArray(product.pricingTiers) && product.pricingTiers.length > 0) {
    const masterTier = product.pricingTiers.reduce((prev, curr) => ((prev.units || []).length > (curr.units || []).length) ? prev : curr, product.pricingTiers[0]);
    if (masterTier && Array.isArray(masterTier.units) && masterTier.units.length > 0) {
      units = masterTier.units;
    }
  }
  return units;
};

const calculateTotalBase = (qtyMap, units) => {
  let total = 0;
  units.forEach((unit, idx) => {
    const val = Number(qtyMap[unit.name]);
    if (!val || isNaN(val)) return;
    let multiplier = 1;
    for (let j = idx + 1; j < units.length; j++) {
      multiplier *= (Number(units[j].quantity) || 1);
    }
    total += val * multiplier;
  });
  return total;
};

function LoadStockModal({ driver, type, onClose, onSaved }) {
  const [products, setProducts] = useState([]);
  const [vehicleStock, setVehicleStock] = useState([]);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (type === 'UNLOAD') {
      driversAPI.vehicleStock(driver.id).then(r => setVehicleStock(r.data || [])).catch(() => {});
    }
  }, [driver.id, type]);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await productsAPI.list({ search, limit: 8 });
        setResults(res.data.products || []);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const addItem = (product) => {
    const existing = items.find(i => i.productId === product.id);
    if (existing) return;
    const maxQty = type === 'UNLOAD' ? Number(vehicleStock.find(s => s.productId === product.id)?.quantity || 0) : Number(product.currentStock);
    
    const unitsList = getMasterTierUnits(product);
    const qtyMap = {};
    unitsList.forEach(u => qtyMap[u.name] = '');

    setItems(prev => [...prev, { 
      productId: product.id, 
      name: product.name, 
      unitType: product.unitType, 
      maxQty,
      units: unitsList,
      qtyMap,
      totalBase: 0
    }]);
    setSearch(''); setResults([]);
  };

  const handleQtyChange = (productId, unitName, value) => {
    if (!/^\d*\.?\d*$/.test(value)) return;
    setItems(prev => prev.map(item => {
      if (item.productId !== productId) return item;
      const newQtyMap = { ...item.qtyMap, [unitName]: value };
      const totalBase = calculateTotalBase(newQtyMap, item.units);
      return { ...item, qtyMap: newQtyMap, totalBase };
    }));
  };

  const handleSave = async () => {
    if (items.length === 0) { toast.error('Add at least one product'); return; }
    if (items.some(i => i.totalBase <= 0 || i.totalBase > i.maxQty)) {
      toast.error('Check quantities. Ensure they are greater than 0 and do not exceed available stock.');
      return;
    }
    setSaving(true);
    try {
      const payload = { driverId: driver.id, items: items.map(i => ({ productId: i.productId, quantity: i.totalBase })) };
      type === 'LOAD' ? await driversAPI.loadStock(payload) : await driversAPI.unloadStock(payload);
      toast.success(type === 'LOAD' ? 'Stock loaded to vehicle!' : 'Stock unloaded to shop!');
      onSaved();
    } catch {} finally { setSaving(false); }
  };

  const sourceList = type === 'UNLOAD' ? vehicleStock.map(s => ({ ...s.product, currentStock: Number(s.quantity) })) : [];

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                {type === 'LOAD' ? <ArrowDown size={18} className="text-blue-600" /> : <ArrowUp size={18} className="text-emerald-600" />}
                {type === 'LOAD' ? 'Load Stock to Vehicle' : 'Unload Stock to Shop'}
              </h2>
              <p className="text-xs text-slate-400">{driver.name} — {driver.vehicle || 'No vehicle'}</p>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
          </div>

          <div className="p-4 border-b border-slate-100">
            {type === 'LOAD' ? (
              <div className="relative">
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product to add..." className="input" />
                {results.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                    {results.map(p => (
                      <button key={p.id} onClick={() => addItem(p)} className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-blue-50 text-left">
                        <div><div className="text-sm font-medium">{p.name}</div><div className="text-xs text-slate-400">Stock: {Number(p.currentStock)} {p.unitType}</div></div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-[30vh] overflow-y-auto pr-2 pb-1">
                {sourceList.filter(p => !items.find(i => i.productId === p.id)).map(p => (
                  <button key={p.id} onClick={() => addItem(p)} className="btn-secondary btn-sm gap-1"><Plus size={12} />{p.name} ({p.currentStock})</button>
                ))}
                {sourceList.length === 0 && <p className="text-slate-400 text-sm">No vehicle stock to unload</p>}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {items.length === 0 ? (
              <div className="text-center py-8 text-slate-400"><Package size={32} strokeWidth={1} className="mx-auto mb-2" /><p className="text-sm">Add products above</p></div>
            ) : (
              <div className="space-y-4">
                {items.map((item, i) => {
                  const isOver = item.totalBase > item.maxQty;
                  return (
                  <div key={item.productId} className={`p-4 bg-slate-50 rounded-xl border ${isOver ? 'border-red-300' : 'border-slate-100'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div><p className="font-semibold text-slate-800">{item.name}</p><p className="text-xs text-slate-500">Max Available: {item.maxQty} {item.unitType}</p></div>
                      <button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"><X size={16} /></button>
                    </div>
                    <div className="flex flex-wrap gap-2 items-end">
                      {item.units.map((u) => (
                        <div key={u.name} className="flex-1 min-w-[70px]">
                          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 px-1">{u.name}</label>
                          <input type="text" value={item.qtyMap[u.name]}
                            onFocus={e => e.target.select()}
                            onChange={e => handleQtyChange(item.productId, u.name, e.target.value)}
                            placeholder="0"
                            className="input text-center text-sm w-full py-1.5 font-bold" />
                        </div>
                      ))}
                    </div>
                    <div className={`mt-3 pt-3 border-t text-sm font-medium flex justify-between ${isOver ? 'text-red-600 border-red-200' : 'text-blue-600 border-blue-100'}`}>
                      <span>Total equivalent:</span>
                      <span>{item.totalBase} {item.unitType}</span>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-100">
            <button onClick={handleSave} disabled={saving || items.length === 0 || items.some(i => i.totalBase <= 0 || i.totalBase > i.maxQty)} className="btn-primary w-full justify-center">
              {saving ? <Loader2 size={16} className="animate-spin" /> : type === 'LOAD' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
              {saving ? 'Processing...' : type === 'LOAD' ? `Load ${items.length} Products` : `Unload ${items.length} Products`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Report Modal ──────────────────────────────────────────
function ReportModal({ onClose }) {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetch = async () => {
    setLoading(true);
    try { const res = await driversAPI.report({ startDate: dateFrom, endDate: dateTo }); setReport(res.data || []); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Driver / Vehicle Report</h2>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
          </div>
          <div className="p-4 border-b border-slate-100 flex gap-3">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input w-36" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input w-36" />
            <button onClick={fetch} className="btn-primary">Apply</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
            ) : (
              <table className="table">
                <thead><tr><th>Driver</th><th>Vehicle</th><th className="text-center">Bills</th><th className="text-right">Total Sales</th><th className="text-right">Collected</th><th className="text-right">Credit</th></tr></thead>
                <tbody>
                  {report.map(r => (
                    <tr key={r.id}>
                      <td><div className="font-medium">{r.name}</div><div className="text-xs text-slate-400">{r.loginId}</div></td>
                      <td className="text-slate-500">{r.vehicle || '—'}</td>
                      <td className="text-center"><span className="badge-slate">{r.totalBills}</span></td>
                      <td className="text-right font-semibold">{fmt(r.totalSales)}</td>
                      <td className="text-right text-emerald-600">{fmt(r.totalCollected)}</td>
                      <td className="text-right text-amber-600">{r.totalCredit > 0 ? fmt(r.totalCredit) : <span className="text-slate-300">—</span>}</td>
                    </tr>
                  ))}
                  {report.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-slate-400">No data found</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function DriversPage() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editDriver, setEditDriver] = useState(null);
  const [stockModal, setStockModal] = useState(null);
  const [loadModal, setLoadModal] = useState(null); // { driver, type }
  const [showReport, setShowReport] = useState(false);
  const navigate = useNavigate();

  const fetch = async () => {
    setLoading(true);
    try { const res = await driversAPI.list(); setDrivers(res.data || []); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const handleDelete = async (id, name) => {
    if (!confirm(`Deactivate driver "${name}"?`)) return;
    try { await driversAPI.delete(id); toast.success('Driver deactivated'); fetch(); }
    catch {}
  };

  return (
    <div className="max-w-5xl mx-auto bg-slate-100/60 p-4 sm:p-6 rounded-3xl min-h-[calc(100vh-100px)] border border-slate-200/60">
      <div className="page-header">
        <div>
          <h1 className="page-title">Drivers & Vehicles</h1>
          <p className="page-subtitle">Manage vehicle-based sales, stock loading and driver performance</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/drivers/dashboard')} className="btn-secondary gap-1"><BarChart3 size={15} /> Dashboard</button>
          <button onClick={() => setShowReport(true)} className="btn-secondary gap-1"><History size={15} /> Report</button>
          <button onClick={() => { setEditDriver(null); setShowModal(true); }} className="btn-primary"><Plus size={16} /> Add Driver</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Vehicle</th>
                <th>Login ID</th>
                <th className="text-center">Bills</th>
                <th className="text-center">Stock Actions</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-14"><Loader2 size={24} className="animate-spin text-blue-500 mx-auto" /></td></tr>
              ) : drivers.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-14 text-slate-400">
                  <Truck size={36} strokeWidth={1} className="mx-auto mb-2" /><p>No drivers yet. Add your first driver!</p>
                </td></tr>
              ) : drivers.map(d => (
                <tr key={d.id}>
                  <td>
                    <div className="font-medium">{d.name}</div>
                    {d.mobile && <div className="text-xs text-slate-400">{d.mobile}</div>}
                  </td>
                  <td><span className={d.vehicle ? 'badge-blue' : 'text-slate-300'}>{d.vehicle || '—'}</span></td>
                  <td><span className="font-mono text-sm text-blue-600">{d.loginId}</span></td>
                  <td className="text-center"><span className="badge-slate">{d._count?.sales || 0}</span></td>
                  <td>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setStockModal(d)} className="btn-secondary btn-sm gap-1" title="View Vehicle Stock">
                        <Package size={12} /> Stock
                      </button>
                      <button onClick={() => setLoadModal({ driver: d, type: 'LOAD' })} className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1">
                        <ArrowDown size={11} /> Load
                      </button>
                      <button onClick={() => setLoadModal({ driver: d, type: 'UNLOAD' })} className="px-2 py-1 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg flex items-center gap-1">
                        <ArrowUp size={11} /> Unload
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => navigate(`/drivers/${d.id}/settlement`)} className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg" title="Trip Settlement"><FileText size={14} /></button>
                      <button onClick={() => { setEditDriver(d); setShowModal(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(d.id, d.name)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <DriverModal driver={editDriver} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetch(); }} />}
      {stockModal && <VehicleStockModal driver={stockModal} onClose={() => setStockModal(null)} />}
      {loadModal && <LoadStockModal driver={loadModal.driver} type={loadModal.type} onClose={() => setLoadModal(null)} onSaved={() => { setLoadModal(null); fetch(); }} />}
      {showReport && <ReportModal onClose={() => setShowReport(false)} />}
    </div>
  );
}
