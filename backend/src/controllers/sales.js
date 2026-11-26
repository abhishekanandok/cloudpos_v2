import prisma from '../config/prisma.js';
import { getBaseMultiplier, findPricingTier, normalizeString } from '../utils/stockUtils.js';

// Normalize unit type: trim whitespace, preserve original case (frontend may send 'box', 'BOX', 'Packet ')
const normalizeUnit = (s) => (s || '').toString().trim();

// ── Create Sale ───────────────────────────────────────────
export const createSale = async (req, res, next) => {
  try {
    const {
      customerId, branchId, saleType, items,
      discount, extraChargeName, extraChargeAmount,
      previousDuesSettled,
      paymentMode, paidAmount, payments, notes,
      isCredit, driverId, isVehicleSale,
      salesmanId, staffId
    } = req.body;

    const shopId = req.shopId;

    // Generate invoice number
    const lastSale = await prisma.sale.findFirst({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true }
    });

    const settings = await prisma.shopSettings.findUnique({ where: { shopId } });
    const prefix = settings?.invoicePrefix || 'INV';
    const lastNum = lastSale?.invoiceNumber
      ? parseInt(lastSale.invoiceNumber.replace(/\D/g, '')) || 0
      : 0;
    const invoiceNumber = `${prefix}-${String(lastNum + 1).padStart(5, '0')}`;

    // Fetch products and validate stock
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, shopId }
    });

    const productMap = {};
    products.forEach(p => { productMap[p.id] = p; });

    // Calculate totals
    let subtotal = 0;
    let totalGst = 0;

    const processedItems = items.map(item => {
      const product = productMap[item.productId];
      if (!product) throw Object.assign(new Error(`Product not found: ${item.productId}`), { statusCode: 404 });

      const type = item.saleType || saleType || product.defaultSaleType;

      const qty = Number(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        throw Object.assign(new Error(`Quantity must be greater than zero for product: ${product.name}`), { statusCode: 400 });
      }

      const baseMultiplier = getBaseMultiplier(product.pricingTiers, normalizeUnit(item.unitType) || product.unitType, type);

      const totalDeductionQty = qty * baseMultiplier;

      // Check stock — skip for vehicle sales (vehicle stock checked in transaction below)
      if (!isVehicleSale && Number(product.currentStock) < totalDeductionQty) {
        throw Object.assign(
          new Error(`Insufficient stock for ${product.name} (Unit: ${type}). Required base pieces: ${totalDeductionQty}, Available: ${product.currentStock}`),
          { statusCode: 400 }
        );
      }

      // Determine unit price based on sale type
      let unitPrice;
      if (type === 'WHOLESALE') unitPrice = Number(product.wholesalePrice);
      else if (type === 'SEMI_WHOLESALE') unitPrice = Number(product.semiWholesalePrice);
      else unitPrice = Number(product.retailPrice);

      // Check tier price if available (for custom tiers)
      if (Array.isArray(product.pricingTiers)) {
        const tier = findPricingTier(product.pricingTiers, type);
        if (tier) {
           const targetUnitType = normalizeUnit(item.unitType) || product.unitType || (tier.units && tier.units.length > 0 ? tier.units[0].name : null);
           const targetUnit = tier.units && tier.units.find(u => normalizeString(u.name) === normalizeString(targetUnitType));
           
           if (targetUnit && !isNaN(Number(targetUnit.price)) && Number(targetUnit.price) > 0) {
             unitPrice = Number(targetUnit.price); // Read calculated unit price directly
           } else if (!isNaN(Number(tier.price)) && Number(tier.price) > 0) {
             unitPrice = Number(tier.price); // Fallback to raw tier price
           }
        }
      }

      // Override with manual price if provided
      if (item.unitPrice !== undefined) unitPrice = item.unitPrice;

      const itemDiscount = item.discount || 0;
      const baseAmount = (unitPrice - itemDiscount) * item.quantity;
      const gstAmount = settings?.gstEnabled
        ? (baseAmount * Number(product.gstPercent)) / 100
        : 0;
      const totalAmount = baseAmount + gstAmount;

      subtotal += baseAmount;
      totalGst += gstAmount;

      return {
        productId: item.productId,
        quantity: item.quantity,
        totalDeductionQty,
        unitType: normalizeUnit(item.unitType) || product.unitType,
        saleType: type,
        unitPrice,
        discount: itemDiscount,
        gstPercent: product.gstPercent,
        gstAmount,
        totalAmount,
      };
    });

    const totalDiscount = discount || 0;
    const extraChargesAmt = Number(extraChargeAmount) || 0;
    const grandTotal = subtotal + totalGst - totalDiscount + extraChargesAmt;
    
    let paid = 0;
    if (Array.isArray(payments) && payments.length > 0) {
      paid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    } else {
      paid = isCredit ? (Number(paidAmount) || 0) : grandTotal;
    }
    
    const prevDuesAmt = Number(previousDuesSettled) || 0;
    // paid includes: payment for current bill + dues recovery
    // salePayments = portion of paid going towards current bill
    const salePayments = Math.max(paid - prevDuesAmt, 0);
    const balance = grandTotal - salePayments;

    // Create sale in transaction
    const sale = await prisma.$transaction(async (tx) => {
      // Create sale record
      const newSale = await tx.sale.create({
        data: {
          shopId,
          branchId: branchId || null,
          customerId: customerId || null,
          staffId: staffId || req.staffId || null,
          salesmanId: salesmanId || null,
          driverId: driverId || req.driverId || null,
          invoiceNumber,
          saleType: saleType || 'RETAIL',
          subtotal,
          totalGst,
          totalDiscount,
          grandTotal,
          paidAmount: paid,
          balanceAmount: balance,
          isCredit: Boolean(isCredit) && balance > 0,
          paymentMode: (isCredit && balance > 0) ? 'CREDIT' : (paymentMode || 'CASH'),
          notes,
          extraChargeName: extraChargeName || null,
          extraChargeAmount: extraChargesAmt,
          previousDuesSettled: prevDuesAmt,
          items: { create: processedItems.map(({ totalDeductionQty, ...rest }) => rest) },
          payments: (Array.isArray(payments) && payments.length > 0) ? {
            create: payments.filter(p => Number(p.amount) > 0).map(p => ({
              amount: Number(p.amount),
              paymentMode: p.paymentMode
            }))
          } : (paid > 0 ? {
            create: {
              amount: paid,
              paymentMode: paymentMode || 'CASH',
            }
          } : undefined),
        },
        include: {
          items: { include: { product: { select: { name: true, barcode: true } } } },
          customer: { select: { name: true, mobile: true } },
        }
      });

      // Deduct stock - from vehicle if vehicle sale, else from shop
      for (const item of processedItems) {
        if (isVehicleSale && driverId) {
          const vs = await tx.vehicleStock.findUnique({
            where: { driverId_productId: { driverId, productId: item.productId } }
          });
          if (!vs || Number(vs.quantity) < item.totalDeductionQty) {
            throw Object.assign(new Error(`Insufficient vehicle stock`), { statusCode: 400 });
          }
          await tx.vehicleStock.update({
            where: { driverId_productId: { driverId, productId: item.productId } },
            data: { quantity: { decrement: item.totalDeductionQty } }
          });
          // Log driver sale
          await tx.driverLog.create({
            data: { shopId, driverId, action: 'SALE', details: `Bill created`, amount: grandTotal }
          });
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { decrement: item.totalDeductionQty } }
          });
        }
      }

      // Update customer ledger
      if (customerId) {
        const customerRec = await tx.customer.findUnique({ where: { id: customerId } });
        let runningBalance = Number(customerRec.currentBalance);

        // 1. Current bill creates a DEBIT on customer ledger (sale happened)
        //    Then if they paid it (fully or partially), track how much unpaid remains
        if (balance > 0) {
          // Customer bought on credit — they owe the remaining balance
          runningBalance += balance;
          await tx.customerLedger.create({
            data: {
              customerId,
              type: 'DEBIT',
              amount: grandTotal,
              balance: runningBalance,
              description: `Sale Credit - ${invoiceNumber}`,
              referenceId: newSale.id,
              refType: 'SALE',
            }
          });
        }
        // If balance <= 0 (fully paid), nothing adds to the running due from the current bill

        // 2. Handle previous dues settlement (reduce existing balance)
        if (prevDuesAmt > 0) {
          runningBalance -= prevDuesAmt;
          await tx.customerLedger.create({
            data: {
              customerId,
              type: 'CREDIT',
              amount: prevDuesAmt,
              balance: runningBalance,
              description: `Dues Settlement - ${invoiceNumber}`,
              referenceId: newSale.id,
              refType: 'SALE',
            }
          });
        }

        await tx.customer.update({
          where: { id: customerId },
          data: { currentBalance: runningBalance },
        });
      }

      return newSale;
    });

    res.status(201).json(sale);
  } catch (err) {
    next(err);
  }
};

