import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Package, Edit, Trash2, AlertCircle, Loader2, Printer } from 'lucide-react';
import { productsAPI, categoriesAPI } from '../../utils/api';
import toast from 'react-hot-toast';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [printing, setPrinting] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await productsAPI.list({ search, categoryId: categoryFilter, page, limit: 25 });
      setProducts(res.data.products || []);
      setPagination(res.data.pagination || {});
    } catch (e) {
      // Mock data
      setProducts([
        { id: '1', name: 'Parle-G Biscuit 800g', barcode: '8901062005006', retailPrice: 30, wholesalePrice: 27, currentStock: 45, gstPercent: 5, category: { name: 'Biscuits' } },
        { id: '2', name: 'Surf Excel 500g', barcode: '8901030868077', retailPrice: 68, wholesalePrice: 62, currentStock: 18, gstPercent: 18, category: { name: 'Detergents' } },
        { id: '3', name: 'Tata Salt 1kg', barcode: '8906012901058', retailPrice: 24, wholesalePrice: 22, currentStock: 3, gstPercent: 5, category: { name: 'Groceries' }, minStockAlert: 10 },
      ]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchProducts(); }, [search, categoryFilter, page]);

  useEffect(() => {
    categoriesAPI.list().then(r => setCategories(r.data)).catch(() => {});
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this product?')) return;
    try {
      await productsAPI.delete(id);
      setProducts(products.filter(p => p.id !== id));
      toast.success('Product deleted');
    } catch (e) {}
  };

  // ── Stock format helper: box/pcs from pricingTiers ────────
  const formatStockWithUnits = (currentStock, pricingTiers) => {
    const stock = Number(currentStock) || 0;
    if (stock <= 0) return '0';
    if (!Array.isArray(pricingTiers) || pricingTiers.length === 0) return stock.toString();
    const masterTier = pricingTiers.reduce(
      (prev, curr) => ((prev.units || []).length > (curr.units || []).length ? prev : curr),
      pricingTiers[0]
    );
    const mappedUnits = masterTier?.units || [];
    if (mappedUnits.length <= 1) return stock.toString();
    const unitMultipliers = mappedUnits.map((u, i) => {
      let m = 1;
      for (let j = i + 1; j < mappedUnits.length; j++) m *= Number(mappedUnits[j].quantity) || 1;
      return { name: u.name, m };
    });
    let remaining = stock;
    const parts = [];
    unitMultipliers.forEach(({ name, m }, i) => {
      if (i === unitMultipliers.length - 1) {
        if (remaining > 0) parts.push(`${remaining} ${name}`);
      } else {
        const qty = Math.floor(remaining / m);
        if (qty > 0) { parts.push(`${qty} ${name}`); remaining = remaining % m; }
      }
    });
    return parts.length > 0 ? parts.join(' + ') : '0';
  };

  // ── Print Stock Report ────────────────────────────────────
  const printStockReport = async () => {
    setPrinting(true);
    try {
      const res = await productsAPI.stockReport();
      const { products: allProducts, generatedAt } = res.data;

      const dateStr = new Date(generatedAt).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      // ── Build table rows ──────────────────────────────────
      const buildPriceCell = (p) => {
        // If product uses pricingTiers, collect all tier ref prices
        if (Array.isArray(p.pricingTiers) && p.pricingTiers.length > 0) {
          return p.pricingTiers.map(tier => {
            let price = 0;
            if (tier.refPrice) price = Number(tier.refPrice);
            else if (tier.price) price = Number(tier.price);
            else if (Array.isArray(tier.units) && tier.units.length > 0) price = Number(tier.units[0].price);
            return `<div><span class="tier-label">${tier.name}:</span> ₹${price.toLocaleString('en-IN')}</div>`;
          }).join('');
        }
        // Fallback to standard prices
        const lines = [];
        if (p.retailPrice > 0)        lines.push(`<div><span class="tier-label">Retail:</span> ₹${p.retailPrice.toLocaleString('en-IN')}</div>`);
        if (p.wholesalePrice > 0)     lines.push(`<div><span class="tier-label">Wholesale:</span> ₹${p.wholesalePrice.toLocaleString('en-IN')}</div>`);
        if (p.semiWholesalePrice > 0) lines.push(`<div><span class="tier-label">Semi-WS:</span> ₹${p.semiWholesalePrice.toLocaleString('en-IN')}</div>`);
        if (p.salesmanPrice > 0)      lines.push(`<div><span class="tier-label">Driver:</span> ₹${p.salesmanPrice.toLocaleString('en-IN')}</div>`);
        return lines.join('') || '<span style="color:#999">—</span>';
      };

      const buildStockCell = (p) => {
        const shopStock  = formatStockWithUnits(p.currentStock, p.pricingTiers);
        const isLow      = p.minStockAlert > 0 && p.currentStock <= p.minStockAlert;
        const shopColor  = isLow ? '#dc2626' : '#16a34a';
        let html = `<div style="color:${shopColor};font-weight:600">Shop: ${shopStock}</div>`;
        if (p.driverStock && p.driverStock.length > 0) {
          p.driverStock.forEach(ds => {
            const driverFmt = formatStockWithUnits(ds.quantity, p.pricingTiers);
            html += `<div style="color:#1d4ed8;font-size:11px">${ds.driverName}: ${driverFmt}</div>`;
          });
        }
        return html;
      };

      const rows = allProducts.map((p, idx) => `
        <tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
          <td class="num">${idx + 1}</td>
          <td><strong>${p.name}</strong>${p.barcode ? `<br><span class="barcode">${p.barcode}</span>` : ''}</td>
          <td>${p.category || '—'}</td>
          <td>${p.brand || '—'}</td>
          <td>${buildPriceCell(p)}</td>
          <td>${buildStockCell(p)}</td>
        </tr>`
      ).join('');

      const totalProducts = allProducts.length;
      const lowStockCount = allProducts.filter(p => p.minStockAlert > 0 && p.currentStock <= p.minStockAlert).length;
      const totalShopStock = allProducts.reduce((s, p) => s + p.currentStock, 0);

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Stock Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e293b; background: #fff; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 18px 24px; }
    .header h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .header p  { font-size: 11px; opacity: 0.85; }
    .summary { display: flex; gap: 16px; padding: 12px 24px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .summary-card { background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 14px; flex: 1; text-align: center; }
    .summary-card .label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-card .value { font-size: 18px; font-weight: 700; color: #1e3a8a; }
    .summary-card.red .value { color: #dc2626; }
    .container { padding: 16px 24px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #1e3a8a; color: white; }
    thead th { padding: 9px 10px; text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase; }
    thead th.num { width: 36px; text-align: center; }
    tbody tr.even { background: #ffffff; }
    tbody tr.odd  { background: #f8fafc; }
    tbody tr:hover { background: #eff6ff; }
    td { padding: 8px 10px; vertical-align: top; border-bottom: 1px solid #e2e8f0; }
    td.num { text-align: center; color: #94a3b8; font-size: 11px; }
    .barcode { font-family: monospace; font-size: 10px; color: #94a3b8; }
    .tier-label { font-weight: 600; color: #475569; }
    .footer { text-align: center; padding: 12px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 8px; }
    @media print {
      body { font-size: 11px; }
      .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      thead tr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      tbody tr.odd { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📦 Stock Report</h1>
    <p>Generated on: ${dateStr} &nbsp;|&nbsp; Total Products: ${totalProducts}</p>
  </div>
  <div class="summary">
    <div class="summary-card">
      <div class="label">Total Products</div>
      <div class="value">${totalProducts}</div>
    </div>
    <div class="summary-card">
      <div class="label">Total Shop Stock (Units)</div>
      <div class="value">${totalShopStock.toLocaleString('en-IN')}</div>
    </div>
    <div class="summary-card red">
      <div class="label">Low Stock Items</div>
      <div class="value">${lowStockCount}</div>
    </div>
  </div>
  <div class="container">
    <table>
      <thead>
        <tr>
          <th class="num">#</th>
          <th>Product Name</th>
          <th>Category</th>
          <th>Brand</th>
          <th>Prices</th>
          <th>Stock (Shop + Driver)</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>
  <div class="footer">POS Counter &bull; Stock Report &bull; ${dateStr}</div>
</body>
</html>`;

      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:0';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow.document;
      doc.open(); doc.write(html); doc.close();
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 2000);
      }, 600);

    } catch (e) {
      toast.error('Could not load stock report');
    } finally {
      setPrinting(false);
    }
  };

  // Extract up to 4 dynamic tier names from the current products page
  const dynamicTiers = Array.from(
    new Set(products.flatMap(p => Array.isArray(p.pricingTiers) ? p.pricingTiers.map(t => t.name) : []))
  ).slice(0, 4);

  const formatStock = (p) => {
    const stock = Number(p.currentStock) || 0;
    if (stock <= 0) return '0';

    // Get the tier with the most unit levels (master tier)
    let mappedUnits = [];
    if (Array.isArray(p.pricingTiers) && p.pricingTiers.length > 0) {
      const masterTier = p.pricingTiers.reduce(
        (prev, curr) => ((prev.units || []).length > (curr.units || []).length) ? prev : curr,
        p.pricingTiers[0]
      );
      if (masterTier && Array.isArray(masterTier.units) && masterTier.units.length > 0) {
        mappedUnits = masterTier.units;
      }
    }

    // No multi-unit tiers → show raw number
    if (mappedUnits.length <= 1) return stock.toString();

    // Compute base multiplier for each unit:
    // units = [BOX(qty:1), PKT(qty:12), PCS(qty:10)]
    // BOX mult = 12*10=120, PKT mult = 10, PCS mult = 1
    const unitMultipliers = mappedUnits.map((u, i) => {
      let multiplier = 1;
      for (let j = i + 1; j < mappedUnits.length; j++) {
        multiplier *= (Number(mappedUnits[j].quantity) || 1);
      }
      return { name: u.name, multiplier };
    });

    let remaining = stock;
    const parts = [];

    for (let i = 0; i < unitMultipliers.length; i++) {
      const { name, multiplier } = unitMultipliers[i];
      const isLastUnit = i === unitMultipliers.length - 1;

      if (isLastUnit) {
        // Last (smallest) unit: show whatever is left
        if (remaining > 0) parts.push(`${remaining} ${name}`);
      } else {
        const qty = Math.floor(remaining / multiplier);
        if (qty > 0) {
          parts.push(`${qty} ${name}`);
          remaining = remaining % multiplier;
        }
      }
    }

    return parts.length > 0 ? parts.join(', ') : '0';
  };


  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">Manage your product catalog</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            id="print-stock-btn"
            onClick={printStockReport}
            disabled={printing}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {printing ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
            {printing ? 'Loading...' : 'Print Stock'}
          </button>
          <Link to="/products/add" className="btn-primary">
            <Plus size={16} /> Add Product
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, brand, or barcode..."
            className="input pl-9"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="input w-48"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                {dynamicTiers.length > 0 ? (
                  dynamicTiers.map(tierName => (
                    <th key={tierName} className="text-right">{tierName} ₹</th>
                  ))
                ) : (
                  <>
                    <th className="text-right">Retail ₹</th>
                    <th className="text-right">Wholesale ₹</th>
                  </>
                )}
                <th className="text-right">Stock</th>
                <th className="text-center">GST</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8">
                    <Loader2 size={24} className="animate-spin text-blue-500 mx-auto" />
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <Package size={32} strokeWidth={1} className="mx-auto mb-2" />
                    No products found
                  </td>
                </tr>
              ) : products.map((p) => {
                const isLow = p.minStockAlert > 0 && Number(p.currentStock) <= Number(p.minStockAlert);
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="font-medium text-slate-800">{p.name}</div>
                      {p.barcode && <div className="text-xs text-slate-400 font-mono">{p.barcode}</div>}
                    </td>
                    <td>
                      <span className="badge-slate">{p.category?.name || '—'}</span>
                    </td>
                    {dynamicTiers.length > 0 ? (
                      dynamicTiers.map(tierName => {
                        const tierValue = Array.isArray(p.pricingTiers) ? p.pricingTiers.find(t => t.name === tierName) : null;
                        let displayPrice = 0;
                        if (tierValue) {
                           if (tierValue.refPrice) displayPrice = Number(tierValue.refPrice);
                           else if (tierValue.price) displayPrice = Number(tierValue.price);
                           else if (tierValue.units && tierValue.units.length > 0) displayPrice = Number(tierValue.units[0].price);
                        }
                        return (
                          <td key={tierName} className="text-right font-medium">
                            {tierValue ? `₹${displayPrice.toLocaleString('en-IN')}` : '—'}
                          </td>
                        );
                      })
                    ) : (
                      <>
                        <td className="text-right font-medium">₹{Number(p.retailPrice).toLocaleString('en-IN')}</td>
                        <td className="text-right text-slate-500">₹{Number(p.wholesalePrice).toLocaleString('en-IN')}</td>
                      </>
                    )}
                    <td className="text-right">
                      <span className={isLow ? 'badge-red' : 'badge-green'}>
                        {isLow && <AlertCircle size={10} className="mr-1" />}
                        {formatStock(p)}
                      </span>
                    </td>
                    <td className="text-center text-slate-500 text-xs">{p.gstPercent}%</td>
                    <td>
                      <div className="flex items-center justify-center gap-2">
                        <Link to={`/products/edit/${p.id}`} className="text-blue-500 hover:text-blue-700 p-1">
                          <Edit size={14} />
                        </Link>
                        <button onClick={() => handleDelete(p.id)} className="text-slate-400 hover:text-red-500 p-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              Showing {((page - 1) * 25) + 1}–{Math.min(page * 25, pagination.total)} of {pagination.total}
            </span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-secondary btn-sm">Prev</button>
              <button disabled={page >= pagination.pages} onClick={() => setPage(page + 1)} className="btn-secondary btn-sm">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
