import prisma from '../config/prisma.js';

export const getStockHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, productId, reason } = req.query;
    const where = { shopId: req.shopId };
    if (productId) where.productId = productId;
    if (reason) where.reason = reason;
    const [history, total] = await prisma.$transaction([
      prisma.stockUpdate.findMany({
        where,
        include: { product: { select: { id: true, name: true, barcode: true, unitType: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.stockUpdate.count({ where }),
    ]);
    res.json({ history, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

export const adjustStock = async (req, res, next) => {
  try {
    const { productId, newQty, reason, notes } = req.body;
    const product = await prisma.product.findFirst({ where: { id: productId, shopId: req.shopId } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const diff = Number(newQty) - Number(product.currentStock);
    await prisma.$transaction([
      prisma.product.update({ where: { id: productId }, data: { currentStock: Number(newQty) } }),
      prisma.stockUpdate.create({
        data: {
          shopId: req.shopId,
          productId,
          previousQty: product.currentStock,
          newQty: Number(newQty),
          difference: diff,
          reason,
          notes: notes || null,
          createdBy: req.staffId || req.shopId,
        },
      }),
    ]);
    res.json({ message: 'Stock adjusted', previousQty: product.currentStock, newQty: Number(newQty), difference: diff });
  } catch (err) { next(err); }
};

export const addToStock = async (req, res, next) => {
  try {
    const { productId, addQty, notes } = req.body;
    if (!productId || addQty === undefined || addQty === null) {
      return res.status(400).json({ error: 'productId and addQty are required' });
    }
    const qty = Number(addQty);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'addQty must be a positive number' });
    }
    const product = await prisma.product.findFirst({ where: { id: productId, shopId: req.shopId } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const previousQty = Number(product.currentStock);
    const newQty = previousQty + qty;

    await prisma.$transaction([
      prisma.product.update({ where: { id: productId }, data: { currentStock: newQty } }),
      prisma.stockUpdate.create({
        data: {
          shopId: req.shopId,
          productId,
          previousQty,
          newQty,
          difference: qty,
          reason: 'ADJUSTMENT',
          notes: notes || null,
          createdBy: req.staffId || req.shopId,
        },
      }),
    ]);
    res.json({ message: 'Stock added successfully', previousQty, newQty, addedQty: qty });
  } catch (err) { next(err); }
};

export const bulkAdjust = async (req, res, next) => {
  try {
    const { adjustments, reason, notes } = req.body;
    const results = [];
    for (const adj of adjustments) {
      const product = await prisma.product.findFirst({ where: { id: adj.productId, shopId: req.shopId } });
      if (!product) continue;
      const diff = Number(adj.newQty) - Number(product.currentStock);
      await prisma.$transaction([
        prisma.product.update({ where: { id: adj.productId }, data: { currentStock: Number(adj.newQty) } }),
        prisma.stockUpdate.create({
          data: {
            shopId: req.shopId, productId: adj.productId,
            previousQty: product.currentStock, newQty: Number(adj.newQty),
            difference: diff, reason, notes: notes || null,
            createdBy: req.staffId || req.shopId,
          },
        }),
      ]);
      results.push({ productId: adj.productId, name: product.name, difference: diff });
    }
    res.json({ message: `${results.length} products adjusted`, results });
  } catch (err) { next(err); }
};

export const editStockHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, notes } = req.body;

    const entry = await prisma.stockUpdate.findFirst({ where: { id, shopId: req.shopId } });
    if (!entry) return res.status(404).json({ error: 'Stock history entry not found' });

    const now = new Date();
    const editedLabel = `[Edited: ${now.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}]`;

    // Strip any previous edited label from notes to avoid stacking
    const stripEdited = (str) => (str || '').replace(/^\[Edited:.*?\]\s*/i, '').trim();
    const cleanNotes = stripEdited(notes);
    const finalNotes = cleanNotes ? `${editedLabel} ${cleanNotes}` : editedLabel;

    const updated = await prisma.stockUpdate.update({
      where: { id },
      data: {
        reason: reason || entry.reason,
        notes: finalNotes,
      },
      include: { product: { select: { id: true, name: true, barcode: true, unitType: true } } },
    });

    res.json({ message: 'History entry updated', entry: updated });
  } catch (err) { next(err); }
};