// ── Update Sale ───────────────────────────────────────────
export const updateSale = async (req, res, next) => {
  try {
    const saleId = req.params.id;
    const {
      customerId, saleType, items = [],
      discount, extraChargeName, extraChargeAmount,
      previousDuesSettled,
      paymentMode, paidAmount, payments, notes,
      isCredit, driverId, isVehicleSale,
      salesmanId, staffId
    } = req.body;

    const shopId = req.shopId;
    const settings = await prisma.shopSettings.findUnique({ where: { shopId } });

    // Fetch existing sale to reverse its effects
    const oldSale = await prisma.sale.findUnique({
      where: { id: saleId, shopId },
      include: { items: true, payments: true }
    });

    if (!oldSale) return res.status(404).json({ error: 'Sale not found' });

    // Gather ALL productIds (old + new) so we can fetch pricingTiers
    const newProductIds = items.map(i => i.productId);
    const oldProductIds = oldSale.items.map(i => i.productId);
    const allProductIds = [...new Set([...newProductIds, ...oldProductIds])];

    const products = await prisma.product.findMany({
      where: { id: { in: allProductIds }, shopId }
    });
    const productMap = {};
    products.forEach(p => { productMap[p.id] = p; });

    // ── Calculate new items totals ──────────────────────────
    let subtotal = 0;
    let totalGst = 0;

    const processedItems = items.map(item => {
      const product = productMap[item.productId];
      if (!product) throw Object.assign(new Error(`Product not found: ${item.productId}`), { statusCode: 404 });

      const type = item.saleType || saleType || String(product.defaultSaleType);
      const qty = Number(item.quantity);
      if (isNaN(qty) || qty <= 0) throw Object.assign(new Error(`Quantity > 0 required for ${product.name}`), { statusCode: 400 });

      const unitTypeCleaned = normalizeUnit(item.unitType) || product.unitType;
      const pricingTiersArr = Array.isArray(product.pricingTiers) ? product.pricingTiers : [];
      const baseMultiplier = getBaseMultiplier(pricingTiersArr, unitTypeCleaned, type);
      const totalDeductionQty = qty * baseMultiplier;

      const unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : Number(product.retailPrice);
      const itemDiscount = Number(item.discount) || 0;
      const baseAmount = (unitPrice - itemDiscount) * qty;
      const gstAmount = settings?.gstEnabled ? (baseAmount * Number(product.gstPercent)) / 100 : 0;
      const totalAmount = baseAmount + gstAmount;

      subtotal += baseAmount;
      totalGst += gstAmount;

      return {
        productId: item.productId,
        quantity: qty,
        totalDeductionQty,
        unitType: normalizeUnit(item.unitType) || product.unitType,
        saleType: type,
        unitPrice,
        discount: itemDiscount,
        gstPercent: product.gstPercent,
        gstAmount,
        totalAmount,
      };
    });

    const totalDiscount = Number(discount) || 0;
    const extraChargesAmt = Number(extraChargeAmount) || 0;
    const grandTotal = Math.max(0, subtotal + totalGst - totalDiscount + extraChargesAmt);

    // ── Payment calculation ──────────────────────────────────
    let paid = 0;
    if (Array.isArray(payments) && payments.length > 0) {
      paid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    } else if (grandTotal === 0) {
      paid = 0; // Full return - nothing paid
    } else {
      paid = isCredit ? (Number(paidAmount) || 0) : grandTotal;
    }
    const balance = Math.max(0, grandTotal - paid);

    // ── Stock validation (stock check BEFORE transaction) ───
    // Calculate net stock changes: negative=return to stock, positive=deduct from stock
    const netStockChange = {};

    // Old items return stock (subtract from netStockChange)
    for (const oldItem of oldSale.items) {
      const product = productMap[oldItem.productId];
      if (!product) continue;
      const pricingTiersArr = Array.isArray(product.pricingTiers) ? product.pricingTiers : [];
      const oldUnitType = normalizeUnit(oldItem.unitType) || product.unitType;
      const mult = getBaseMultiplier(pricingTiersArr, oldUnitType, String(oldItem.saleType));
      const returnQty = Number(oldItem.quantity) * mult;
      netStockChange[oldItem.productId] = (netStockChange[oldItem.productId] || 0) - returnQty;
    }

    // New items deduct stock (add to netStockChange)
    for (const newItem of processedItems) {
      netStockChange[newItem.productId] = (netStockChange[newItem.productId] || 0) + newItem.totalDeductionQty;
    }

    // Validate only where net change is POSITIVE (net new deduction)
    for (const [pid, netQty] of Object.entries(netStockChange)) {
      if (netQty > 0) {
        const product = productMap[pid];
        const actualDriverId = oldSale.driverId || driverId;
        if (oldSale.driverId || isVehicleSale) {
          const vs = await prisma.vehicleStock.findUnique({
            where: { driverId_productId: { driverId: actualDriverId, productId: pid } }
          });
          if (!vs || Number(vs.quantity) < netQty) {
            throw Object.assign(new Error(`Insufficient vehicle stock for ${product?.name}`), { statusCode: 400 });
          }
        } else {
          if (Number(product.currentStock) < netQty) {
            throw Object.assign(new Error(`Insufficient stock for ${product?.name} (Need: ${netQty}, Have: ${product.currentStock})`), { statusCode: 400 });
          }
        }
      }
    }

    // ── Execute in a single atomic transaction ───────────────
    const updatedSale = await prisma.$transaction(async (tx) => {

      // STEP 1: Return old stock
      for (const oldItem of oldSale.items) {
        const product = productMap[oldItem.productId];
        if (!product) continue;
        const pricingTiersArr = Array.isArray(product.pricingTiers) ? product.pricingTiers : [];
        const oldUnitType = normalizeUnit(oldItem.unitType) || product.unitType;
        const mult = getBaseMultiplier(pricingTiersArr, oldUnitType, String(oldItem.saleType));
        const returnQty = Number(oldItem.quantity) * mult;

        if (oldSale.driverId) {
          await tx.vehicleStock.updateMany({
            where: { driverId: oldSale.driverId, productId: oldItem.productId },
            data: { quantity: { increment: returnQty } }
          });
        } else {
          await tx.product.update({
            where: { id: oldItem.productId },
            data: { currentStock: { increment: returnQty } }
          });
        }
      }

      // STEP 2: Reverse customer credit/advance balance if old sale had balance
      if (oldSale.customerId && Number(oldSale.balanceAmount) !== 0) {
        await tx.customer.update({
          where: { id: oldSale.customerId },
          data: { currentBalance: { decrement: Number(oldSale.balanceAmount) } }
        });
        await tx.customerLedger.deleteMany({
          where: { customerId: oldSale.customerId, referenceId: oldSale.id, refType: 'SALE' }
        });
      }

      // STEP 3: Delete old items & payments
      await tx.saleItem.deleteMany({ where: { saleId: oldSale.id } });
      await tx.salePayment.deleteMany({ where: { saleId: oldSale.id } });

      // STEP 4: Deduct new stock
      for (const item of processedItems) {
        const actualDriverId = oldSale.driverId || driverId;
        if (oldSale.driverId || isVehicleSale) {
          await tx.vehicleStock.updateMany({
            where: { driverId: actualDriverId, productId: item.productId },
            data: { quantity: { decrement: item.totalDeductionQty } }
          });
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { decrement: item.totalDeductionQty } }
          });
        }
      }

      // STEP 5: Determine payment mode
      let finalPaymentMode = paymentMode || 'CASH';
      if (isCredit || balance > 0) finalPaymentMode = 'CREDIT';
      if (grandTotal === 0) finalPaymentMode = 'CASH'; // Full return

      // Build payments to create
      let paymentsToCreate = undefined;
      if (Array.isArray(payments) && payments.length > 0) {
        const filtered = payments.filter(p => Number(p.amount) > 0);
        if (filtered.length > 0) paymentsToCreate = { create: filtered.map(p => ({ amount: Number(p.amount), paymentMode: p.paymentMode })) };
      } else if (paid > 0) {
        paymentsToCreate = { create: { amount: paid, paymentMode: paymentMode || 'CASH' } };
      }

      // STEP 6: Update the sale record
      const updated = await tx.sale.update({
        where: { id: oldSale.id },
        data: {
          customerId: customerId || null,
          staffId: staffId || req.staffId || null,
          salesmanId: salesmanId || null,
          saleType: saleType || oldSale.saleType || 'RETAIL',
          subtotal,
          totalGst,
          totalDiscount,
          grandTotal,
          paidAmount: paid,
          balanceAmount: balance,
          isCredit: balance !== 0,
          paymentMode: finalPaymentMode,
          notes: notes !== undefined ? notes : oldSale.notes,
          extraChargeName: extraChargeName !== undefined ? extraChargeName : oldSale.extraChargeName,
          extraChargeAmount: extraChargeAmount !== undefined ? extraChargesAmt : oldSale.extraChargeAmount,
          previousDuesSettled: previousDuesSettled !== undefined ? (Number(previousDuesSettled) || 0) : oldSale.previousDuesSettled,
          items: processedItems.length > 0
            ? { create: processedItems.map(({ totalDeductionQty, ...rest }) => rest) }
            : undefined,
          payments: paymentsToCreate,
        },
        include: {
          items: { include: { product: { select: { name: true, barcode: true, pricingTiers: true } } } },
          customer: { select: { name: true, mobile: true } },
          payments: true,
        }
      });

      // STEP 7: Apply new customer credit/advance ledger if needed
      if (customerId && balance !== 0) {
        const customer = await tx.customer.findUnique({ where: { id: customerId } });
        const newBalance = Number(customer.currentBalance) + balance;
        await tx.customer.update({ where: { id: customerId }, data: { currentBalance: newBalance } });
        await tx.customerLedger.create({
          data: {
            customerId,
            type: balance > 0 ? 'DEBIT' : 'CREDIT',
            amount: balance > 0 ? grandTotal : Math.abs(balance),
            balance: newBalance,
            description: balance > 0 ? `Sale Edit - ${updated.invoiceNumber}` : `Advance/Overpayment - ${updated.invoiceNumber}`,
            referenceId: updated.id,
            refType: 'SALE',
          }
        });
      }

      return updated;
    });

    res.status(200).json(updatedSale);
  } catch (err) {
    next(err);
  }
};



