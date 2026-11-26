import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, Printer, Package,
  Loader2, Tag, Minus, Plus, CheckSquare, Square,
} from 'lucide-react';
import { productsAPI } from '../../utils/api';
import JsBarcode from 'jsbarcode';

// ── Render one barcode SVG via JsBarcode ───────────────────────────────────
function BarcodeDisplay({ value, height = 40, fontSize = 11 }) {
  const svgRef = useRef(null);
  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        lineColor: '#000',
        width: 1.6,
        height,
        displayValue: true,
        fontSize,
        margin: 4,
        background: 'transparent',
      });
    } catch (e) {
      // invalid barcode value — leave blank
    }
  }, [value, height, fontSize]);

  if (!value) return <span className="text-slate-300 text-xs">No barcode</span>;
  return <svg ref={svgRef} className="max-w-full" />;
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function BarcodePage() {
  const [searchParams] = useSearchParams();
  const preselectedProductId = searchParams.get('productId');

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Selection state: { [productId]: { product, qty } }
  const [selections, setSelections] = useState({});

  // Print ref
  const printAreaRef = useRef(null);

  // ── Fetch products ──────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => fetchProducts(), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await productsAPI.list({ search: search.trim(), limit: 200 });
      const prods = res.data?.products || [];
      setProducts(prods);

      // Auto-select if productId in URL
      if (preselectedProductId) {
        const found = prods.find(p => p.id === preselectedProductId);
        if (found && found.barcode) {
          setSelections(prev => ({
            ...prev,
            [found.id]: { product: found, qty: 1 },
          }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ── Selection helpers ───────────────────────────────────────────────────
  const toggleSelect = (product) => {
    setSelections(prev => {
      if (prev[product.id]) {
        const next = { ...prev };
        delete next[product.id];
        return next;
      }
      return { ...prev, [product.id]: { product, qty: 1 } };
    });
  };

  const setQty = (productId, qty) => {
    const val = Math.max(1, Math.min(999, Number(qty) || 1));
    setSelections(prev => ({
      ...prev,
      [productId]: { ...prev[productId], qty: val },
    }));
  };

  const selectedList = Object.values(selections);
  const totalLabels = selectedList.reduce((s, x) => s + (x.qty || 1), 0);

  // ── Print ───────────────────────────────────────────────────────────────
  const handlePrint = useCallback((subset) => {
    const toPrint = subset || selectedList;
    if (toPrint.length === 0) return;

    let labelsHtml = '';
    const idsToRender = [];

    toPrint.forEach(({ product, qty }) => {
      // Same logic as display: use product name as the barcode value
      const barcode = product.name.replace(/[^\x20-\x7E]/g, '').trim() || product.id;
      for (let i = 0; i < qty; i++) {
        const svgId = `bc_${product.id}_${i}`;
        labelsHtml += `
          <div class="label">
            <div class="pname">${product.name}</div>
            ${barcode
              ? `<svg id="${svgId}" class="bcsvg"></svg><div class="bnum">${barcode}</div>`
              : '<div class="nobc">No barcode</div>'
            }
          </div>`;
        if (barcode) {
          idsToRender.push({ id: svgId, val: barcode });
        }
      }
    });

    // Render barcodes into a hidden staging div first (JSBarcode needs a live DOM element)
    const stagingDiv = document.createElement('div');
    stagingDiv.style.cssText = 'position:fixed;top:-9999px;left:-9999px;visibility:hidden;';
    stagingDiv.innerHTML = `<div class="grid">${labelsHtml}</div>`;
    document.body.appendChild(stagingDiv);

    idsToRender.forEach(({ id, val }) => {
      try {
        JsBarcode(stagingDiv.querySelector(`#${id}`), val, {
          format:'CODE128', lineColor:'#000', width:1.8, height:40,
          displayValue:false, margin:2, background:'transparent'
        });
      } catch (e) {}
    });

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
          @page { margin: 8px; }
          body, html { margin: 0 !important; padding: 0 !important; background: white !important; }
          #thermal-print-container {
            display: block !important;
            padding: 4px;
            font-family: Arial, sans-serif; background: #fff;
            position: absolute; top: 0; left: 0; width: 100%;
          }
          #thermal-print-container * { box-sizing: border-box; }
          #thermal-print-container .grid { display: flex; flex-wrap: wrap; gap: 4px; }
          #thermal-print-container .label {
            border: 1px solid #bbb; border-radius: 5px;
            padding: 5px 8px; width: 196px;
            text-align: center; background: #fff;
            page-break-inside: avoid;
          }
          #thermal-print-container .pname { font-size: 11px; font-weight: 700; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          #thermal-print-container .bcsvg { max-width: 100%; }
          #thermal-print-container .bnum { font-size: 9px; font-family: monospace; color: #444; }
          #thermal-print-container .nobc { font-size: 9px; color: #ccc; margin: 8px 0; }
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
    
    // Assign inner HTML from the staging div
    printContainer.innerHTML = stagingDiv.innerHTML;
    // Clean up staging div
    document.body.removeChild(stagingDiv);

    // Call window.print globally. App UI is hidden automatically by CSS.
    setTimeout(() => { window.print(); }, 200);
  }, [selectedList]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Barcode Labels</h1>
          <p className="page-subtitle">Select products → set quantity → print</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handlePrint()}
            disabled={selectedList.length === 0}
            className="btn-primary gap-2"
          >
            <Printer size={16} />
            Print {totalLabels > 0 ? `${totalLabels} Label${totalLabels > 1 ? 's' : ''}` : 'Labels'}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="card p-4 mb-5">
        <div className="relative max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="input pl-9"
          />
        </div>
      </div>

      {/* Selected summary strip */}
      {selectedList.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-blue-700 font-medium">
            <Tag size={15} />
            {selectedList.length} product{selectedList.length > 1 ? 's' : ''} selected
            &nbsp;·&nbsp; {totalLabels} total labels
          </div>
          <button
            onClick={() => setSelections({})}
            className="text-xs text-blue-500 hover:text-blue-700 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Product list */}
      <div className="space-y-2">
        {loading ? (
          <div className="card py-16 flex justify-center">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        ) : products.length === 0 ? (
          <div className="card py-16 text-center text-slate-400">
            <Package size={36} strokeWidth={1} className="mx-auto mb-2" />
            No products found
          </div>
        ) : products.map(product => {
          const sel = selections[product.id];
          // Use product name as barcode value (user requirement: 1 barcode per product, name stored)
          // Sanitize name for CODE128 — keep printable ASCII only
          const barcode = product.name.replace(/[^\x20-\x7E]/g, '').trim() || product.id;

          return (
            <div
              key={product.id}
              className={`card overflow-hidden flex items-center gap-4 px-5 py-4 ${sel ? 'bg-blue-50/40' : 'hover:bg-slate-50/50'} transition-colors`}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleSelect(product)}
                className={`shrink-0 transition-colors ${sel ? 'text-blue-600' : 'text-slate-300 hover:text-slate-500'}`}
              >
                {sel ? <CheckSquare size={18} /> : <Square size={18} />}
              </button>

              {/* Product name + barcode value */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-slate-800 truncate">{product.name}</div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">{barcode || 'No barcode'}</div>
              </div>

              {/* Barcode preview */}
              <div className="shrink-0">
                {barcode
                  ? <BarcodeDisplay value={barcode} height={32} fontSize={9} />
                  : <span className="text-xs text-slate-300 italic">No barcode</span>
                }
              </div>

              {/* Qty selector */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => sel && setQty(product.id, (sel.qty || 1) - 1)}
                  disabled={!sel}
                  className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center hover:bg-slate-100 disabled:opacity-30 transition-colors"
                >
                  <Minus size={12} />
                </button>
                <input
                  type="number" min="1" max="999"
                  value={sel?.qty ?? 1}
                  disabled={!sel}
                  onChange={e => sel && setQty(product.id, e.target.value)}
                  className="w-14 h-7 border border-slate-200 rounded-md text-center text-sm font-semibold disabled:opacity-30 focus:outline-none focus:border-blue-400"
                />
                <button
                  onClick={() => sel && setQty(product.id, (sel.qty || 1) + 1)}
                  disabled={!sel}
                  className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center hover:bg-slate-100 disabled:opacity-30 transition-colors"
                >
                  <Plus size={12} />
                </button>
              </div>

              {/* Quick single print */}
              <button
                onClick={() => handlePrint([{ product, qty: sel?.qty ?? 1 }])}
                disabled={!barcode}
                className="btn-secondary btn-sm gap-1 h-7 text-xs shrink-0"
              >
                <Printer size={12} /> Print
              </button>
            </div>
          );
        })}
      </div>

      <div ref={printAreaRef} style={{ display: 'none' }} />
    </div>
  );
}
