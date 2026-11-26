import { useState, useEffect } from 'react';
import { salesAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { 
  Calendar, Clock, Receipt, Printer, User, 
  Search, Loader2, IndianRupee, RefreshCw, Edit, MessageCircle, Mail
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

export default function BillHistoryPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchSales = async (pageNum = 1, isSearch = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      const res = await salesAPI.list({ 
        page: pageNum, 
        limit: 30, 
        search,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
      
      const newSales = res.data.sales || [];
      if (isSearch || pageNum === 1) {
        setSales(newSales);
      } else {
        setSales(prev => [...prev, ...newSales]);
      }
      
      setTotalPages(res.data.pagination.pages);
      setHasMore(pageNum < res.data.pagination.pages);
    } catch (e) {
      toast.error('Failed to load bill history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales(1, true);
  }, [search, startDate, endDate]);

  const loadMore = () => {
    if (hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchSales(nextPage);
    }
  };

  // Group sales by Date (e.g., '11 Mar 2026')
  const groupedSales = sales.reduce((groups, sale) => {
    const dateStr = format(parseISO(sale.saleDate), 'dd MMM yyyy');
    if (!groups[dateStr]) groups[dateStr] = [];
    groups[dateStr].push(sale);
    return groups;
  }, {});

  const handlePrint = (sale) => {
    
    
    const dateStr = format(parseISO(sale.saleDate), 'dd MMM yyyy');
    const timeStr = format(parseISO(sale.saleDate), 'hh:mm a');
    
    const rows = sale.items?.map(item => {
      // Bill history items already have totalAmount stored
      const lineTotal = Number(item.totalAmount);
      // Try to determine GST if available, fallback to '-'
      const gstAmt = lineTotal * (Number(item.product?.gstPercent) || 0) / 100;
      const gstStr = Number(item.product?.gstPercent) > 0 
        ? `${Number(item.product?.gstPercent)}% (₹${gstAmt.toFixed(2)})` 
        : '-';

      return `<tr>
        <td>${item.product?.name || 'Unknown'}<br/><small style="color:#666">${item.unitType}</small></td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">₹${Number(item.unitPrice).toFixed(2)}</td>
        <td style="text-align:right">${gstStr}</td>
        <td style="text-align:right">₹${lineTotal.toFixed(2)}</td>
      </tr>`;
    }).join('') || '';

    // History API returns a simplified payment object, adapt it:
    const paymentRows = `<tr><td>${sale.paymentMode}</td><td style="text-align:right">₹${Number(sale.grandTotal).toFixed(2)}</td></tr>`;

    const billContent = `
      <div style="padding:10px;">
        <div class="center bold" style="font-size:18px;margin-bottom:2px;text-transform:uppercase;">ASHA FMCG</div>
        <div class="center bold" style="font-size:14px;margin-bottom:4px;">Ph: 7070474780</div>
        <div class="center" style="margin-bottom:2px;font-size:10px;">Tax Invoice (Copy)</div>
        <div class="divider"></div>
        <div style="display:flex;justify-content:space-between;font-size:10px;">
          <span><b>Bill#</b> ${sale.invoiceNumber}</span>
          <span>${dateStr} ${timeStr}</span>
        </div>
        <div style="margin-top:2px;font-size:10px;"><b>Cust:</b> ${sale.customer?.name || 'Walk-in'}${sale.customer?.mobile ? ' · ' + sale.customer.mobile : ''}</div>
        <div class="divider"></div>
        <table>
          <thead><tr>
            <th class="item-name">Item</th>
            <th style="text-align:center">Qty</th>
            <th style="text-align:right">Price</th>
            <th style="text-align:right">GST</th>
            <th style="text-align:right">Total</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="divider"></div>
        <table>
          <tr><td>Subtotal</td><td style="text-align:right">₹${Number(sale.subtotal).toFixed(2)}</td></tr>
          <tr><td>GST</td><td style="text-align:right">₹${Number(sale.totalGst).toFixed(2)}</td></tr>
          ${Number(sale.totalDiscount) > 0 ? `<tr><td>Discount</td><td style="text-align:right">-₹${Number(sale.totalDiscount).toFixed(2)}</td></tr>` : ''}
          ${Number(sale.extraChargeAmount) > 0 ? `<tr><td>${sale.extraChargeName || 'Extra Charge'}</td><td style="text-align:right">₹${Number(sale.extraChargeAmount).toFixed(2)}</td></tr>` : ''}
          <tr class="total-row grand"><td style="padding-top:2px;">Grand Total</td><td style="text-align:right;padding-top:2px;">₹${Number(sale.grandTotal).toFixed(2)}</td></tr>
          ${Number(sale.previousDuesSettled) > 0 ? `<tr style="font-weight:bold"><td style="padding-top:4px;">Previous Due Rec.</td><td style="text-align:right;padding-top:4px;">₹${Number(sale.previousDuesSettled).toFixed(2)}</td></tr>` : ''}
          ${Number(sale.previousDuesSettled) > 0 ? `<tr class="total-row grand"><td style="padding-top:4px;">Net Payable</td><td style="text-align:right;padding-top:4px;">₹${(Number(sale.grandTotal) + Number(sale.previousDuesSettled)).toFixed(2)}</td></tr>` : ''}
        </table>
        <div class="divider"></div>
        <table>${paymentRows}</table>
        ${sale.isCredit ? `<div style="color:#000;font-weight:bold;margin-top:2px">Credit Sale</div>` : ''}
        <div class="divider"></div>
        <div class="center bold" style="margin-top:4px;font-size:10px;">Thank you! Visit again 🙏</div>
        <div class="center bold" style="font-size:10px;margin-top:2px;">Powered by POS Counter</div>
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
          body > * {
            display: none !important;
          }
          body > #thermal-print-container {
            display: block !important;
          }
          
          @page { margin: 0; size: 80mm auto; }
          body, html { margin: 0 !important; padding: 0 !important; background: white !important; }
          
          #thermal-print-container {
            width: 80mm;
            margin: 0; padding: 0;
            font-family: monospace; font-size: 15px; font-weight: 700; color: #000;
            position: absolute; top: 0; left: 0;
          }
          #thermal-print-container * { box-sizing: border-box; }
          #thermal-print-container .center { text-align: center; }
          #thermal-print-container .bold { font-weight: 900; }
          #thermal-print-container .divider { border-top: 1.5px dashed #000; margin: 5px 0; }
          #thermal-print-container table { width: 100%; border-collapse: collapse; }
          #thermal-print-container th { text-align: left; font-size: 14px; border-bottom: 1.5px solid #000; padding: 3px 0; font-weight: 900; }
          #thermal-print-container td { padding: 4px 0; font-size: 15px; font-weight: 700; vertical-align: top; }
          #thermal-print-container .item-name { max-width: 35mm; word-wrap: break-word; }
          #thermal-print-container .total-row { font-weight: 900; border-top: 1.5px solid #000; }
          #thermal-print-container .grand { font-size: 17px; font-weight: 900; }
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

  // ── Build plain-text bill for sharing ──────────────────────
  const buildBillText = (sale) => {
    const dateStr = format(parseISO(sale.saleDate), 'dd MMM yyyy');
    const timeStr = format(parseISO(sale.saleDate), 'hh:mm a');
    const sep = '-'.repeat(32);
    const cust = sale.customer;

    let text = '';
    text += `*ASHA FMCG*\n`;
    text += `Ph: 7070474780\n`;
    text += `${sep}\n`;
    text += `Bill#: ${sale.invoiceNumber}\n`;
    text += `Date : ${dateStr} ${timeStr}\n`;
    text += `Cust : ${cust?.name || 'Walk-in'}${cust?.mobile ? ' | ' + cust.mobile : ''}\n`;
    text += `${sep}\n`;
    text += `*ITEMS*\n`;
    (sale.items || []).forEach(item => {
      text += `${item.product?.name || 'Item'}\n`;
      text += `  ${item.quantity} ${item.unitType} x \u20b9${Number(item.unitPrice).toFixed(2)} = \u20b9${Number(item.totalAmount).toFixed(2)}\n`;
    });
    text += `${sep}\n`;
    text += `Subtotal : \u20b9${Number(sale.subtotal).toFixed(2)}\n`;
    if (Number(sale.totalGst) > 0)      text += `GST      : \u20b9${Number(sale.totalGst).toFixed(2)}\n`;
    if (Number(sale.totalDiscount) > 0) text += `Discount : -\u20b9${Number(sale.totalDiscount).toFixed(2)}\n`;
    if (Number(sale.extraChargeAmount) > 0) text += `${sale.extraChargeName || 'Extra'}: \u20b9${Number(sale.extraChargeAmount).toFixed(2)}\n`;
    text += `*Grand Total: \u20b9${Number(sale.grandTotal).toFixed(2)}*\n`;
    if (Number(sale.previousDuesSettled) > 0) {
      text += `Prev Due Rec.: \u20b9${Number(sale.previousDuesSettled).toFixed(2)}\n`;
      text += `*Net Payable: \u20b9${(Number(sale.grandTotal) + Number(sale.previousDuesSettled)).toFixed(2)}*\n`;
    }
    text += `${sep}\n`;
    text += `${sale.paymentMode}: \u20b9${Number(sale.grandTotal).toFixed(2)}\n`;
    if (sale.isCredit) text += `*Credit Sale*\n`;
    text += `${sep}\n`;
    text += `Thank you! Visit again \ud83d\ude4f\nPowered by POS Counter`;
    return text;
  };

  const handleShareWhatsApp = (sale) => {
    const text = buildBillText(sale);
    const phone = sale.customer?.mobile ? sale.customer.mobile.replace(/\D/g, '') : '';
    const url = phone
      ? `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleShareEmail = (sale) => {
    const text = buildBillText(sale);
    const subject = encodeURIComponent(`Bill ${sale.invoiceNumber} - ASHA FMCG`);
    const body = encodeURIComponent(text);
    const email = sale.customer?.email || '';
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Bill History</h1>
          <p className="text-slate-500 text-sm">View, search, and print past sales invoices</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Invoice No. or Customer Name..."
              className="input pl-9 w-full"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input pl-8 w-[130px] sm:w-36 text-sm"
              />
            </div>
            <span className="text-slate-400 text-sm">to</span>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input pl-8 w-[130px] sm:w-36 text-sm"
              />
            </div>
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-xs text-blue-600 hover:bg-blue-50 py-1.5 px-2 rounded font-medium ml-1 transition-colors"
                title="Clear date filter"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && page === 1 ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      ) : Object.keys(groupedSales).length === 0 ? (
        <div className="card p-12 flex flex-col items-center justify-center text-slate-400">
          <Receipt size={48} className="mb-4 opacity-50" />
          <p>No bills found.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-8 pb-10">
          {Object.entries(groupedSales).map(([date, dateSales]) => (
            <div key={date} className="space-y-4">
              {/* Date Header */}
              <div className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur pb-2 pt-1 border-b border-slate-200">
                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                  <Calendar size={16} className="text-blue-600" />
                  {date}
                </div>
              </div>

              {/* Bills List for this Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dateSales.map(sale => (
                  <div key={sale.id} className="card p-0 overflow-hidden hover:shadow-md transition-shadow">
                    
                    {/* Bill Item Header */}
                    <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 font-bold text-slate-800">
                          <Receipt size={16} className="text-emerald-600" />
                          {sale.invoiceNumber}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {format(parseISO(sale.saleDate), 'hh:mm a')}
                          </span>
                          <span className="flex items-center gap-1">
                            <User size={12} /> {sale.customer?.name || 'Walk-in'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-blue-600 flex items-center justify-end">
                          <IndianRupee size={14} />
                          {Number(sale.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="inline-flex mt-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                          {sale.paymentMode} {sale.isCredit ? '(Credit)' : ''}
                        </div>
                      </div>
                    </div>

                    {/* Bill Items Breakdown */}
                    <div className="p-4 bg-white">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-400 border-b border-slate-100">
                          <tr>
                            <th className="pb-2 font-medium">Item</th>
                            <th className="pb-2 font-medium text-center">Qty</th>
                            <th className="pb-2 font-medium text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {sale.items?.map((item) => (
                            <tr key={item.id}>
                              <td className="py-2 text-slate-700 font-medium truncate max-w-[120px]">
                                {item.product?.name || 'Unknown'}
                                <div className="text-[10px] text-slate-400 font-normal">₹{Number(item.unitPrice).toFixed(2)}/unit</div>
                              </td>
                              <td className="py-2 text-center text-slate-600">
                                {item.quantity} <span className="text-[10px] text-slate-400">{item.unitType}</span>
                              </td>
                              <td className="py-2 text-right font-medium text-slate-800">
                                ₹{Number(item.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Actions */}
                    <div className="bg-slate-50 p-2 border-t border-slate-100 flex justify-end gap-2 flex-wrap">
                      <button 
                        onClick={() => navigate(`/sale?edit=${sale.id}`)}
                        className="btn-secondary btn-sm gap-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      >
                        <Edit size={14} />
                        Edit Bill
                      </button>
                      <button
                        onClick={() => handleShareWhatsApp(sale)}
                        title="Share on WhatsApp"
                        className="btn-sm gap-1.5 flex items-center bg-[#25D366] hover:bg-[#20c05c] text-white rounded-lg font-medium transition-colors px-3"
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </button>
                      <button
                        onClick={() => handleShareEmail(sale)}
                        title="Share via Email"
                        className="btn-sm gap-1.5 flex items-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors px-3"
                      >
                        <Mail size={14} /> Email
                      </button>
                      <button 
                        onClick={() => handlePrint(sale)}
                        className="btn-secondary btn-sm gap-2"
                      >
                        <Printer size={14} />
                        Print Bill
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-6">
              <button 
                onClick={loadMore} 
                disabled={loading}
                className="btn-secondary gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Load More History
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