export const getSales = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 20, startDate, endDate,
      customerId, paymentMode, saleType, search
    } = req.query;

    const where = { shopId: req.shopId };

    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = new Date(startDate);
      if (endDate) where.saleDate.lte = new Date(endDate);
    }

    if (customerId) where.customerId = customerId;
    if (paymentMode) where.paymentMode = paymentMode;
    if (saleType) where.saleType = saleType;
    if (req.query.driverId) where.driverId = req.query.driverId;
    if (req.query.salesmanId) where.salesmanId = req.query.salesmanId;
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [sales, total] = await prisma.$transaction([
      prisma.sale.findMany({
        where,
        include: {
          customer: { select: { name: true, mobile: true } },
          items: {
            include: {
              product: { select: { name: true, barcode: true } }
            }
          }
        },
        orderBy: { saleDate: 'desc' },
        skip: (page - 1) * limit,
        take: Number(limit),
      }),
      prisma.sale.count({ where })
    ]);

    res.json({
      sales,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    next(err);
  }
};

// ── Get Sale Detail ───────────────────────────────────────
export const getSaleById = async (req, res, next) => {
  try {
    const sale = await prisma.sale.findFirst({
      where: { id: req.params.id, shopId: req.shopId },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                barcode: true,
                unitType: true,
                pricingTiers: true,
                retailPrice: true,
                wholesalePrice: true,
                semiWholesalePrice: true,
                gstPercent: true,
                currentStock: true,
                defaultSaleType: true,
              }
            }
          }
        },
        customer: true,
        payments: true,
        branch: { select: { name: true } }
      }
    });

    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    res.json(sale);
  } catch (err) {
    next(err);
  }
};

