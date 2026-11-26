import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Plus, Tags, Check, X, Trash2, Printer, CheckCircle2, PackagePlus } from 'lucide-react';
import { productsAPI, categoriesAPI, brandsAPI, stockAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const UNIT_TYPES = ['PCS', 'KG', 'G', 'L', 'ML', 'DOZEN', 'BOX', 'CARTON', 'PACK', 'BUNDLE'];

// ── Field order for Enter-key navigation ─────────────────────────────────────
// IDs of text/number inputs in tab order. Selects are skipped (browser handles naturally).
const FIELD_ORDER = [
  'f_name', 'f_barcode',
  'f_purchasePrice', 'f_retailPrice', 'f_minRetailQty',
  'f_wholesalePrice', 'f_minWholesaleQty',
  'f_semiWholesalePrice', 'f_minSemiWholesaleQty',
  'f_openingStock', 'f_minStockAlert',
];

// Focus the next input in FIELD_ORDER when Enter is pressed
function onEnterNext(e) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const idx = FIELD_ORDER.indexOf(e.target.id);
  if (idx !== -1 && idx < FIELD_ORDER.length - 1) {
    document.getElementById(FIELD_ORDER[idx + 1])?.focus();
  }
}

// ── Field component OUTSIDE AddProductPage to prevent remount on every render ─
function Field({ label, name, type = 'text', placeholder, required = false, form, onChange, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children || (
        <input
          id={`f_${name}`}
          type={type}
          value={form[name]}
          onChange={onChange(name)}
          onKeyDown={onEnterNext}
          placeholder={placeholder}
          required={required}
          step={type === 'number' ? '0.01' : undefined}
          min={type === 'number' ? '0' : undefined}
          className="input"
        />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AddProductPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedProduct, setSavedProduct] = useState(null); // { id, name } after create
  const [currentStock, setCurrentStock] = useState(0);
  const [showAddStock, setShowAddStock] = useState(false);
  const [addStockInputs, setAddStockInputs] = useState({}); // multi-unit inputs
  const [addStockNotes, setAddStockNotes] = useState('');
  const [addingStock, setAddingStock] = useState(false);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const newCatRef = useRef(null);

  const [showAddBrand, setShowAddBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [addingBrand, setAddingBrand] = useState(false);
  const newBrandRef = useRef(null);

  const [form, setForm] = useState({
    name: '', categoryId: '', brandId: '',
    purchasePrice: '', retailPrice: '', minRetailQty: '1',
    wholesalePrice: '', minWholesaleQty: '12',
    semiWholesalePrice: '', minSemiWholesaleQty: '6',
    salesmanPrice: '0',
    loyaltyCoins: '0', loyaltyValue: '0',
    gstPercent: '0', openingStock: '0', minStockAlert: '0', defaultSaleType: 'RETAIL'
  });

  const [stockInputs, setStockInputs] = useState({}); // multi-unit inputs for Opening Stock
  const [minAlertInputs, setMinAlertInputs] = useState({}); // multi-unit inputs for Min Stock Alert

  const [costMapping, setCostMapping] = useState({ unitName: '', cost: '' });

  const [pricingTiers, setPricingTiers] = useState([
    {
      id: 'tier-' + Date.now(),
      name: 'Retail',
      barcode: '',
      rewardQty: '',
      rewardCoins: '',
      refUnitId: 'u1',
      refPrice: '',
      driverRefPrice: '',
      defaultSellUnit: '',
      units: [{ id: 'u1', quantity: '1', name: 'PCS' }]
    }
  ]);

  const [availableTiers, setAvailableTiers] = useState([]);
  const [availableUnits, setAvailableUnits] = useState([]);

  const addTier = () => {
    const defaultUnitId = 'u-' + Date.now().toString();
    setPricingTiers(prev => [...prev, {
      id: 'tier-' + Date.now().toString(), name: '', barcode: '',
      rewardQty: '', rewardCoins: '',
      refUnitId: defaultUnitId, refPrice: '', driverRefPrice: '',
      defaultSellUnit: '',
      units: [{ id: defaultUnitId, quantity: '1', name: 'PCS' }]
    }]);
  };

  const removeTier = (tierId) => setPricingTiers(prev => prev.filter(t => t.id !== tierId));
  const updateTier = (tierId, field, value) => setPricingTiers(prev => prev.map(t => t.id === tierId ? { ...t, [field]: value } : t));

  const addUnitToTier = (tierId) => {
    setPricingTiers(prev => prev.map(t => {
      if (t.id !== tierId) return t;
      return { ...t, units: [...t.units, { id: 'u-' + Date.now().toString() + Math.random(), quantity: '', name: '' }] };
    }));
  };

  const removeUnitFromTier = (tierId, unitId) => {
    setPricingTiers(prev => prev.map(t => {
      if (t.id !== tierId) return t;
      return { ...t, units: t.units.filter(u => u.id !== unitId) };
    }));
  };

  const updateUnit = (tierId, unitId, field, value) => {
    setPricingTiers(prev => prev.map(t => {
      if (t.id !== tierId) return t;
      return { ...t, units: t.units.map(u => u.id === unitId ? { ...u, [field]: value } : u) };
    }));
  };

  useEffect(() => {
    categoriesAPI.list().then(r => setCategories(r.data)).catch(() => {});
    brandsAPI.list().then(r => setBrands(r.data)).catch(() => {});
    productsAPI.list({ limit: 500 }).then(r => {
      const prods = r.data?.products || [];
      const tNames = new Set();
      const uNames = new Set();
      prods.forEach(p => {
        if (Array.isArray(p.pricingTiers)) {
          p.pricingTiers.forEach(t => {
            if (t.name) tNames.add(t.name);
            if (Array.isArray(t.units)) {
              t.units.forEach(u => { if (u.name) uNames.add(u.name); });
            }
          });
        }
      });
      const defaultTiers = ['Retail', 'Wholesale', 'Semi-Wholesale'];
      const defaultUnits = ['PCS', 'BOX', 'PKT', 'KG', 'LTR', 'DOZEN'];
      tNames.forEach(t => { if (!defaultTiers.includes(t)) defaultTiers.push(t); });
      uNames.forEach(u => { if (!defaultUnits.includes(u)) defaultUnits.push(u); });
      setAvailableTiers(defaultTiers);
      setAvailableUnits(defaultUnits);
    }).catch(() => {});

    if (isEdit) {
      setLoading(true);
      productsAPI.get(id)
        .then(r => {
          setForm(f => ({ ...f, ...r.data }));
          setCurrentStock(Number(r.data.currentStock) || 0);
          
          if (r.data.pricingTiers && Array.isArray(r.data.pricingTiers) && r.data.pricingTiers.length > 0) {
            setPricingTiers(r.data.pricingTiers);
            
            // Convert the flat base openingStock back into the correct hierarchical units
            const loadedMaster = r.data.pricingTiers.reduce((prev, curr) => ((prev.units || []).length > (curr.units || []).length) ? prev : curr, r.data.pricingTiers[0]);
            if (loadedMaster?.units?.length > 0) {
              const unitMultipliers = loadedMaster.units.map((u, i) => {
                let multiplier = 1;
                for (let j = i + 1; j < loadedMaster.units.length; j++) {
                  multiplier *= (Number(loadedMaster.units[j].quantity) || 1);
                }
                return { ...u, multiplier };
              });
              
              // Decompose openingStock
              let remaining = Number(r.data.openingStock) || 0;
              let initialStockInputs = {};
              for (const unit of unitMultipliers) {
                const qty = Math.floor(remaining / unit.multiplier);
                if (qty >= 0) initialStockInputs[unit.name] = qty;
                remaining %= unit.multiplier;
              }
              setStockInputs(initialStockInputs);

              // Decompose minStockAlert into unit-wise inputs
              let alertRemaining = Number(r.data.minStockAlert) || 0;
              let initialAlertInputs = {};
              for (const unit of unitMultipliers) {
                const qty = Math.floor(alertRemaining / unit.multiplier);
                if (qty >= 0) initialAlertInputs[unit.name] = qty;
                alertRemaining %= unit.multiplier;
              }
              setMinAlertInputs(initialAlertInputs);

              const baseU = loadedMaster.units[0];
              if (baseU.costPrice) setCostMapping({ unitName: baseU.name, cost: baseU.costPrice });
            } else {
              setStockInputs({ 'PCS': r.data.openingStock || 0 });
              setMinAlertInputs({ 'PCS': r.data.minStockAlert || 0 });
            }
          } else {
            setStockInputs({ 'PCS': r.data.openingStock || 0 });
            setMinAlertInputs({ 'PCS': r.data.minStockAlert || 0 });
          }
        })
        .catch(() => toast.error('Could not load product'))
        .finally(() => setLoading(false));
    }
  }, [id]);

  // Derive master units to generate cost mappings
  const masterTier = pricingTiers.reduce((prev, curr) => (prev.units.length > curr.units.length) ? prev : curr, pricingTiers[0]);
  const mappedUnits = masterTier?.units || [];
  
  useEffect(() => {
    if (mappedUnits.length > 0 && costMapping.unitName === '') {
      setCostMapping(prev => ({ ...prev, unitName: mappedUnits[0].name }));
    }
  }, [mappedUnits, costMapping.unitName]);

  const getCalculatedCosts = () => {
    const { unitName, cost } = costMapping;
    const numCost = Number(cost) || 0;
    if (!unitName || numCost <= 0 || mappedUnits.length === 0) return [];
    
    // Find absolute base units for each unit
    const unitMultipliers = mappedUnits.map((u, i) => {
      let multiplier = 1;
      for (let j = i + 1; j < mappedUnits.length; j++) {
        multiplier *= (Number(mappedUnits[j].quantity) || 1);
      }
      return { ...u, multiplier };
    });

    const refUnit = unitMultipliers.find(u => u.name === unitName);
    if (!refUnit) return [];

    const baseCostPerPiece = numCost / refUnit.multiplier;

    return unitMultipliers.map(u => ({
      name: u.name,
      qty: Number(u.quantity) || 1,
      costPrice: Number((baseCostPerPiece * u.multiplier).toFixed(2))
    }));
  };
  const calculatedCosts = getCalculatedCosts();
  
  const calculateTotalBaseStock = (inputs, currentMappedUnits) => {
    if (!currentMappedUnits || currentMappedUnits.length === 0) {
      return Number(inputs['PCS']) || 0;
    }
    
    const unitMultipliers = currentMappedUnits.map((u, i) => {
      let multiplier = 1;
      for (let j = i + 1; j < currentMappedUnits.length; j++) {
        multiplier *= (Number(currentMappedUnits[j].quantity) || 1);
      }
      return { ...u, multiplier };
    });

    let total = 0;
    unitMultipliers.forEach(u => {
       const qty = Number(inputs[u.name]) || 0;
       total += (qty * u.multiplier);
    });
    return total;
  };

  const formatStock = (stockToFormat, currentMappedUnits) => {
    const stock = Number(stockToFormat) || 0;
    if (stock <= 0) return '0';
    if (!currentMappedUnits || currentMappedUnits.length <= 1) return stock.toString();

    const unitMultipliers = currentMappedUnits.map((u, i) => {
      let multiplier = 1;
      for (let j = i + 1; j < currentMappedUnits.length; j++) {
        multiplier *= (Number(currentMappedUnits[j].quantity) || 1);
      }
      return { ...u, multiplier };
    });

    let remaining = stock;
    let parts = [];
    for (const unit of unitMultipliers) {
       const qty = Math.floor(remaining / unit.multiplier);
       if (qty > 0) {
         parts.push(`${qty} ${unit.name}`);
         remaining %= unit.multiplier;
       }
    }
    return parts.length > 0 ? parts.join(', ') : '0';
  };

  // Stable update function using functional state update (no stale closure)
  const update = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleAddCategory = async (e) => {
    e?.preventDefault();
    const name = newCatName.trim();
    if (!name) return;
    setAddingCat(true);
    try {
      const res = await categoriesAPI.create({ name });
      const newCat = res.data;
      setCategories(prev => [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name)));
      setForm(prev => ({ ...prev, categoryId: newCat.id }));
      setNewCatName('');
      setShowAddCat(false);
      toast.success(`Category "${name}" added`);
    } catch {
      // global handler
    } finally {
      setAddingCat(false);
    }
  };

  const handleAddBrand = async (e) => {
    e?.preventDefault();
    const name = newBrandName.trim();
    if (!name) return;
    setAddingBrand(true);
    try {
      const res = await brandsAPI.create({ name });
      const newBrand = res.data;
      setBrands(prev => [...prev, newBrand].sort((a, b) => a.name.localeCompare(b.name)));
      setForm(prev => ({ ...prev, brandId: newBrand.id }));
      setNewBrandName('');
      setShowAddBrand(false);
      toast.success(`Brand "${name}" added`);
    } catch {
      // global handler
    } finally {
      setAddingBrand(false);
    }
  };

  const calculateTierPrices = (tier) => {
    if (!tier.refUnitId || !tier.refPrice || !tier.units.length) return [];
    
    // Find absolute base units for each unit
    // A unit at index i represents product of quantities from i+1 to end.
    const unitMultipliers = tier.units.map((u, i) => {
      let multiplier = 1;
      for (let j = i + 1; j < tier.units.length; j++) {
        multiplier *= (Number(tier.units[j].quantity) || 1);
      }
      return { ...u, multiplier };
    });

    const refUnit = unitMultipliers.find(u => u.id === tier.refUnitId);
    if (!refUnit) return [];

    // Base price per 1 absolute smallest piece
    const basePricePerPiece = Number(tier.refPrice) / refUnit.multiplier;
    const baseDriverPricePerPiece = tier.driverRefPrice ? Number(tier.driverRefPrice) / refUnit.multiplier : null;

    return unitMultipliers.map(u => ({
      ...u,
      price: Number((basePricePerPiece * u.multiplier).toFixed(2)),
      driverPrice: baseDriverPricePerPiece !== null ? Number((baseDriverPricePerPiece * u.multiplier).toFixed(2)) : null
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const baseCalcCost = calculatedCosts.length > 0 
        ? calculatedCosts[calculatedCosts.length - 1].costPrice 
        : (Number(form.purchasePrice) || 0);

      const payload = {
        ...form,
        pricingTiers: pricingTiers.map(tier => {
          const calculatedPrices = calculateTierPrices(tier);
          return {
            ...tier,
            units: (tier.units || []).map(u => {
              const costMatch = calculatedCosts.find(c => c.name === u.name);
              const priceMatch = calculatedPrices.find(p => p.id === u.id);
              return {
                ...u,
                price: priceMatch ? Number(priceMatch.price) : 0,
                driverPrice: priceMatch && priceMatch.driverPrice != null ? Number(priceMatch.driverPrice) : null,
                costPrice: costMatch ? Number(costMatch.costPrice.toFixed(2)) : (u.costPrice || 0)
              };
            })
          };
        }),
        // Ensure all numeric fields are sent as numbers, not strings
        purchasePrice: Number(baseCalcCost.toFixed(2)),
        retailPrice: Number(form.retailPrice) || 0,
        wholesalePrice: Number(form.wholesalePrice) || 0,
        semiWholesalePrice: Number(form.semiWholesalePrice) || 0,
        salesmanPrice: Number(form.salesmanPrice) || 0,
        minRetailQty: Number(form.minRetailQty) || 1,
        minWholesaleQty: Number(form.minWholesaleQty) || 12,
        minSemiWholesaleQty: Number(form.minSemiWholesaleQty) || 6,
        gstPercent: Number(form.gstPercent) || 0,
        openingStock: calculateTotalBaseStock(stockInputs, mappedUnits),
        minStockAlert: calculateTotalBaseStock(minAlertInputs, mappedUnits),
        loyaltyCoins: Number(form.loyaltyCoins) || 0,
        loyaltyValue: Number(form.loyaltyValue) || 0,
      };
      if (isEdit) {
        // Don't overwrite currentStock when editing — it's managed by stock adjustments
        delete payload.currentStock;
        await productsAPI.update(id, payload);
        toast.success('Product updated');
      } else {
        const res = await productsAPI.create(payload);
        const newProduct = res.data;
        toast.success('Product added successfully!');
        setSavedProduct({ id: newProduct.id, name: newProduct.name });
        return; // Don't navigate — show print prompt
      }
      navigate('/products');
    } catch (e) {
      // Global handler
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={28} className="animate-spin text-blue-500" />
      </div>
    );
  }

  // ── Post-save success screen ──────────────────────────────────────────────
  if (savedProduct) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <div className="card p-10 space-y-5">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle2 size={36} className="text-emerald-500" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{savedProduct.name}</h2>
            <p className="text-sm text-slate-500 mt-1">Product added successfully!</p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate(`/barcodes?productId=${savedProduct.id}`)}
              className="btn-primary w-full justify-center gap-2"
            >
              <Printer size={16} />
              Print Barcode Labels
            </button>
            <button
              onClick={() => navigate('/products/add')}
              className="btn-secondary w-full justify-center"
            >
              Add Another Product
            </button>
            
            <button
              onClick={() => navigate('/products')}
              className="text-sm text-slate-400 hover:text-slate-600 hover:underline"
            >
              Go to Products List
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/products')} className="text-slate-500 hover:text-slate-700 p-1.5 hover:bg-slate-100 rounded-lg">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="page-title">{isEdit ? 'Edit Product' : 'Add Product'}</h1>
          <p className="page-subtitle">Fill in the product details below · Press Enter to jump to next field</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Info */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm text-slate-700">Basic Information</h3>
          </div>
          <div className="card-body grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Product Name *" name="name" placeholder="e.g. Parle-G Biscuit 800g" required form={form} onChange={update} />
            </div>
            <Field label="Category" form={form} onChange={update}>
              <div className="flex gap-2 items-start">
                <select
                  value={form.categoryId}
                  onChange={update('categoryId')}
                  className="input flex-1"
                >
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => { setShowAddCat(v => !v); setTimeout(() => newCatRef.current?.focus(), 50); }}
                  title="Add new category"
                  className={`flex-shrink-0 p-2 rounded-lg border transition-colors ${
                    showAddCat
                      ? 'bg-blue-50 border-blue-400 text-blue-600'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-blue-400 hover:text-blue-600'
                  }`}
                >
                  <Plus size={16} />
                </button>
              </div>
              {showAddCat && (
                <div className="mt-2 flex gap-2 items-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Tags size={14} className="text-blue-500 flex-shrink-0" />
                  <input
                    ref={newCatRef}
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); }
                      if (e.key === 'Escape') { setShowAddCat(false); setNewCatName(''); }
                    }}
                    placeholder="New category name…"
                    className="input flex-1 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    disabled={addingCat || !newCatName.trim()}
                    className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg disabled:opacity-50 transition-colors"
                    title="Save"
                  >
                    {addingCat ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddCat(false); setNewCatName(''); }}
                    className="p-1.5 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors"
                    title="Cancel"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="mt-1.5">
                <Link to="/categories" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                  <Tags size={11} /> Manage all categories
                </Link>
              </div>
            </Field>
            <Field label="Brand" form={form} onChange={update}>
              <div className="flex gap-2 items-start">
                <select
                  value={form.brandId}
                  onChange={update('brandId')}
                  className="input flex-1"
                >
                  <option value="">Select Brand</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => { setShowAddBrand(v => !v); setTimeout(() => newBrandRef.current?.focus(), 50); }}
                  title="Add new brand"
                  className={`flex-shrink-0 p-2 rounded-lg border transition-colors ${
                    showAddBrand
                      ? 'bg-blue-50 border-blue-400 text-blue-600'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-blue-400 hover:text-blue-600'
                  }`}
                >
                  <Plus size={16} />
                </button>
              </div>
              {showAddBrand && (
                <div className="mt-2 flex gap-2 items-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Tags size={14} className="text-blue-500 flex-shrink-0" />
                  <input
                    ref={newBrandRef}
                    value={newBrandName}
                    onChange={e => setNewBrandName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); handleAddBrand(); }
                      if (e.key === 'Escape') { setShowAddBrand(false); setNewBrandName(''); }
                    }}
                    placeholder="New brand name…"
                    className="input flex-1 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddBrand}
                    disabled={addingBrand || !newBrandName.trim()}
                    className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg disabled:opacity-50 transition-colors"
                    title="Save"
                  >
                    {addingBrand ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddBrand(false); setNewBrandName(''); }}
                    className="p-1.5 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors"
                    title="Cancel"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </Field>
          </div>
        </div>

        {/* Loyalty Mapping */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm text-slate-700">Global Loyalty Points Value (Base Mapping)</h3>
          </div>
          <div className="card-body grid grid-cols-2 gap-4">
            <Field label="Total Coins (e.g. 1000)" name="loyaltyCoins" type="text" placeholder="0" form={form} onChange={update} />
            <Field label="Cash Value in ₹ (e.g. 10)" name="loyaltyValue" type="text" placeholder="0.00" form={form} onChange={update} />
          </div>
        </div>

        {/* Taxes Configuration */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm text-slate-700">Taxes Configuration</h3>
          </div>
          <div className="card-body grid grid-cols-2 gap-4">
            <Field label="GST %" form={form} onChange={update}>
              <select value={form.gstPercent} onChange={update('gstPercent')} className="input">
                {[0, 5, 12, 18, 28].map(g => <option key={g} value={g}>{g}%</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm text-slate-700">Dynamic Pricing Tiers & Unit Quantities</h3>
              <p className="text-xs text-slate-500 mt-1">Specify unlimited sub-units scaling (e.g. 1 Box ➔ 12 Packets ➔ 12 Pieces).</p>
            </div>
            <button type="button" onClick={addTier} className="btn-secondary btn-sm gap-1">
              <Plus size={14} /> Add Pricing Tier
            </button>
          </div>

          {/* Datalists for autocompletion */}
          <datalist id="tier-names">
            {availableTiers.map(t => <option key={t} value={t} />)}
          </datalist>
          <datalist id="unit-names">
            {availableUnits.map(u => <option key={u} value={u} />)}
          </datalist>

          {pricingTiers.map(tier => (
            <div key={tier.id} className="card border border-slate-200">
              <div className="card-header grid grid-cols-12 items-center gap-3 bg-slate-50/50">
                <div className="col-span-6">
                  <input
                    list="tier-names"
                    value={tier.name}
                    onChange={(e) => updateTier(tier.id, 'name', e.target.value)}
                    placeholder="Select or Type Tier (e.g. Retail, Wholesale Box)"
                    className="input w-full font-medium shadow-sm"
                    required
                  />
                </div>
                <div className="col-span-5">
                  <input
                    type="text"
                    value={tier.barcode || ''}
                    onChange={(e) => updateTier(tier.id, 'barcode', e.target.value)}
                    placeholder="Barcode (leave blank to auto-generate)"
                    className="input w-full shadow-sm bg-white"
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  {pricingTiers.length > 1 && (
                    <button type="button" onClick={() => removeTier(tier.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="card-body bg-white border-b border-slate-100">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="label text-xs">Tier Earn Logic</label>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-slate-500">Buy</span>
                      <input
                        type="text"
                        value={tier.rewardQty || ''}
                        onChange={(e) => updateTier(tier.id, 'rewardQty', e.target.value)}
                        placeholder="Qty"
                        className="input py-1 px-2 w-20 text-center"
                      />
                      <span className="text-sm text-slate-500">items, get</span>
                      <input
                        type="text"
                        value={tier.rewardCoins || ''}
                        onChange={(e) => updateTier(tier.id, 'rewardCoins', e.target.value)}
                        placeholder="Coins"
                        className="input py-1 px-2 w-20 text-center text-amber-600 font-semibold"
                      />
                    </div>
                  </div>
                </div>

                <label className="label mb-3">Unit Breakdown Structure</label>
                <div className="flex flex-wrap items-center gap-2">
                  {tier.units.map((unit, idx) => (
                    <div key={unit.id} className="flex items-center gap-2">
                      {idx > 0 && <span className="text-slate-400 text-xs font-semibold px-1">➔</span>}
                      <div className={`flex items-center gap-1 p-1.5 rounded-lg border ${idx === 0 ? 'bg-blue-50/50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                        {idx > 0 && <span className="text-xs font-medium text-slate-500 ml-1">Contains</span>}
                        <input
                          type="text"
                          value={unit.quantity}
                          onChange={(e) => updateUnit(tier.id, unit.id, 'quantity', e.target.value)}
                          placeholder="Qty"
                          className="input py-1 px-2 w-16 text-center text-sm bg-white"
                          disabled={idx === 0}
                          title={idx === 0 ? "Root quantity is always 1" : "Quantity enclosed"}
                          required
                        />
                        <input
                          list="unit-names"
                          value={unit.name}
                          onChange={(e) => updateUnit(tier.id, unit.id, 'name', e.target.value)}
                          placeholder="Select/Type Unit"
                          className="input py-1 px-2 w-32 text-sm bg-white"
                          required
                        />
                        {idx > 0 && idx === tier.units.length - 1 && (
                          <button type="button" onClick={() => removeUnitFromTier(tier.id, unit.id)} className="text-slate-400 hover:text-red-500 p-1.5 rounded-md hover:bg-slate-200 transition-colors">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => addUnitToTier(tier.id)} className="btn-secondary btn-sm h-10 gap-1 text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-700">
                    <Plus size={14} /> Nested Unit
                  </button>
                </div>

                {/* Default Selling Unit */}
                {tier.units.length > 1 && (
                  <div className="mt-4 flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex-shrink-0">
                      <span className="text-xs font-semibold text-amber-700">⭐ Default Selling Unit</span>
                      <p className="text-[10px] text-amber-600 mt-0.5">Select default unit for selling screen</p>
                    </div>
                    <select
                      value={tier.defaultSellUnit || ''}
                      onChange={e => updateTier(tier.id, 'defaultSellUnit', e.target.value)}
                      className="input border-amber-300 bg-white text-amber-800 font-semibold text-sm flex-1 max-w-xs"
                    >
                      <option value="">-- Auto (Largest Unit) --</option>
                      {tier.units.filter(u => u.name).map(u => (
                        <option key={u.id} value={u.name}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Selling Price Mapping */}
                <div className="mt-6 bg-slate-50/80 border border-slate-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Dynamic Selling Price Mapping</h4>
                  <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <div className="flex-[1.5]">
                      <label className="label text-xs">Set Base Price for Unit</label>
                      <select 
                        value={tier.refUnitId || ''} 
                        onChange={e => updateTier(tier.id, 'refUnitId', e.target.value)}
                        className="input"
                        required
                      >
                        <option value="">-- Choose Unit --</option>
                        {tier.units.map(u => u.name ? <option key={u.id} value={u.id}>{u.name}</option> : null)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="label text-xs">Price (₹)</label>
                      <input
                        type="text"
                        value={tier.refPrice || ''}
                        onChange={e => updateTier(tier.id, 'refPrice', e.target.value)}
                        placeholder="e.g. 50"
                        className="input font-semibold text-blue-700"
                        required
                      />
                    </div>
                    <div className="flex-1">
                      <label className="label text-xs">Price for Driver (₹) <span className="text-slate-400 font-normal italic">(optional)</span></label>
                      <input
                        type="text"
                        value={tier.driverRefPrice || ''}
                        onChange={e => updateTier(tier.id, 'driverRefPrice', e.target.value)}
                        placeholder="e.g. 48"
                        className="input font-semibold text-emerald-700"
                      />
                    </div>
                  </div>
                  
                  {tier.refUnitId && Number(tier.refPrice) > 0 && (
                    <div className="grid grid-cols-2 shadow-sm sm:grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-200">
                       {calculateTierPrices(tier).map(calc => (
                           <div key={calc.name} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-2.5 bg-white rounded border border-slate-100 shadow-sm">
                            <span className="text-sm font-medium text-slate-700">1 {calc.name}</span>
                            <div className="flex gap-3 text-sm">
                              <span className="font-bold text-blue-600">₹{calc.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                              {calc.driverPrice != null && (
                                <span className="font-bold text-emerald-600">₹{calc.driverPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })} <span className="text-[10px] font-normal text-emerald-500 bg-emerald-50 px-1 rounded">Driver</span></span>
                              )}
                            </div>
                           </div>
                       ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Cost Price Calculation */}
        {mappedUnits.length > 0 && (
          <div className="card border-blue-200 shadow-sm bg-blue-50/10 mb-4">
            <div className="card-header border-b border-blue-100 bg-blue-50/50">
              <h3 className="font-semibold text-sm text-blue-800">Dynamic Cost Price Mapping</h3>
              <p className="text-xs text-blue-600/80 mt-1">Set the purchase cost for any mapped unit, and the system auto-calculates the rest.</p>
            </div>
            <div className="card-body">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-5">
                <div className="flex-1 w-full">
                  <label className="label text-blue-800">Select Unit mapped</label>
                  <select
                    value={costMapping.unitName}
                    onChange={e => setCostMapping(prev => ({ ...prev, unitName: e.target.value }))}
                    className="input border-blue-200"
                  >
                    <option value="">-- Choose Unit --</option>
                    {mappedUnits.map(u => (
                       <option key={u.id || u.name} value={u.name}>{u.name} (Qty hierarchy: {u.quantity})</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 w-full">
                  <label className="label text-blue-800">Cost Price for 1 {costMapping.unitName || 'Unit'} (₹)</label>
                  <input
                    type="text"
                    // min="0"
                    // step="0.01"
                    value={costMapping.cost}
                    onChange={e => setCostMapping(prev => ({ ...prev, cost: e.target.value }))}
                    placeholder="Enter cost..."
                    className="input border-blue-200 font-semibold text-blue-700"
                  />
                </div>
              </div>

              {calculatedCosts.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 p-4">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Calculated Cost for all Units</h4>
                  <div className="grid grid-cols-2 shadow-sm sm:grid-cols-3 gap-3">
                    {calculatedCosts.map((calc, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-2.5 bg-slate-50 rounded border border-slate-100 shadow-sm">
                        <span className="text-sm font-medium text-slate-700">1 {calc.name}</span>
                        <span className="text-sm font-bold text-emerald-600">₹{calc.costPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stock */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-700">Stock</h3>
            {isEdit && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Current Stock:</span>
                <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
                  currentStock <= 0 ? 'bg-red-100 text-red-600' :
                  currentStock <= Number(form.minStockAlert || 0) ? 'bg-amber-100 text-amber-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>{formatStock(currentStock, mappedUnits)}</span>
              </div>
            )}
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label text-slate-700">Opening Stock (By Unit)</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {mappedUnits.length > 0 ? mappedUnits.map(u => (
                    <div key={u.name} className="flex flex-col">
                      <span className="text-[10px] font-medium text-slate-500 mb-0.5 text-center">{u.name}</span>
                      <input 
                        type="text" min="0"
                        value={stockInputs[u.name] || ''}
                        onChange={e => setStockInputs(prev => ({ ...prev, [u.name]: e.target.value }))}
                        placeholder="0"
                        className="input w-20 text-center text-sm py-1.5 font-semibold"
                      />
                    </div>
                  )) : (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-medium text-slate-500 mb-0.5 text-center">PCS</span>
                      <input 
                        type="number" min="0"
                        value={stockInputs['PCS'] || ''}
                        onChange={e => setStockInputs(prev => ({ ...prev, ['PCS']: e.target.value }))}
                        placeholder="0"
                        className="input w-20 text-center text-sm py-1.5 font-semibold"
                      />
                    </div>
                  )}
                </div>
                {calculateTotalBaseStock(stockInputs, mappedUnits) > 0 && (
                  <p className="text-xs text-blue-600 mt-2 font-medium">
                    = {calculateTotalBaseStock(stockInputs, mappedUnits)} Base pieces
                  </p>
                )}
              </div>

              {/* Min Stock Alert — multi-unit inputs */}
              <div>
                <label className="label text-slate-700">Min Stock Alert (By Unit)</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {mappedUnits.length > 0 ? mappedUnits.map(u => (
                    <div key={u.name} className="flex flex-col">
                      <span className="text-[10px] font-medium text-red-500 mb-0.5 text-center">{u.name}</span>
                      <input
                        type="text" min="0"
                        value={minAlertInputs[u.name] || ''}
                        onChange={e => setMinAlertInputs(prev => ({ ...prev, [u.name]: e.target.value }))}
                        placeholder="0"
                        className="input w-20 text-center text-sm py-1.5 font-semibold border-red-200 focus:border-red-400"
                      />
                    </div>
                  )) : (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-medium text-red-500 mb-0.5 text-center">PCS</span>
                      <input
                        type="text" min="0"
                        value={minAlertInputs['PCS'] || ''}
                        onChange={e => setMinAlertInputs(prev => ({ ...prev, ['PCS']: e.target.value }))}
                        placeholder="0"
                        className="input w-20 text-center text-sm py-1.5 font-semibold border-red-200 focus:border-red-400"
                      />
                    </div>
                  )}
                </div>
                {calculateTotalBaseStock(minAlertInputs, mappedUnits) > 0 && (
                  <p className="text-xs text-red-500 mt-2 font-medium">
                    = {calculateTotalBaseStock(minAlertInputs, mappedUnits)} Base pieces (Alert threshold)
                  </p>
                )}
              </div>
            </div>
          </div>
          {/* Add to Stock — edit mode only */}
          {isEdit && (
            <div className="px-4 pb-4">
              {!showAddStock ? (
                <button
                  type="button"
                  onClick={() => setShowAddStock(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100 transition-colors"
                >
                  <PackagePlus size={16} />
                  Add to Stock
                </button>
              ) : (
                <div className="mt-2 p-4 rounded-lg border border-emerald-200 bg-emerald-50/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-emerald-800 flex items-center gap-1.5">
                      <PackagePlus size={15} /> Add to Stock
                    </h4>
                    <button type="button" onClick={() => { setShowAddStock(false); setAddStockInputs({}); setAddStockNotes(''); }} className="text-slate-400 hover:text-slate-600 p-1 rounded">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-emerald-700">
                    <span>Current stock:</span>
                    <span className="font-bold">{formatStock(currentStock, mappedUnits)}</span>
                    {calculateTotalBaseStock(addStockInputs, mappedUnits) > 0 && (
                      <>
                        <span className="text-slate-400">→</span>
                        <span className="font-bold text-emerald-600">{formatStock(currentStock + calculateTotalBaseStock(addStockInputs, mappedUnits), mappedUnits)}</span>
                        <span className="text-xs text-emerald-600">(+{calculateTotalBaseStock(addStockInputs, mappedUnits)} Base)</span>
                      </>
                    )}
                  </div>
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-12 sm:col-span-8">
                      <label className="label text-xs text-emerald-800">Add Entry (By Unit) *</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {mappedUnits.length > 0 ? mappedUnits.map(u => (
                          <div key={u.name} className="flex flex-col">
                            <span className="text-[10px] font-medium text-emerald-700 mb-0.5 text-center">{u.name}</span>
                            <input 
                              type="number"
                              min="0"
                              value={addStockInputs[u.name] || ''}
                              onChange={e => setAddStockInputs(prev => ({ ...prev, [u.name]: e.target.value }))}
                              placeholder="0"
                              className="input w-16 text-center text-xs py-1 border-emerald-200 focus:border-emerald-400 font-semibold"
                            />
                          </div>
                        )) : (
                          <div className="flex flex-col">
                            <span className="text-[10px] font-medium text-emerald-700 mb-0.5 text-center">PCS</span>
                            <input 
                              type="number"
                              min="0"
                              value={addStockInputs['PCS'] || ''}
                              onChange={e => setAddStockInputs(prev => ({ ...prev, ['PCS']: e.target.value }))}
                              placeholder="0"
                              className="input w-16 text-center text-xs py-1 border-emerald-200 focus:border-emerald-400 font-semibold"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-span-12 sm:col-span-4">
                      <label className="label text-xs text-emerald-800">Notes (optional)</label>
                      <input
                        type="text"
                        value={addStockNotes}
                        onChange={e => setAddStockNotes(e.target.value)}
                        placeholder="e.g. Purchase restock..."
                        className="input mt-1 lg:mt-5 py-1 text-sm border-emerald-200 focus:border-emerald-400"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={addingStock || calculateTotalBaseStock(addStockInputs, mappedUnits) <= 0}
                      onClick={async () => {
                        const totalQty = calculateTotalBaseStock(addStockInputs, mappedUnits);
                        if (totalQty <= 0) return;
                        setAddingStock(true);
                        try {
                          const res = await stockAPI.addToStock({ productId: id, addQty: totalQty, notes: addStockNotes || undefined });
                          const { newQty, addedQty } = res.data;
                          setCurrentStock(newQty);
                          toast.success(`+${addedQty} added! New stock: ${newQty}`);
                          setAddStockInputs({});
                          setAddStockNotes('');
                          setShowAddStock(false);
                        } catch {
                          // global handler
                        } finally {
                          setAddingStock(false);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {addingStock ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      {addingStock ? 'Adding...' : 'Add Stock'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddStock(false); setAddStockInputs({}); setAddStockNotes(''); }}
                      className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary btn-lg">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? 'Saving...' : isEdit ? 'Update Product' : 'Add Product'}
          </button>
          <button type="button" onClick={() => navigate('/products')} className="btn-secondary btn-lg">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
