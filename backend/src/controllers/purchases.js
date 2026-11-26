import prisma from '../config/prisma.js';
import { getBaseMultiplier } from '../utils/stockUtils.js';

// ── List Purchases ────────────────────────────────────────
export const getPurchases = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 20,
      startDate, endDate,
      supplierId, paymentMode, search
    } = req.query;

    const where = { shopId: req.shopId };

    if (startDate || endDate) {
      where.purchaseDate = {};
      if (startDate) where.purchaseDate.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.purchaseDate.lte = end;
      }
    }

    if (supplierId) where.supplierId = supplierId;
    if (paymentMode) where.paymentMode = paymentMode;
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [purchases, total] = await prisma.$transaction([
      prisma.purchase.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, mobile: true } },
          _count: { select: { items: true } },
        },
        orderBy: { purchaseDate: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.purchase.count({ where }),
    ]);

    // Summary totals
    const summary = await prisma.purchase.aggregate({
      where,
      _sum: { grandTotal: true, paidAmount: true, balanceAmount: true },
    });

    res.json({
      purchases,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
      summary: summary._sum,
    });
  } catch (err) {
    next(err);
  }
};

// ── Get Single Purchase ───────────────────────────────────
export const getPurchaseById = async (req, res, next) => {
  try {
    const purchase = await prisma.purchase.findFirst({
      where: { id: req.params.id, shopId: req.shopId },
      include: {
        supplier: true,
        branch: { select: { name: true } },
        items: {
          include: {
            product: {
              select: {
                id: true, name: true, barcode: true,
                unitType: true, retailPrice: true,
              },
            },
          },
        },
        payments: true,
      },
    });

    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
    res.json(purchase);
  } catch (err) {
    next(err);
  }
};

// ── Create Purchase ───────────────────────────────────────
export const createPurchase = async (req, res, next) => {
  try {
    const {
      supplierId,
      invoiceNumber,
      purchaseDate,
      branchId,
      items,
      discount = 0,
      paymentMode = 'CASH',
      paidAmount,
      isCredit = false,
      notes,
    } = req.body;

    const shopId = req.shopId;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    // Fetch all products in one query to validate
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, shopId },
    });
    const productMap = {};
    products.forEach(p => { productMap[p.id] = p; });

    // Calculate totals
    let subtotal = 0;
    let totalGst = 0;

    const processedItems = items.map(item => {
      const product = productMap[item.productId];
      if (!product) {
        throw Object.assign(
          new Error(`Product not found: ${item.productId}`),
          { statusCode: 404 }
        );
      }

      const qty = Number(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        throw Object.assign(
          new Error(`Quantity must be greater than zero for product: ${product.name}`),
          { statusCode: 400 }
        );
      }
      
      const unitName = item.unitType || product.unitType;
      // Purchases usually use WHOLESALE or default to base
      const baseMultiplier = getBaseMultiplier(product.pricingTiers, unitName, 'WHOLESALE');
      
      const totalIncrementQty = qty * baseMultiplier;

      const price = Number(item.purchasePrice);
      const gstPct = Number(item.gstPercent ?? product.gstPercent ?? 0);
      const baseAmount = qty * price;
      const gstAmount = (baseAmount * gstPct) / 100;
      const totalAmount = baseAmount + gstAmount;

      subtotal += baseAmount;
      totalGst += gstAmount;

      return {
        productId: item.productId,
        quantity: qty,
        totalIncrementQty,
        unitType: unitName,
        purchasePrice: price,
        gstPercent: gstPct,
        gstAmount,
        totalAmount,
        newSellingPrice: item.newSellingPrice,
        baseMultiplier
      };
    });

    const totalDiscount = Number(discount);
    const grandTotal = subtotal + totalGst - totalDiscount;
    const paid = isCredit ? Number(paidAmount || 0) : grandTotal;
    const balance = grandTotal - paid;

    // Create everything in a DB transaction
    const purchase = await prisma.$transaction(async (tx) => {
      const newPurchase = await tx.purchase.create({
        data: {
          shopId,
          branchId: branchId || null,
          supplierId: supplierId || null,
          invoiceNumber: invoiceNumber || null,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
          subtotal,
          totalGst,
          totalDiscount,
          grandTotal,
          paidAmount: paid,
          balanceAmount: balance,
          isCredit: Boolean(isCredit),
          paymentMode: isCredit && paid === 0 ? 'CREDIT' : paymentMode,
          notes: notes || null,
          items: { create: processedItems.map(({ totalIncrementQty, newSellingPrice, baseMultiplier, ...rest }) => rest) },
          payments: paid > 0 ? {
            create: { amount: paid, paymentMode },
          } : undefined,
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true } },
            },
          },
          supplier: { select: { name: true } },
        },
      });

      // Increase stock and update prices for each item
      for (const item of processedItems) {
        const updateData = { currentStock: { increment: item.totalIncrementQty } };

        if (item.newSellingPrice !== undefined && item.newSellingPrice !== null) {
          const product = productMap[item.productId];
          updateData.purchasePrice = item.purchasePrice;

          if (product) {
            const newBaseRetail = item.newSellingPrice / (item.baseMultiplier || 1);
            updateData.retailPrice = newBaseRetail;

            if (product.pricingTiers && Array.isArray(product.pricingTiers)) {
              const oldBaseRetail = Number(product.retailPrice) || 1;
              const scale = oldBaseRetail > 0 ? (newBaseRetail / oldBaseRetail) : 1;

              const updatedTiers = product.pricingTiers.map(tier => {
                const newTier = { ...tier };
                if (newTier.price) {
                  newTier.price = Math.round(Number(newTier.price) * scale * 100) / 100;
                }
                if (Array.isArray(newTier.units)) {
                  newTier.units = newTier.units.map(u => ({
                    ...u,
                    price: Math.round(Number(u.price) * scale * 100) / 100,
                  }));
                }
                return newTier;
              });
              updateData.pricingTiers = updatedTiers;
            }
          }
        }

        await tx.product.update({
          where: { id: item.productId },
          data: updateData,
        });
      }

      // Update supplier ledger if credit purchase
      if (supplierId && balance > 0) {
        const supplier = await tx.supplier.findUnique({
          where: { id: supplierId },
        });
        const newBalance = Number(supplier.currentBalance) + balance;

        await tx.supplier.update({
          where: { id: supplierId },
          data: { currentBalance: newBalance },
        });

        await tx.supplierLedger.create({
          data: {
            supplierId,
            type: 'CREDIT',
            amount: grandTotal,
            balance: newBalance,
            description: `Purchase - ${invoiceNumber || newPurchase.id}`,
            referenceId: newPurchase.id,
            refType: 'PURCHASE',
          },
        });
      }

      return newPurchase;
    });

    res.status(201).json(purchase);
  } catch (err) {
    next(err);
  }
};