// ── Daily Summary ─────────────────────────────────────────
export const getDailySummary = async (req, res, next) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(targetDate.setHours(0, 0, 0, 0));
    const end = new Date(targetDate.setHours(23, 59, 59, 999));

    const [sales, totals] = await prisma.$transaction([
      prisma.sale.count({
        where: { shopId: req.shopId, saleDate: { gte: start, lte: end } }
      }),
      prisma.sale.aggregate({
        where: { shopId: req.shopId, saleDate: { gte: start, lte: end } },
        _sum: { grandTotal: true, paidAmount: true, balanceAmount: true, totalGst: true },
        _avg: { grandTotal: true }
      })
    ]);

    // Payment mode breakdown
    const paymentBreakdownQuery = await prisma.$queryRaw`
      SELECT sp."paymentMode", SUM(sp.amount) as amount, CAST(COUNT(sp.id) AS INTEGER) as "count"
      FROM sale_payments sp
      JOIN sales s ON sp."saleId" = s.id
      WHERE s."shopId" = ${req.shopId} AND s."saleDate" BETWEEN ${start} AND ${end}
      GROUP BY sp."paymentMode"
    `;
    const paymentBreakdown = paymentBreakdownQuery.map(row => ({
      paymentMode: row.paymentMode,
      _sum: { paidAmount: Number(row.amount) || 0 },
      _count: Number(row.count) || 0
    }));

    // Calculate profit for the day
    const salesItems = await prisma.saleItem.findMany({
      where: { sale: { shopId: req.shopId, saleDate: { gte: start, lte: end } } },
      include: { product: { select: { purchasePrice: true, pricingTiers: true } } }
    });

    let totalProfit = 0;
    salesItems.forEach(si => {
      const p = si.product;
      const baseMultiplier = getBaseMultiplier(p.pricingTiers, si.unitType, si.saleType);
      const totalDeductionQty = Number(si.quantity) * baseMultiplier;
      const costOfGoods = totalDeductionQty * Number(p.purchasePrice);
      const revenue = Number(si.totalAmount);
      totalProfit += (revenue - costOfGoods);
    });

    res.json({
      totalSales: sales,
      totalRevenue: totals._sum.grandTotal || 0,
      totalCollected: totals._sum.paidAmount || 0,
      totalCredit: totals._sum.balanceAmount || 0,
      totalGst: totals._sum.totalGst || 0,
      avgSaleValue: totals._avg.grandTotal || 0,
      totalProfit,
      paymentBreakdown,
    });
  } catch (err) {
    next(err);
  }
};
