import { useState, useEffect } from 'react';
import { Search, History, Save, Loader2, X, Package, CheckCircle2, Pencil } from 'lucide-react';
import { stockAPI, productsAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const REASONS = [
  { value: 'ADJUSTMENT', label: 'Manual Adjustment', color: 'badge-blue' },
  { value: 'DAMAGE', label: 'Damage', color: 'badge-red' },
  { value: 'EXPIRY', label: 'Expiry', color: 'badge-red' },
  { value: 'THEFT', label: 'Theft', color: 'badge-yellow' },
  { value: 'MANUAL_CORRECTION', label: 'Manual Correction', color: 'badge-slate' },
];

const fmtDate = (d) => { try { return format(new Date(d), 'dd MMM yyyy, hh:mm a'); } catch { return '—'; } };

// ── Helpers (same logic as AddProductPage) ────────────────────────────────────

/** Get the master tier (tier with most units) */
const getMasterUnits = (product) => {
  if (!product?.pricingTiers?.length) return [];
  const master = product.pricingTiers.reduce(
    (prev, curr) => ((prev.units || []).length > (curr.units || []).length) ? prev : curr,
    product.pricingTiers[0]
  );
  return master?.units || [];
};

/** Build { unitName -> multiplier } array (BOX has big multiplier, PCS has 1) */
const buildUnitMultipliers = (units) =>
  units.map((u, i) => {
    let multiplier = 1;
    for (let j = i + 1; j < units.length; j++) multiplier *= (Number(units[j].quantity) || 1);
    return { ...u, multiplier };
  });

/** Sum inputs object → total base pieces */
const calcTotalBase = (inputs, unitMultipliers) => {
  let total = 0;
  unitMultipliers.forEach(u => { total += (Number(inputs[u.name]) || 0) * u.multiplier; });
  return total;
};

/** Decompose base pieces → inputs object per unit */
const decomposeBase = (base, unitMultipliers) => {
  let remaining = Math.floor(Number(base) || 0);
  const result = {};
  for (const u of unitMultipliers) {
    const qty = Math.floor(remaining / u.multiplier);
    result[u.name] = qty;
    remaining %= u.multiplier;
  }
  return result;
};

/** Format stock nicely: "24 BOX, 15 PKT, 5 PCS" */
const formatStock = (base, unitMultipliers) => {
  if (!unitMultipliers?.length) return `${Math.floor(Number(base) || 0)} PCS`;
  const parts = [];
  let remaining = Math.floor(Number(base) || 0);
  for (const u of unitMultipliers) {
    const qty = Math.floor(remaining / u.multiplier);
    if (qty > 0) parts.push(`${qty} ${u.name}`);
    remaining %= u.multiplier;
  }
  return parts.length ? parts.join(', ') : '0';
};

// ─────────────────────────────────────────────────────────────────────────────

export default function StockPage() {
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Adjust form state
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [newQtyInputs, setNewQtyInputs] = useState({}); // multi-unit inputs
  const [reason, setReason] = useState('ADJUSTMENT');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastAdjusted, setLastAdjusted] = useState(null);

  // ── Edit history state
  const [editingEntry, setEditingEntry] = useState(null); // the history row being edited
  const [editForm, setEditForm] = useState({ reason: '', notes: '' });
  const [editSaving, setEditSaving] = useState(false);

  // Derived: master units & multipliers for selected product
  const masterUnits = selectedProduct ? getMasterUnits(selectedProduct) : [];
  const unitMultipliers = buildUnitMultipliers(masterUnits);
  const newQtyTotal = calcTotalBase(newQtyInputs, unitMultipliers);
  const currentBase = Number(selectedProduct?.currentStock) || 0;
  const diff = selectedProduct ? newQtyTotal - currentBase : 0;

  // Product search
  useEffect(() => {
    if (!productSearch.trim()) { setProductResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await productsAPI.list({ search: productSearch, limit: 8 });
        setProductResults(res.data.products || []);
      } catch { setProductResults([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [productSearch]);

  // History load
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await stockAPI.history();
      setHistory(res.data.history || []);
    } catch { setHistory([]); } finally { setHistoryLoading(false); }
  };
  useEffect(() => { fetchHistory(); }, []);

  // When product selected → pre-fill newQtyInputs with its current stock decomposed
  const handleSelectProduct = (p) => {
    setSelectedProduct(p);
    setProductSearch('');
    setProductResults([]);
    const units = getMasterUnits(p);
    const mults = buildUnitMultipliers(units);
    setNewQtyInputs(decomposeBase(p.currentStock, mults));
  };

  const handleClear = () => {
    setSelectedProduct(null);
    setProductSearch('');
    setProductResults([]);
    setNewQtyInputs({});
  };

  // Open edit modal pre-filled
  const openEdit = (h) => {
    // Strip [Edited: ...] prefix from notes for clean editing
    const cleanNotes = (h.notes || '').replace(/^\[Edited:.*?\]\s*/i, '').trim();
    setEditForm({ reason: h.reason, notes: cleanNotes });
    setEditingEntry(h);
  };

  const handleEditSave = async () => {
    if (!editingEntry) return;
    setEditSaving(true);
    try {
      const res = await stockAPI.editHistory(editingEntry.id, editForm);
      const updated = res.data.entry;
      // Update history list in-place
      setHistory(prev => prev.map(h => h.id === editingEntry.id ? { ...h, ...updated } : h));
      toast.success('History entry updated!');
      setEditingEntry(null);
    } catch {
      // global handler
    } finally {
      setEditSaving(false);
    }
  };

  const handleAdjust = async () => {
    if (!selectedProduct) { toast.error('Pehle product select karo'); return; }
    if (newQtyTotal < 0) { toast.error('Quantity valid nahi hai'); return; }
    if (!reason) { toast.error('Reason select karo'); return; }
    setSaving(true);
    try {
      await stockAPI.adjust({ productId: selectedProduct.id, newQty: newQtyTotal, reason, notes });
      const displayNew = masterUnits.length > 1
        ? formatStock(newQtyTotal, unitMultipliers)
        : `${newQtyTotal} ${masterUnits[0]?.name || 'PCS'}`;
      const displayOld = masterUnits.length > 1
        ? formatStock(currentBase, unitMultipliers)
        : `${currentBase} ${masterUnits[0]?.name || 'PCS'}`;
      setLastAdjusted({ product: selectedProduct.name, displayOld, displayNew, diff });
      toast.success(`Stock updated! ${diff > 0 ? '+' : ''}${diff} base units`);
      handleClear();
      setNotes('');
      fetchHistory();
    } catch {
      // global error handler
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock Update</h1>
          <p className="page-subtitle">Adjust stock levels and view history</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* ── Adjust Form ── */}
        <div className="xl:col-span-1 space-y-4">
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-sm text-slate-700">Adjust Stock</h3>
            </div>
            <div className="card-body space-y-4">

              {/* Product Search */}
              <div>
                <label className="label">Product</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={selectedProduct ? selectedProduct.name : productSearch}
                    onChange={e => { setProductSearch(e.target.value); if (selectedProduct) handleClear(); }}
                    placeholder="Search product..."
                    className="input pl-9"
                  />
                  {selectedProduct && (
                    <button onClick={handleClear}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X size={14} />
                    </button>
                  )}
                  {productResults.length > 0 && !selectedProduct && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-10 overflow-hidden">
                      {productResults.map(p => (
                        <button key={p.id} onClick={() => handleSelectProduct(p)}
                          className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-blue-50 text-left">
                          <div>
                            <div className="text-sm font-medium">{p.name}</div>
                            <div className="text-xs text-slate-400">{p.barcode}</div>
                          </div>
                          <span className="text-xs font-semibold text-slate-500 text-right">
                            {formatStock(p.currentStock, buildUnitMultipliers(getMasterUnits(p)))}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Current Stock Display */}
                {selectedProduct && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1">{selectedProduct.name}</p>
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-blue-500 mt-0.5 whitespace-nowrap">Current Stock:</span>
                      <div>
                        {masterUnits.length > 1 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {unitMultipliers.map(u => {
                              const decomposed = decomposeBase(currentBase, unitMultipliers);
                              return (
                                <span key={u.name} className="inline-flex flex-col items-center bg-white border border-blue-200 rounded-md px-2 py-0.5 min-w-[40px]">
                                  <span className="text-[10px] text-blue-400 font-medium">{u.name}</span>
                                  <span className="text-sm font-bold text-blue-700">{decomposed[u.name] || 0}</span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-sm font-bold text-blue-700">
                            {currentBase} {masterUnits[0]?.name || 'PCS'}
                          </span>
                        )}
                        <p className="text-[10px] text-blue-400 mt-1">= {currentBase} base pieces</p>
                      </div>
                    </div>

                    {/* Diff badge */}
                    {newQtyTotal !== currentBase && (
                      <div className={`mt-2 flex items-center gap-1.5 text-sm font-bold ${diff > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        <span>{diff > 0 ? '▲' : '▼'}</span>
                        <span>{diff > 0 ? '+' : ''}{diff} base pieces</span>
                        <span className="text-xs font-normal text-slate-400">change</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* New Stock Quantity — multi-unit inputs */}
              <div>
                <label className="label">New Stock Quantity</label>
                {!selectedProduct ? (
                  <input disabled placeholder="Select a product first" className="input text-slate-300" />
                ) : masterUnits.length > 1 ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {unitMultipliers.map(u => (
                        <div key={u.name} className="flex flex-col items-center">
                          <span className="text-[10px] font-medium text-slate-500 mb-0.5">{u.name}</span>
                          <input
                            type="text"
                            min="0"
                            value={newQtyInputs[u.name] ?? ''}
                            onChange={e => setNewQtyInputs(prev => ({ ...prev, [u.name]: e.target.value }))}
                            placeholder="0"
                            className={`input w-20 text-center text-sm py-1.5 font-semibold ${
                              diff !== 0 ? (diff > 0 ? 'border-emerald-300 focus:border-emerald-400' : 'border-red-300 focus:border-red-400') : ''
                            }`}
                          />
                        </div>
                      ))}
                    </div>
                    {newQtyTotal > 0 && (
                      <p className="text-xs text-blue-600 font-medium">= {newQtyTotal} base pieces</p>
                    )}
                  </div>
                ) : (
                  // Single unit product
                  <input
                    type="text"
                    min="0"
                    value={newQtyInputs[masterUnits[0]?.name] ?? ''}
                    onChange={e => setNewQtyInputs({ [masterUnits[0]?.name || 'PCS']: e.target.value })}
                    placeholder="Enter new quantity"
                    className={`input text-lg font-semibold ${
                      diff !== 0 ? (diff > 0 ? 'border-emerald-400 focus:border-emerald-400' : 'border-red-400 focus:border-red-400') : ''
                    }`}
                  />
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="label">Reason</label>
                <div className="grid grid-cols-1 gap-2">
                  {REASONS.map(r => (
                    <button key={r.value} onClick={() => setReason(r.value)}
                      className={`text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                        reason === r.value
                          ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label">Notes (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Found damaged during inspection..."
                  rows={2} className="input resize-none" />
              </div>

              <button
                onClick={handleAdjust}
                disabled={saving || !selectedProduct}
                className="btn-primary w-full justify-center"
              >
                {saving
                  ? <><Loader2 size={16} className="animate-spin" />Saving...</>
                  : <><Save size={16} />Update Stock</>
                }
              </button>
            </div>
          </div>

          {/* Last Adjusted */}
          {lastAdjusted && (
            <div className="card p-4 bg-emerald-50 border-emerald-200">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-700">{lastAdjusted.product}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    {lastAdjusted.displayOld} → {lastAdjusted.displayNew}
                  </p>
                  <p className="text-xs text-emerald-500 mt-0.5">
                    ({lastAdjusted.diff > 0 ? '+' : ''}{lastAdjusted.diff} base pieces)
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── History ── */}
        <div className="xl:col-span-2">
          <div className="card overflow-hidden">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <History size={15} className="text-slate-400" />
                <h3 className="font-semibold text-sm text-slate-700">Adjustment History</h3>
              </div>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th className="text-center">Before</th>
                    <th className="text-center">After</th>
                    <th className="text-center">Change</th>
                    <th>Reason</th>
                    <th>Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <tr><td colSpan={7} className="text-center py-10">
                      <Loader2 size={20} className="animate-spin text-blue-500 mx-auto" />
                    </td></tr>
                  ) : history.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-slate-400">
                      <Package size={28} strokeWidth={1} className="mx-auto mb-2" />No history yet
                    </td></tr>
                  ) : history.map(h => {
                    const d = Number(h.difference ?? (h.newQty - h.previousQty));
                    const reasonObj = REASONS.find(r => r.value === h.reason);
                    // Try to get product units for display
                    const hMasterUnits = getMasterUnits(h.product);
                    const hMults = buildUnitMultipliers(hMasterUnits);
                    const prevDisplay = hMults.length > 1 ? formatStock(h.previousQty, hMults) : String(Number(h.previousQty));
                    const newDisplay = hMults.length > 1 ? formatStock(h.newQty, hMults) : String(Number(h.newQty));
                    return (
                      <tr key={h.id}>
                        <td className="text-xs text-slate-500 whitespace-nowrap">{fmtDate(h.createdAt)}</td>
                        <td className="font-medium">{h.product?.name}</td>
                        <td className="text-center text-slate-500 text-xs">{prevDisplay}</td>
                        <td className="text-center font-semibold text-xs">{newDisplay}</td>
                        <td className="text-center">
                          <span className={`font-bold ${d > 0 ? 'text-emerald-600' : d < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                            {d > 0 ? '+' : ''}{d}
                          </span>
                        </td>
                        <td><span className={reasonObj?.color || 'badge-slate'}>{reasonObj?.label || h.reason}</span></td>
                        <td className="text-xs max-w-[140px]">
                          {(() => {
                            const isEdited = /^\[Edited:/i.test(h.notes || '');
                            const cleanNote = (h.notes || '').replace(/^\[Edited:.*?\]\s*/i, '').trim();
                            const editedMatch = (h.notes || '').match(/^\[Edited:(.*?)\]/i);
                            return (
                              <div className="space-y-0.5">
                                {isEdited && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 whitespace-nowrap">
                                    ✏️ Edited{editedMatch?.[1] ? `:${editedMatch[1]}` : ''}
                                  </span>
                                )}
                                <div className="text-slate-400">{cleanNote || '—'}</div>
                              </div>
                            );
                          })()}
                        </td>
                        <td>
                          <button
                            onClick={() => openEdit(h)}
                            className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit this entry"
                          >
                            <Pencil size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── Edit History Modal ── */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-semibold text-slate-800 text-sm">Edit History Entry</h2>
                <p className="text-xs text-slate-400 mt-0.5">{editingEntry.product?.name}</p>
              </div>
              <button onClick={() => setEditingEntry(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Reason */}
              <div>
                <label className="label">Reason</label>
                <div className="grid grid-cols-1 gap-2 mt-1">
                  {REASONS.map(r => (
                    <button
                      key={r.value}
                      onClick={() => setEditForm(f => ({ ...f, reason: r.value }))}
                      className={`text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                        editForm.reason === r.value
                          ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label">Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes (optional)..."
                  rows={2}
                  className="input resize-none mt-1"
                />
                <p className="text-[10px] text-amber-600 mt-1">✏️ Save ke baad automatically edit date/time note hogi</p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleEditSave}
                  disabled={editSaving}
                  className="btn-primary flex-1 justify-center"
                >
                  {editSaving ? <><Loader2 size={14} className="animate-spin" />Saving...</> : <><Save size={14} />Save Changes</>}
                </button>
                <button
                  onClick={() => setEditingEntry(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
