import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  Search, Scan, Trash2, Plus, Minus, ShoppingCart,
  User, Printer, Check, Loader2, X, CreditCard, Wallet, UserCheck, Eye, Share2, MessageCircle, Mail
} from 'lucide-react';
import { productsAPI, customersAPI, salesAPI, salesmenAPI } from '../../utils/api';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'CREDIT'];

export default function SalePage() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const [portalTarget, setPortalTarget] = useState(null);

  useEffect(() => {
    setPortalTarget(document.getElementById('header-portal-target'));
  }, []);
  
  const [tabs, setTabs] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_sale_tabs');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [{ id: 1, cart: [], saleType: 'Retail', customer: null, payments: { CASH: '', UPI: '', CARD: '' }, discount: '', salesman: null, extraChargeName: '', extraChargeAmt: '', previousDuesAdded: '' }];
  });
  
  const [activeTabId, setActiveTabId] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_sale_active_tab');
      if (saved) return JSON.parse(saved);
    } catch {}
    return 1;
  });

  useEffect(() => {
    localStorage.setItem('pos_sale_tabs', JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    localStorage.setItem('pos_sale_active_tab', JSON.stringify(activeTabId));
  }, [activeTabId]);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const cart = activeTab.cart || [];
  const saleType = activeTab.saleType || 'Retail';
  const customer = activeTab.customer || null;
  const payments = activeTab.payments || { CASH: '', UPI: '', CARD: '' };
  const discount = activeTab.discount || '';
  const salesman = activeTab.salesman || null;
  const extraChargeName = activeTab.extraChargeName || '';
  const extraChargeAmt = activeTab.extraChargeAmt || '';
  const previousDuesAdded = activeTab.previousDuesAdded || '';

  const updateActiveTab = (updates) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, ...updates } : t));
  };

  const setCart = (val) => updateActiveTab({ cart: typeof val === 'function' ? val(cart) : val });
  const setSaleType = (val) => updateActiveTab({ saleType: typeof val === 'function' ? val(saleType) : val });
  const setCustomer = (val) => updateActiveTab({ customer: typeof val === 'function' ? val(customer) : val });
  const setPayments = (val) => updateActiveTab({ payments: typeof val === 'function' ? val(payments) : val });
  const setDiscount = (val) => updateActiveTab({ discount: typeof val === 'function' ? val(discount) : val });
  const setSalesman = (val) => updateActiveTab({ salesman: typeof val === 'function' ? val(salesman) : val });
  const setExtraChargeName = (val) => updateActiveTab({ extraChargeName: typeof val === 'function' ? val(extraChargeName) : val });
  const setExtraChargeAmt = (val) => updateActiveTab({ extraChargeAmt: typeof val === 'function' ? val(extraChargeAmt) : val });
  const setPreviousDuesAdded = (val) => updateActiveTab({ previousDuesAdded: typeof val === 'function' ? val(previousDuesAdded) : val });

  const addTab = () => {
    const newId = Date.now();
    setTabs(prev => [
      ...prev,
      { id: newId, cart: [], saleType: 'Retail', customer: null, payments: { CASH: '', UPI: '', CARD: '' }, discount: '', salesman: null, extraChargeName: '', extraChargeAmt: '', previousDuesAdded: '' }
    ]);
    setActiveTabId(newId);
  };

  const removeTab = (id) => {
    if (tabs.length <= 1) return;
    setTabs(prev => {
      const remaining = prev.filter(t => t.id !== id);
      if (activeTabId === id) {
        setActiveTabId(remaining[remaining.length - 1].id);
      }
      return remaining;
    });
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [availableTiers, setAvailableTiers] = useState(['Retail', 'Wholesale']);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [completing, setCompleting] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [completedSaleData, setCompletedSaleData] = useState(null);
  const [salesmanSearch, setSalesmanSearch] = useState('');
  const [salesmenList, setSalesmenList] = useState([]);
  const [scanMode, setScanMode] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [revealedCost, setRevealedCost] = useState(null); // { productId: string, cost: number }

  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', mobile: '' });
  const [addingCustomer, setAddingCustomer] = useState(false);

  const searchRef = useRef(null);
  const barcodeInputRef = useRef(null);
  const barcodeBuffer = useRef('');
  const barcodeTimer = useRef(null);
  const submitLock = useRef(false);

  // Fetch search on mount & fetch dynamic tiers
  useEffect(() => { 
    searchRef.current?.focus(); 
    
    // Fetch salesmen
    salesmenAPI.list().then(r => setSalesmenList(r.data || [])).catch(() => {});
    
    // Fetch unique tier names dynamically
    productsAPI.list({ limit: 500 }).then(r => {
      const prods = r.data?.products || [];
      const tNames = new Set(['Retail', 'Wholesale', 'Semi-Wholesale']); // Base fallbacks
      prods.forEach(p => {
        if (Array.isArray(p.pricingTiers)) {
          p.pricingTiers.forEach(t => { if (t.name) tNames.add(t.name); });
        }
      });
      setAvailableTiers(Array.from(tNames));
    }).catch(() => {});
  }, []);

  // Handle Edit mode initialization
  useEffect(() => {
    if (editId) {
      const loadEditSale = async () => {
        try {
          const res = await salesAPI.get(editId);
          const sale = res.data;
          
          const existingTab = tabs.find(t => t.editSaleId === editId);
          if (existingTab) {
            setActiveTabId(existingTab.id);
            return;
          }

          const newCart = (sale.items || []).map(item => {
            // productObj now has pricingTiers from backend (getSaleById was fixed)
            const productObj = item.product || {};
            
            // Get all units from pricingTiers for this product (to support unit selector in edit)
            let availableUnits = [];
            if (Array.isArray(productObj.pricingTiers) && productObj.pricingTiers.length > 0) {
              // Find the tier that was used for this item, or fallback to first tier
              const usedTier = productObj.pricingTiers.find(
                t => t.name && t.name.toLowerCase() === (item.saleType || '').toLowerCase()
              ) || productObj.pricingTiers[0];
              availableUnits = usedTier?.units || [];
            }

            return {
              productId: item.productId,
              name: productObj.name,
              barcode: productObj.barcode,
              unitType: item.unitType,            // exact unit used at time of sale (BOX/ROLL/PCS)
              unitPrice: Number(item.unitPrice),  // exact price at time of sale
              gstPercent: Number(item.gstPercent || productObj.gstPercent || 0),
              currentStock: Number(productObj.currentStock || 0),
              quantity: Number(item.quantity),
              discount: Number(item.discount || 0),
              saleType: item.saleType,
              productObj,                          // full product with pricingTiers
              availableUnits,                      // unit list for dropdown
              baseCostPrice: Number(productObj.purchasePrice || 0),
            };
          });

          const paymentsObj = { CASH: '', UPI: '', CARD: '' };
          sale.payments?.forEach(p => {
             if (paymentsObj[p.paymentMode] !== undefined) paymentsObj[p.paymentMode] = Number(p.amount);
          });

          const newId = Date.now();
          setTabs(prev => [
            ...prev,
            { 
              id: newId, 
              cart: newCart, 
              saleType: sale.saleType || 'Retail', 
              customer: sale.customer, 
              payments: paymentsObj, 
              discount: Number(sale.totalDiscount || 0), 
              salesman: sale.salesman || null,
              isEditMode: true,
              editSaleId: editId
            }
          ]);
          setActiveTabId(newId);
          setSearchParams({});
        } catch(e) {
          toast.error("Failed to load sale for editing");
        }
      };
      loadEditSale();
    }
  }, [editId, searchParams, setSearchParams, tabs]);

  // Barcode scanner support (keyboard wedge scanners)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target !== searchRef.current) {
        // Accumulate barcode characters
        if (e.key === 'Enter' && barcodeBuffer.current.length > 3) {
          handleBarcodeSearch(barcodeBuffer.current);
          barcodeBuffer.current = '';
        } else if (e.key.length === 1) {
          barcodeBuffer.current += e.key;
          clearTimeout(barcodeTimer.current);
          barcodeTimer.current = setTimeout(() => { barcodeBuffer.current = ''; }, 100);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saleType]);

  const handleBarcodeSearch = async (barcode) => {
    const trimmed = barcode.trim();
    if (!trimmed) return;
    setScanning(true);
    try {
      const res = await productsAPI.getByBarcode(trimmed);
      addToCart(res.data);
      setBarcodeInput('');
      // keep scan mode active for next scan
      setTimeout(() => barcodeInputRef.current?.focus(), 50);
    } catch (e) {
      toast.error(`Barcode "${trimmed}" not found`);
      setBarcodeInput('');
      setTimeout(() => barcodeInputRef.current?.focus(), 50);
    } finally {
      setScanning(false);
    }
  };

  const toggleScanMode = () => {
    setScanMode(prev => {
      if (!prev) {
        // entering scan mode — focus barcode input
        setTimeout(() => barcodeInputRef.current?.focus(), 50);
      } else {
        // leaving scan mode — focus search
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      return !prev;
    });
    setBarcodeInput('');
  };

  // Search products
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await productsAPI.list({ search: searchQuery, limit: 10 });
        setSearchResults(res.data.products || []);
      } catch (e) {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search customers
  useEffect(() => {
    if (!customerSearch.trim()) { setCustomerResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await customersAPI.list({ search: customerSearch });
        setCustomerResults(res.data.customers || res.data || []);
      } catch (e) {}
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomer.name || !newCustomer.mobile) {
      toast.error('Name and Mobile are required');
      return;
    }
    setAddingCustomer(true);
    try {
      const res = await customersAPI.create(newCustomer);
      toast.success('Customer added successfully!');
      setCustomer(res.data);
      setShowAddCustomerModal(false);
      setNewCustomer({ name: '', mobile: '' });
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to add customer');
    } finally {
      setAddingCustomer(false);
    }
  };

  const getTierForProduct = (product, targetTierName = 'Retail') => {
    // Graceful wrapper for unstructured legacy products
    if (!product.pricingTiers || !Array.isArray(product.pricingTiers) || product.pricingTiers.length === 0) {
      return {
        name: 'Retail',
        price: product.retailPrice || 0,
        barcode: product.barcode,
        units: [{ name: product.unitType || 'PCS', quantity: 1, price: product.retailPrice || 0 }]
      };
    }
    
    // Try exact match
    let matchedTier = product.pricingTiers.find(t => t?.name?.toLowerCase() === targetTierName?.toLowerCase());
    if (matchedTier) return matchedTier;
    
    // Provide fallback nearest value item if no tier exact match
    const sorted = [...product.pricingTiers].sort((a,b) => Number(a?.price || 0) - Number(b?.price || 0));
    if (targetTierName?.toLowerCase().includes('retail')) {
      return sorted[sorted.length - 1] || product.pricingTiers[0];
    } else {
      return sorted[0] || product.pricingTiers[0];
    }
  };

  const getMasterUnits = (product) => {
    if (!product.pricingTiers || !Array.isArray(product.pricingTiers) || product.pricingTiers.length === 0) {
      return [{ name: product.unitType || 'PCS', quantity: 1 }];
    }
    const masterTier = product.pricingTiers.reduce((prev, curr) => ((prev?.units || []).length > (curr?.units || []).length) ? prev : curr, product.pricingTiers[0]);
    return masterTier?.units || [{ name: 'PCS', quantity: 1 }];
  };

  const getUnitPriceForTier = (product, tierName, targetUnitName) => {
    const tier = getTierForProduct(product, tierName);
    
    // 1. Try to find the exact price in the tier's designated units
    const exactUnit = tier.units?.find(u => u.name === targetUnitName);
    if (exactUnit && Number(exactUnit.price) > 0) {
      return Number(exactUnit.price);
    }
    
    // 2. Otherwise, find the physical multiplier for this unit from the MASTER mapping
    const masterUnits = getMasterUnits(product);
    const uIdx = masterUnits.findIndex(u => u.name === targetUnitName);
    
    let multiplier = 1;
    if (uIdx !== -1) {
       for (let j = uIdx + 1; j < masterUnits.length; j++) {
         multiplier *= (Number(masterUnits[j].quantity) || 1);
       }
    }
    
    // 3. Multiply tier base piece price by the multiplier
    // First try the lowest/ref unit of that specific tier
    if (tier.units && tier.units.length > 0) {
      const baseTierUnit = tier.units[tier.units.length - 1];
      if (Number(baseTierUnit.price) > 0) return Number(baseTierUnit.price) * multiplier;
    }
    
    // Fallback explicit tier legacy price
    if (Number(tier.price) > 0) return Number(tier.price) * multiplier;
    
    if (tierName === 'WHOLESALE' && Number(product.wholesalePrice) > 0) return Number(product.wholesalePrice) * multiplier;
    if (tierName === 'SEMI_WHOLESALE' && Number(product.semiWholesalePrice) > 0) return Number(product.semiWholesalePrice) * multiplier;
    
    return Number(product.retailPrice || 0) * multiplier;
  };
  
  const getCostPriceForUnit = (product, targetUnitName) => {
    const masterUnits = getMasterUnits(product);
    const exactUnit = masterUnits.find(u => u.name === targetUnitName);
    if (exactUnit && Number(exactUnit.costPrice) > 0) return Number(exactUnit.costPrice);
    
    const uIdx = masterUnits.findIndex(u => u.name === targetUnitName);
    let multiplier = 1;
    if (uIdx !== -1) {
       for (let j = uIdx + 1; j < masterUnits.length; j++) {
         multiplier *= (Number(masterUnits[j].quantity) || 1);
       }
    }
    
    const basePieceCost = masterUnits[masterUnits.length - 1]?.costPrice;
    if (basePieceCost && Number(basePieceCost) > 0) return Number(basePieceCost) * multiplier;
    
    return (Number(product.purchasePrice) || 0) * multiplier;
  };  const addToCart = (product) => {
    try {
      const existing = cart.find(i => i.productId === product.id);
      if (existing) {
        setCart(cart.map(i =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        ));
      } else {
        const tier = getTierForProduct(product, saleType);
        const masterUnits = getMasterUnits(product);

        // Use tier's defaultSellUnit if set and valid, else fallback to largest unit
        const tierDefault = tier?.defaultSellUnit;
        let unitName;
        if (tierDefault && masterUnits.some(u => u.name === tierDefault)) {
          unitName = tierDefault;
        } else {
          const firstUnit = masterUnits.length > 0 ? masterUnits[0] : null;
          unitName = firstUnit ? firstUnit.name : (product.unitType || 'PCS');
        }
        
        const price = getUnitPriceForTier(product, saleType, unitName);
        const costP = getCostPriceForUnit(product, unitName);

        setCart([...cart, {
          productId: product.id,
          name: product.name,
          barcode: tier?.barcode || product.barcode,
          unitType: unitName,
          unitPrice: price,
          baseCostPrice: costP,
          gstPercent: Number(product.gstPercent) || 0,
          currentStock: Number(product.currentStock) || 0,
          quantity: 1,
          discount: 0,
          saleType,
          productObj: product
        }]);
      }
      setSearchQuery('');
      setSearchResults([]);
      searchRef.current?.focus();
      toast.success(`${product.name} added`, { duration: 1000 });
    } catch (err) {
      toast.error(`Error adding to cart: ${err.message}`);
      console.error(err);
    }
  };
  const handleSaleTypeChange = (newType) => {
    setSaleType(newType);
    setCart(cart.map(i => {
      const p = i.productObj;
      if (!p) return i;
      
      const tier = getTierForProduct(p, newType);
      
      // Preserve the user's previously selected unit mapping, 
      // but recalculate price against the NEW tier.
      const price = getUnitPriceForTier(p, newType, i.unitType);
      const costP = getCostPriceForUnit(p, i.unitType);
      
      return {
        ...i,
        saleType: newType,
        unitPrice: price,
        baseCostPrice: costP,
        barcode: tier.barcode || p.barcode
      };
    }));
  };

  const updateItem = (productId, field, value) => {
    if (field === 'quantity' && value !== '' && !/^\d*\.?\d*$/.test(value)) return;
    setCart(cart.map(i => {
      if (i.productId !== productId) return i;
      
      const p = i.productObj;
      if (!p) return { ...i, [field]: value };
      
      if (field === 'saleType') {
        const tier = getTierForProduct(p, value);
        const price = getUnitPriceForTier(p, value, i.unitType);
        
        return {
          ...i,
          saleType: value,
          unitPrice: price,
          barcode: tier?.barcode || p.barcode
        };
      }

      if (field === 'unitType') {
         const price = getUnitPriceForTier(p, i.saleType, value);
         const costP = getCostPriceForUnit(p, value);
         return { ...i, unitType: value, unitPrice: price, baseCostPrice: costP };
      }

      return { ...i, [field]: value };
    }));
  };

  const removeItem = (productId) => {
    setCart(cart.filter(i => i.productId !== productId));
    if (revealedCost?.productId === productId) setRevealedCost(null);
  };

  const revealItemCost = (productId, cost) => {
    setRevealedCost({ productId, cost });
    setTimeout(() => {
      setRevealedCost(prev => (prev?.productId === productId ? null : prev));
    }, 1000); // hide after 1 second
  };

  // Totals
  const subtotal = cart.reduce((sum, i) => sum + (Number(i.unitPrice) - Number(i.discount)) * Number(i.quantity), 0);
  const totalGst = cart.reduce((sum, i) => sum + ((Number(i.unitPrice) - Number(i.discount)) * Number(i.quantity) * Number(i.gstPercent) / 100), 0);
  const discountAmt = Number(discount) || 0;
  const extraAmt = Number(extraChargeAmt) || 0;
  const grandTotal = subtotal + totalGst - discountAmt + extraAmt;
  const netPayable = grandTotal + (Number(previousDuesAdded) || 0);
  const totalPaid = (Number(payments.CASH) || 0) + (Number(payments.UPI) || 0) + (Number(payments.CARD) || 0);
  const balance = netPayable - totalPaid;

  const handleCompleteSale = async () => {
    if (submitLock.current) return;
    if (cart.length === 0 && !activeTab.isEditMode) { toast.error('Cart is empty'); return; }
    
    // Build payments array
    const paymentsArr = [];
    if (Number(payments.CASH) > 0) paymentsArr.push({ paymentMode: 'CASH', amount: Number(payments.CASH) });
    if (Number(payments.UPI) > 0) paymentsArr.push({ paymentMode: 'UPI', amount: Number(payments.UPI) });
    if (Number(payments.CARD) > 0) paymentsArr.push({ paymentMode: 'CARD', amount: Number(payments.CARD) });

    if (totalPaid > grandTotal && !customer) {
      toast.error('Customer required to save extra amount as advance!');
      return;
    }

    if (balance > 0 && !customer) {
      toast.error('Please select or add a Customer for Credit sales!');
      return;
    }

    submitLock.current = true;
    setCompleting(true);
    try {
      const payload = {
        customerId: customer?.id || null,
        saleType,
        items: cart.map(i => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          unitType: i.unitType,
          saleType: i.saleType || saleType,
          unitPrice: Number(i.unitPrice),
          discount: Number(i.discount) || 0,
        })),
        discount: discountAmt,
        extraChargeName: extraChargeName || undefined,
        extraChargeAmount: extraAmt || 0,
        previousDuesSettled: Number(previousDuesAdded) || 0,
        payments: paymentsArr,
        salesmanId: salesman?.id || null,
        isCredit: balance > 0,
      };

      let res;
      if (activeTab.isEditMode) {
        res = await salesAPI.update(activeTab.editSaleId, payload);
        toast.success(`Sale ${res.data.invoiceNumber || ''} updated!`);
      } else {
        res = await salesAPI.create(payload);
        toast.success(`Sale ${res.data.invoiceNumber || ''} completed!`);
      }

      // Save full snapshot for printing BEFORE clearing cart
      setCompletedSaleData({
        sale: res.data,
        cartItems: [...cart],
        customer,
        salesman,
        subtotal,
        totalGst,
        discountAmt,
        extraChargeName: extraChargeName || 'Extra Charge',
        extraChargeAmt: extraAmt,
        grandTotal,
        previousDuesSettled: Number(previousDuesAdded) || 0,
        netPayable,
        totalPaid,
        balance,
        payments: { ...payments },
        paymentsArr,
        saleType,
      });

      setLastSale(res.data);
      
      if (activeTab.isEditMode) {
         if (tabs.length > 1) {
            removeTab(activeTabId);
         } else {
            setCart([]);
            setDiscount('');
            setExtraChargeName('');
            setExtraChargeAmt('');
            setPreviousDuesAdded('');
            setPayments({ CASH: '', UPI: '', CARD: '' });
            setCustomer(null);
            setSalesman(null);
            updateActiveTab({ isEditMode: false, editSaleId: null });
         }
      } else {
         setCart([]);
         setDiscount('');
         setExtraChargeName('');
         setExtraChargeAmt('');
         setPreviousDuesAdded('');
         setPayments({ CASH: '', UPI: '', CARD: '' });
         setCustomer(null);
         setSalesman(null);
      }
      setSearchQuery('');
      setSearchResults([]);
      
      setShowPrintModal(true);
    } catch (e) {
      // Global error handler
      const msg = e.response?.data?.error || e.message;
      toast.error(msg);
    } finally {
      submitLock.current = false;
      setCompleting(false);
    }
  };

  const handlePrint = () => {
    const d = completedSaleData;
    if (!d) return;
    const { sale, cartItems, customer: cust, salesman: sm, subtotal: sub, totalGst: gst,
      discountAmt: disc, grandTotal: gt, totalPaid: paid, balance: bal, paymentsArr } = d;

    const date = new Date(sale.saleDate || sale.createdAt || Date.now());
    const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const rows = cartItems.map(item => {
      const itemPrice = Number(item.unitPrice) - Number(item.discount);
      const lineTotal = itemPrice * Number(item.quantity);
      const gstAmt = lineTotal * Number(item.gstPercent) / 100;
      const gstStr = Number(item.gstPercent) > 0
        ? `${Number(item.gstPercent)}% (₹${gstAmt.toFixed(2)})`
        : '-';
      return `<tr>
        <td>${item.name}<br/><small style="color:#666">${item.unitType} · ${item.saleType}</small></td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">₹${Number(item.unitPrice).toFixed(2)}</td>
        <td style="text-align:right">${gstStr}</td>
        <td style="text-align:right">₹${lineTotal.toFixed(2)}</td>
      </tr>`;
    }).join('');

    const paymentRows = paymentsArr.map(p =>
      `<tr><td>${p.paymentMode}</td><td style="text-align:right">₹${Number(p.amount).toFixed(2)}</td></tr>`
    ).join('');

    const billContent = `
      <div style="padding:10px;">
        <div class="center bold" style="font-size:18px;margin-bottom:2px;text-transform:uppercase;">ASHA FMCG</div>
        <div class="center bold" style="font-size:14px;margin-bottom:4px;">Ph: 7070474780</div>
        <div class="center" style="margin-bottom:2px;font-size:10px;">Tax Invoice</div>
        <div class="divider"></div>
        <div style="display:flex;justify-content:space-between;font-size:10px;">
          <span><b>Bill#</b> ${sale.invoiceNumber}</span>
          <span>${dateStr} ${timeStr}</span>
        </div>
        ${cust ? `<div style="margin-top:2px;font-size:10px;"><b>Cust:</b> ${cust.name}${cust.mobile ? ' · ' + cust.mobile : ''}</div>` : ''}
        ${sm ? `<div style="font-size:10px;"><b>Rep:</b> ${sm.name}</div>` : ''}
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
          <tr><td>Subtotal</td><td style="text-align:right">₹${sub.toFixed(2)}</td></tr>
          <tr><td>GST</td><td style="text-align:right">₹${gst.toFixed(2)}</td></tr>
          ${disc > 0 ? `<tr><td>Discount</td><td style="text-align:right">-₹${disc.toFixed(2)}</td></tr>` : ''}
          ${completedSaleData.extraChargeAmt > 0 ? `<tr><td>${completedSaleData.extraChargeName}</td><td style="text-align:right">₹${completedSaleData.extraChargeAmt.toFixed(2)}</td></tr>` : ''}
          <tr class="total-row grand"><td style="padding-top:2px;">Grand Total</td><td style="text-align:right;padding-top:2px;">₹${gt.toFixed(2)}</td></tr>
          ${completedSaleData.previousDuesSettled > 0 ? `<tr style="font-weight:bold"><td style="padding-top:4px;">Previous Due Rec.</td><td style="text-align:right;padding-top:4px;">₹${completedSaleData.previousDuesSettled.toFixed(2)}</td></tr>` : ''}
          ${completedSaleData.previousDuesSettled > 0 ? `<tr class="total-row grand"><td style="padding-top:4px;">Net Payable</td><td style="text-align:right;padding-top:4px;">₹${completedSaleData.netPayable.toFixed(2)}</td></tr>` : ''}
        </table>
        <div class="divider"></div>
        <table>${paymentRows}</table>
        ${bal > 0 ? `<div style="color:#000;font-weight:bold;margin-top:2px">Credit Bal: ₹${bal.toFixed(2)}</div>` : ''}
        ${paid >= gt ? `<div style="margin-top:2px;font-weight:bold">Change: ₹${(paid - gt).toFixed(2)}</div>` : ''}
        <div class="divider"></div>
        <div class="center bold" style="margin-top:4px;font-size:10px;">Thank you! Visit again 🙏</div>
        <div class="center bold" style="font-size:10px;margin-top:2px;">Powered by POS Counter</div>
      </div>
    `;

    // ── Pure CSS Media Query Approach (Most reliable for Mobile Web) ──
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
    
    // Small delay ensures DOM paints the container before triggering print dialog
    setTimeout(() => { window.print(); }, 200);
  };

  // ── Build plain-text bill (for WhatsApp / Email sharing) ───────
  const buildBillText = () => {
    const d = completedSaleData;
    if (!d) return '';
    const { sale, cartItems, customer: cust, subtotal: sub, totalGst: gst,
      discountAmt: disc, grandTotal: gt, totalPaid: paid, balance: bal, paymentsArr } = d;

    const date = new Date(sale.saleDate || sale.createdAt || Date.now());
    const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const sep = '-'.repeat(32);
    let text = '';
    text += `*ASHA FMCG*\n`;
    text += `Ph: 7070474780\n`;
    text += `${sep}\n`;
    text += `Bill#: ${sale.invoiceNumber}\n`;
    text += `Date : ${dateStr} ${timeStr}\n`;
    if (cust) text += `Cust : ${cust.name}${cust.mobile ? ' | ' + cust.mobile : ''}\n`;
    text += `${sep}\n`;
    text += `*ITEMS*\n`;
    cartItems.forEach(item => {
      const lineTotal = (Number(item.unitPrice) - Number(item.discount)) * Number(item.quantity);
      text += `${item.name}\n`;
      text += `  ${item.quantity} ${item.unitType} x ₹${Number(item.unitPrice).toFixed(2)} = ₹${lineTotal.toFixed(2)}\n`;
    });
    text += `${sep}\n`;
    text += `Subtotal : ₹${sub.toFixed(2)}\n`;
    if (gst > 0) text += `GST      : ₹${gst.toFixed(2)}\n`;
    if (disc > 0) text += `Discount : -₹${disc.toFixed(2)}\n`;
    if (d.extraChargeAmt > 0) text += `${d.extraChargeName}: ₹${d.extraChargeAmt.toFixed(2)}\n`;
    text += `*Grand Total: ₹${gt.toFixed(2)}*\n`;
    if (d.previousDuesSettled > 0) {
      text += `Prev Due Rec.: ₹${d.previousDuesSettled.toFixed(2)}\n`;
      text += `*Net Payable: ₹${d.netPayable.toFixed(2)}*\n`;
    }
    text += `${sep}\n`;
    paymentsArr.forEach(p => { text += `${p.paymentMode}: ₹${Number(p.amount).toFixed(2)}\n`; });
    if (bal > 0) text += `*Credit Bal: ₹${bal.toFixed(2)}*\n`;
    if (paid >= gt) text += `Change: ₹${(paid - gt).toFixed(2)}\n`;
    text += `${sep}\n`;
    text += `Thank you! Visit again 🙏\nPowered by POS Counter`;
    return text;
  };

  const handleShareWhatsApp = () => {
    const text = buildBillText();
    const cust = completedSaleData?.customer;
    const phone = cust?.mobile ? cust.mobile.replace(/\D/g, '') : '';
    const url = phone
      ? `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleShareEmail = () => {
    const text = buildBillText();
    const subject = encodeURIComponent(`Bill ${completedSaleData?.sale?.invoiceNumber || ''} - ASHA FMCG`);
    const body = encodeURIComponent(text);
    const email = completedSaleData?.customer?.email || '';
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-6.5rem)] overflow-hidden">
      {/* Tabs teleported to Header */}
      {portalTarget && createPortal(
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full h-full pt-1 px-2">
          {tabs.map((tab, idx) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-xl border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTabId === tab.id
                  ? 'border-blue-600 bg-slate-50 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-1.5 pointer-events-none">
                <User size={14} />
                {tab.customer ? tab.customer.name : `Customer ${idx + 1}`}
                {tab.cart.length > 0 && (
                  <span className="ml-1 bg-blue-100 text-blue-700 py-0.5 px-1.5 rounded-full text-[10px]">
                    {tab.cart.length}
                  </span>
                )}
              </span>
              {tabs.length > 1 && (
                <X
                  size={14}
                  className="ml-1 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 p-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTab(tab.id);
                  }}
                />
              )}
            </button>
          ))}
          <button
            onClick={addTab}
            className="flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-emerald-600 hover:bg-emerald-50 font-medium text-sm transition-colors whitespace-nowrap"
          >
            <Plus size={14} /> New Bill
          </button>
        </div>,
        portalTarget
      )}

      <div className="flex gap-5 flex-1 min-h-0">
        {/* Left: Product Search + Cart */}
        <div className="flex-1 flex flex-col min-w-0 gap-4">
          {/* Search Bar */}
        <div className="card p-3">
          <div className="flex gap-3 items-center">
            {/* Sale Type Selector */}
            <div className="flex bg-slate-100 rounded-lg p-1 min-w-40 border border-slate-200">
              <select
                value={saleType}
                onChange={(e) => handleSaleTypeChange(e.target.value)}
                className="w-full bg-transparent text-sm font-semibold text-blue-700 outline-none px-2 cursor-pointer"
              >
                {availableTiers.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Product Search */}
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => setTimeout(() => setSearchResults([]), 200)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim() && searchResults.length === 0) {
                    // treat typed text as barcode if no dropdown results
                    handleBarcodeSearch(searchQuery);
                    setSearchQuery('');
                    setSearchResults([]);
                  }
                }}
                placeholder="Search product by name or scan barcode..."
                className="input pl-9 pr-4"
              />
              {searching && (
                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
              )}

              {/* Dropdown Results */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto">
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      onMouseDown={(e) => { e.preventDefault(); addToCart(p); }}
                      className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-blue-50 text-left transition-colors"
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-800">{p.name}</div>
                        <div className="text-xs text-slate-400">{p.barcode || 'No barcode'} · Stock: {Number(p.currentStock)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-800">₹{Number(getTierForProduct(p, saleType).price || 0).toLocaleString('en-IN')}</div>
                        {p.gstPercent > 0 && <div className="text-xs text-slate-400">+{p.gstPercent}% GST</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={toggleScanMode}
              className={`gap-2 transition-all ${scanMode ? 'btn-primary' : 'btn-secondary'}`}
              title={scanMode ? 'Click to exit scan mode' : 'Click to activate barcode scanner'}
            >
              <Scan size={15} />
              <span className="hidden sm:block">{scanMode ? 'Scanning...' : 'Scan'}</span>
            </button>
          </div>

          {/* Barcode Scan Input — shows when scan mode is ON */}
          {scanMode && (
            <div className="mt-2 flex gap-2 items-center">
              <div className="relative flex-1">
                <Scan size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                <input
                  ref={barcodeInputRef}
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleBarcodeSearch(barcodeInput);
                    }
                  }}
                  placeholder="Scan or type barcode and press Enter..."
                  className="input pl-9 pr-4 border-2 border-emerald-400 focus:border-emerald-500 bg-emerald-50 placeholder:text-emerald-400 text-emerald-800"
                  autoComplete="off"
                />
                {scanning && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 animate-spin" />
                )}
              </div>
              <button
                onClick={toggleScanMode}
                className="btn-secondary gap-1 text-xs"
              >
                <X size={13} /> Close
              </button>
            </div>
          )}
        </div>

        {/* Cart Table */}
        <div className="card flex-1 overflow-hidden flex flex-col">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <ShoppingCart size={15} className="text-slate-500" />
              <h3 className="font-semibold text-sm text-slate-700">Cart</h3>
              {cart.length > 0 && (
                <span className="badge-blue">{cart.length} items</span>
              )}
            </div>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-700">
                Clear all
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                <ShoppingCart size={40} strokeWidth={1} />
                <p className="text-sm">Search a product or scan barcode to add items</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-center">Qty</th>
                    <th className="text-center">Price</th>
                    <th className="text-center">Disc</th>
                    <th className="text-right">Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => {
                    const lineTotal = (Number(item.unitPrice) - Number(item.discount)) * Number(item.quantity);
                    return (
                      <tr key={item.productId}>
                        <td>
                          <div className="font-medium text-slate-800 text-sm flex items-center gap-1.5 flex-wrap">
                            {item.name}
                            <div className="flex items-center gap-1 ml-1">
                              {revealedCost?.productId === item.productId ? (
                                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm border border-amber-200 ml-1 whitespace-nowrap">
                                  Cost: ₹{Number(item.baseCostPrice || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <button
                                  onClick={() => revealItemCost(item.productId, item.baseCostPrice)}
                                  className="text-slate-300 hover:text-blue-500 transition-colors p-0.5"
                                  title="View Cost Price"
                                >
                                  <Eye size={13} strokeWidth={2.5} />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <select
                              value={item.saleType}
                              onChange={(e) => updateItem(item.productId, 'saleType', e.target.value)}
                              className="text-xs bg-slate-100 border border-slate-200 rounded px-1 py-0.5 text-blue-700 font-medium outline-none cursor-pointer"
                            >
                              {availableTiers.map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                            {item.productObj?.pricingTiers?.length > 0 ? (
                              <select
                                value={item.unitType}
                                onChange={(e) => updateItem(item.productId, 'unitType', e.target.value)}
                                className="text-xs bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-slate-600 outline-none cursor-pointer"
                              >
                                {getMasterUnits(item.productObj).map((u, idx) => (
                                  <option key={idx} value={u.name}>{u.name}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-slate-400">{item.unitType}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-1 justify-center">
                            <button
                              onClick={() => Number(item.quantity) > 1
                                ? updateItem(item.productId, 'quantity', String(Number(item.quantity) - 1))
                                : removeItem(item.productId)
                              }
                              className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-100"
                            >
                              <Minus size={11} />
                            </button>
                            <input
                              type="text"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.productId, 'quantity', e.target.value)}
                              className="w-14 text-center input py-1 text-xs"
                            />
                            <button
                              onClick={() => updateItem(item.productId, 'quantity', String(Number(item.quantity) + 1))}
                              className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-100"
                            >
                              <Plus size={11} />
                            </button>
                          </div>
                        </td>
                        <td>
                          <input
                            type="text"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(item.productId, 'unitPrice', e.target.value)}
                            className="w-24 input py-1 text-xs text-center"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={item.discount}
                            onChange={(e) => updateItem(item.productId, 'discount', e.target.value)}
                            className="w-20 input py-1 text-xs text-center"
                            placeholder="0"
                          />
                        </td>
                        <td className="text-right font-semibold">
                          ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td>
                          <button onClick={() => removeItem(item.productId)}
                            className="text-slate-300 hover:text-red-500 transition-colors">
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
        </div>
      </div>

      {/* Right: Billing Panel */}
      <div className="w-[300px] xl:w-80 flex-shrink-0 flex flex-col gap-3 h-full pb-1">
        {/* Salesman Selector */}
        {salesmenList.length > 0 && (
          <div className="card p-4">
            <div className="relative">
              <UserCheck size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={salesman?.id || ''}
                onChange={e => setSalesman(salesmenList.find(s => s.id === e.target.value) || null)}
                className="input pl-8 text-sm"
              >
                <option value="">No Salesman</option>
                {salesmenList.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                ))}
              </select>
            </div>
            {salesman && (
              <div className="mt-2 bg-purple-50 rounded-lg p-2 text-xs text-purple-700 flex items-center gap-2">
                <UserCheck size={12} />
                <span className="font-semibold">{salesman.name}</span>
                <span className="badge-yellow ml-1">{salesman.type}</span>
              </div>
            )}
          </div>
        )}

        {/* Customer */}
        <div className="card p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-slate-700">Customer</span>
            <button
              onClick={() => setShowAddCustomerModal(true)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <Plus size={12} /> Add New
            </button>
          </div>
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={customer ? customer.name : customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                if (customer) setCustomer(null);
              }}
              placeholder="Search customer (optional)"
              className="input pl-8 text-sm"
            />
            {customer && (
              <button onClick={() => { setCustomer(null); setCustomerSearch(''); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>

          {customerResults.length > 0 && !customer && (
            <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden">
              {customerResults.slice(0, 4).map((c) => (
                <button key={c.id} onClick={() => { setCustomer(c); setCustomerSearch(''); setCustomerResults([]); }}
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-blue-50 text-left">
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-slate-400">{c.mobile}</span>
                </button>
              ))}
            </div>
          )}

          {customer && (
            <div className="mt-2 bg-blue-50 rounded-lg p-2.5 text-xs">
              <div className="font-semibold text-blue-700">{customer.name}</div>
              <div className="text-blue-500">{customer.mobile}</div>
              {Number(customer.currentBalance) > 0 && (
                <div className="text-amber-600 mt-1">Outstanding: ₹{Number(customer.currentBalance).toLocaleString('en-IN')}</div>
              )}
            </div>
          )}
        </div>

        {/* Bill Summary */}
        <div className="card p-3 flex-1 flex flex-col min-h-0">
          <h3 className="font-semibold text-sm text-slate-700 mb-2">Bill Summary</h3>

          <div className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>GST</span>
              <span>₹{totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600">Discount</span>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
                className="w-24 input py-1 text-xs text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <select 
                value={extraChargeName}
                onChange={e => setExtraChargeName(e.target.value)}
                className="bg-transparent border-none outline-none text-sm -ml-1 py-1 pr-2 text-slate-600 cursor-pointer"
              >
                <option value="">Extra Charge</option>
                <option value="Delivery Charge">Delivery Charge</option>
                <option value="Packing Charge">Packing Charge</option>
                <option value="Other Charge">Other Charge</option>
              </select>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400">+</span>
                <input
                  type="number"
                  value={extraChargeAmt}
                  onChange={(e) => setExtraChargeAmt(e.target.value)}
                  placeholder="0"
                  className="w-24 input py-1 text-xs text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-1.5 mt-1.5 flex justify-between font-bold text-base">
              <span>Grand Total</span>
              <span className="text-blue-600">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            {customer && Number(customer.currentBalance) > 0 && (
              <div className="flex flex-col gap-1 pt-1.5 border-t border-slate-200 mt-1.5">
                <div className="flex items-center justify-between text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Previous Dues</span>
                    <button 
                      onClick={() => setPreviousDuesAdded(customer.currentBalance)}
                      className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.2 rounded font-medium hover:bg-amber-200"
                    >
                      Exact (₹{Number(customer.currentBalance).toFixed(2)})
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-400">+</span>
                    <input
                      type="number"
                      value={previousDuesAdded}
                      onChange={(e) => setPreviousDuesAdded(e.target.value)}
                      placeholder="0"
                      className="w-24 input py-1 text-xs text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
              </div>
            )}
            {(Number(previousDuesAdded) > 0) && (
              <div className="pt-1.5 flex justify-between font-bold text-base">
                <span>Net Payable</span>
                <span className="text-emerald-600">₹{netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            )}

            {/* Split Payment System */}
            <div className="mt-2 pt-2 border-t border-slate-200">
              <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center justify-between">
                <span>Payment Details</span>
                <button 
                  onClick={() => setPayments({ CASH: netPayable > 0 ? netPayable : grandTotal, UPI: '', CARD: '' })}
                  className="text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded transition-colors"
                  disabled={cart.length === 0}
                >
                  Exact Cash
                </button>
              </div>
              
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Cash ₹</span>
                  <input
                    type="number" min="0" step="0.01"
                    value={payments.CASH}
                    onChange={(e) => setPayments(prev => ({ ...prev, CASH: e.target.value }))}
                    placeholder="0"
                    className="w-24 input py-1 text-sm text-right font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">UPI ₹</span>
                  <input
                    type="number" min="0" step="0.01"
                    value={payments.UPI}
                    onChange={(e) => setPayments(prev => ({ ...prev, UPI: e.target.value }))}
                    placeholder="0"
                    className="w-24 input py-1 text-sm text-right font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Card ₹</span>
                  <input
                    type="number" min="0" step="0.01"
                    value={payments.CARD}
                    onChange={(e) => setPayments(prev => ({ ...prev, CARD: e.target.value }))}
                    placeholder="0"
                    className="w-24 input py-1 text-sm text-right font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Total Received:</span>
                  <span className="font-semibold text-slate-800">
                    ₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {balance > 0 && (
                  <div className="flex items-center justify-between text-xs text-amber-600 font-medium pt-1.5 border-t border-slate-200 mt-1">
                    <span>Balance Due:</span>
                    <span>₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Complete Sale Button */}
          <button
            onClick={handleCompleteSale}
            disabled={(cart.length === 0 && !activeTab.isEditMode) || completing}
            className={`btn-primary w-full py-2.5 mt-3 justify-center rounded-xl shadow-md flex-shrink-0 ${activeTab.isEditMode ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
          >
            {completing ? (
              <><Loader2 size={16} className="animate-spin" /> Processing...</>
            ) : (
              <><Check size={16} /> {activeTab.isEditMode ? 'Update Sale' : 'Complete Sale'}</>
            )}
          </button>
        </div>

        {lastSale && (
          <div className="card p-3 bg-emerald-50 border-emerald-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-emerald-700">{lastSale.invoiceNumber}</div>
                <div className="text-xs text-emerald-600">₹{Number(lastSale.grandTotal).toLocaleString('en-IN')} · {lastSale.saleType}</div>
              </div>
              <button onClick={handlePrint} className="btn-secondary btn-sm gap-1">
                <Printer size={12} /> Reprint
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Print + Share Confirmation Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[340px] flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check size={28} className="text-emerald-600" />
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-slate-800">Sale Complete!</div>
              <div className="text-sm text-slate-500 mt-1">
                {completedSaleData?.sale?.invoiceNumber} &middot; ₹{Number(completedSaleData?.sale?.grandTotal).toLocaleString('en-IN')}
              </div>
            </div>

            {/* Print row */}
            <div className="w-full">
              <p className="text-xs text-slate-400 text-center mb-2">Do you want to print the bill?</p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => { handlePrint(); setShowPrintModal(false); }}
                  className="btn-primary flex-1 justify-center gap-2 rounded-xl"
                >
                  <Printer size={16} /> Print
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="btn-secondary flex-1 justify-center rounded-xl"
                >
                  Skip
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="w-full flex items-center gap-2">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-xs text-slate-400">or</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            {/* Share row */}
            <div className="w-full">
              <p className="text-xs text-slate-400 text-center mb-2">Do you want to share the bill?</p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => { handleShareWhatsApp(); }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-[#25D366] hover:bg-[#20c05c] text-white transition-colors"
                >
                  <MessageCircle size={17} /> WhatsApp
                </button>
                <button
                  onClick={() => { handleShareEmail(); }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  <Mail size={17} /> Email
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowPrintModal(false)}
              className="text-xs text-slate-400 hover:text-slate-600 mt-1"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800">Add New Customer</h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddCustomer} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Customer Name <span className="text-red-500">*</span></label>
                <input
                  type="text" required
                  value={newCustomer.name}
                  onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="input w-full"
                  placeholder="Enter name"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mobile Number <span className="text-red-500">*</span></label>
                <input
                  type="text" required
                  value={newCustomer.mobile}
                  onChange={e => setNewCustomer({ ...newCustomer, mobile: e.target.value })}
                  className="input w-full"
                  placeholder="Enter 10-digit mobile"
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowAddCustomerModal(false)} className="btn-secondary flex-1 justify-center">
                  Cancel
                </button>
                <button type="submit" disabled={addingCustomer} className="btn-primary flex-1 justify-center">
                  {addingCustomer ? <Loader2 size={16} className="animate-spin" /> : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