// ── Record Additional Payment on Credit Purchase ──────────
export const recordPayment = async (req, res, next) => {
  try {
    const { amount, paymentMode, notes } = req.body;
    const purchaseId = req.params.id;

    const purchase = await prisma.purchase.findFirst({
      where: { id: purchaseId, shopId: req.shopId },
    });

    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });

    const payAmt = Number(amount);
    if (payAmt <= 0) return res.status(400).json({ error: 'Amount must be positive' });
    if (payAmt > Number(purchase.balanceAmount)) {
      return res.status(400).json({ error: 'Amount exceeds outstanding balance' });
    }

    const newPaid = Number(purchase.paidAmount) + payAmt;
    const newBalance = Number(purchase.balanceAmount) - payAmt;

    await prisma.$transaction([
      prisma.purchasePayment.create({
        data: { purchaseId, amount: payAmt, paymentMode, notes },
      }),
      prisma.purchase.update({
        where: { id: purchaseId },
        data: {
          paidAmount: newPaid,
          balanceAmount: newBalance,
          isCredit: newBalance > 0,
        },
      }),
    ]);

    // Update supplier ledger
    if (purchase.supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: purchase.supplierId },
      });
      const updatedBalance = Number(supplier.currentBalance) - payAmt;

      await prisma.$transaction([
        prisma.supplier.update({
          where: { id: purchase.supplierId },
          data: { currentBalance: updatedBalance },
        }),
        prisma.supplierLedger.create({
          data: {
            supplierId: purchase.supplierId,
            type: 'DEBIT',
            amount: payAmt,
            balance: updatedBalance,
            description: `Payment for Purchase - ${purchase.invoiceNumber || purchaseId}`,
            referenceId: purchaseId,
            refType: 'PAYMENT',
          },
        }),
      ]);
    }

    res.json({ message: 'Payment recorded', newBalance });
  } catch (err) {
    next(err);
  }
};

// ── Delete Purchase (soft delete / reverse) ───────────────
export const deletePurchase = async (req, res, next) => {
  try {
    const purchase = await prisma.purchase.findFirst({
      where: { id: req.params.id, shopId: req.shopId },
      include: { items: true },
    });

    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });

    // Reverse stock for each item
    await prisma.$transaction(async (tx) => {
      for (const item of purchase.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        
        let baseMultiplier = 1;
        if (product) {
           baseMultiplier = getBaseMultiplier(product.pricingTiers, item.unitType, 'WHOLESALE');
        }
        
        const decrementQty = Number(item.quantity) * baseMultiplier;

        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: decrementQty } },
        });
      }
      await tx.purchase.delete({ where: { id: purchase.id } });
    });

    res.json({ message: 'Purchase deleted and stock reversed' });
  } catch (err) {
    next(err);
  }
};
