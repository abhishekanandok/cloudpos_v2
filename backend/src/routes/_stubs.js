// Generic CRUD route factory for simple modules
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import prisma from '../config/prisma.js';

// ── Categories ────────────────────────────────────────────
export const categoriesRouter = Router();
categoriesRouter.use(authenticate);
categoriesRouter.get('/', async (req, res, next) => {
  try {
    const items = await prisma.category.findMany({ where: { shopId: req.shopId, isActive: true }, orderBy: { name: 'asc' } });
    res.json(items);
  } catch (e) { next(e); }
});
categoriesRouter.post('/', async (req, res, next) => {
  try {
    const item = await prisma.category.create({ data: { ...req.body, shopId: req.shopId } });
    res.status(201).json(item);
  } catch (e) { next(e); }
});

// ── Brands ────────────────────────────────────────────────
export const brandsRouter = Router();
brandsRouter.use(authenticate);
brandsRouter.get('/', async (req, res, next) => {
  try {
    const items = await prisma.brand.findMany({ where: { shopId: req.shopId, isActive: true }, orderBy: { name: 'asc' } });
    res.json(items);
  } catch (e) { next(e); }
});
brandsRouter.post('/', async (req, res, next) => {
  try {
    const item = await prisma.brand.create({ data: { ...req.body, shopId: req.shopId } });
    res.status(201).json(item);
  } catch (e) { next(e); }
});

// ── Customers ─────────────────────────────────────────────
export const customersRouter = Router();
customersRouter.use(authenticate);
customersRouter.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    const where = { shopId: req.shopId, isActive: true };
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { mobile: { contains: search } }
    ];
    const items = await prisma.customer.findMany({ where, orderBy: { name: 'asc' } });
    res.json(items);
  } catch (e) { next(e); }
});
customersRouter.post('/', async (req, res, next) => {
  try {
    const item = await prisma.customer.create({ data: { ...req.body, shopId: req.shopId } });
    res.status(201).json(item);
  } catch (e) { next(e); }
});
customersRouter.put('/:id', async (req, res, next) => {
  try {
    const item = await prisma.customer.update({ where: { id: req.params.id }, data: req.body });
    res.json(item);
  } catch (e) { next(e); }
});

// ── Suppliers ─────────────────────────────────────────────
export const suppliersRouter = Router();
suppliersRouter.use(authenticate);
suppliersRouter.get('/', async (req, res, next) => {
  try {
    const items = await prisma.supplier.findMany({ where: { shopId: req.shopId, isActive: true }, orderBy: { name: 'asc' } });
    res.json(items);
  } catch (e) { next(e); }
});
suppliersRouter.post('/', async (req, res, next) => {
  try {
    const item = await prisma.supplier.create({ data: { ...req.body, shopId: req.shopId } });
    res.status(201).json(item);
  } catch (e) { next(e); }
});

// ── Settings ──────────────────────────────────────────────
export const settingsRouter = Router();
settingsRouter.use(authenticate);
settingsRouter.get('/', async (req, res, next) => {
  try {
    const settings = await prisma.shopSettings.findUnique({ where: { shopId: req.shopId } });
    res.json(settings);
  } catch (e) { next(e); }
});
settingsRouter.put('/', async (req, res, next) => {
  try {
    const settings = await prisma.shopSettings.update({ where: { shopId: req.shopId }, data: req.body });
    res.json(settings);
  } catch (e) { next(e); }
});

// ── Staff ─────────────────────────────────────────────────
export const staffRouter = Router();
staffRouter.use(authenticate);
staffRouter.get('/', async (req, res, next) => {
  try {
    const items = await prisma.staff.findMany({
      where: { shopId: req.shopId, isActive: true },
      select: { id: true, name: true, email: true, mobile: true, role: true, branchId: true, createdAt: true }
    });
    res.json(items);
  } catch (e) { next(e); }
});
import bcrypt from 'bcryptjs';
staffRouter.post('/', async (req, res, next) => {
  try {
    const { name, email, mobile, password, role, branchId } = req.body;
    const passwordHash = await bcrypt.hash(password, 12);
    const item = await prisma.staff.create({
      data: { shopId: req.shopId, name, email, mobile, passwordHash, role, branchId }
    });
    res.status(201).json({ id: item.id, name: item.name, email: item.email, role: item.role });
  } catch (e) { next(e); }
});

// ── Branches ──────────────────────────────────────────────
export const branchesRouter = Router();
branchesRouter.use(authenticate);
branchesRouter.get('/', async (req, res, next) => {
  try {
    const items = await prisma.branch.findMany({ where: { shopId: req.shopId, isActive: true } });
    res.json(items);
  } catch (e) { next(e); }
});
branchesRouter.post('/', async (req, res, next) => {
  try {
    const item = await prisma.branch.create({ data: { ...req.body, shopId: req.shopId } });
    res.status(201).json(item);
  } catch (e) { next(e); }
});

// ── Ledger ────────────────────────────────────────────────
export const ledgerRouter = Router();
ledgerRouter.use(authenticate);
ledgerRouter.get('/customer/:customerId', async (req, res, next) => {
  try {
    const entries = await prisma.customerLedger.findMany({
      where: { customerId: req.params.customerId },
      orderBy: { createdAt: 'asc' }
    });
    const customer = await prisma.customer.findUnique({ where: { id: req.params.customerId } });
    res.json({ customer, entries });
  } catch (e) { next(e); }
});
ledgerRouter.get('/supplier/:supplierId', async (req, res, next) => {
  try {
    const entries = await prisma.supplierLedger.findMany({
      where: { supplierId: req.params.supplierId },
      orderBy: { createdAt: 'asc' }
    });
    const supplier = await prisma.supplier.findUnique({ where: { id: req.params.supplierId } });
    res.json({ supplier, entries });
  } catch (e) { next(e); }
});

// ── Stock ─────────────────────────────────────────────────
export const stockRouter = Router();
stockRouter.use(authenticate);
stockRouter.get('/history', async (req, res, next) => {
  try {
    const history = await prisma.stockUpdate.findMany({
      where: { shopId: req.shopId },
      include: { product: { select: { name: true, barcode: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json(history);
  } catch (e) { next(e); }
});
stockRouter.post('/adjust', async (req, res, next) => {
  try {
    const { productId, newQty, reason, notes } = req.body;
    const product = await prisma.product.findFirst({ where: { id: productId, shopId: req.shopId } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const diff = Number(newQty) - Number(product.currentStock);

    await prisma.$transaction([
      prisma.product.update({ where: { id: productId }, data: { currentStock: newQty } }),
      prisma.stockUpdate.create({
        data: {
          shopId: req.shopId,
          productId,
          previousQty: product.currentStock,
          newQty,
          difference: diff,
          reason,
          notes,
          createdBy: req.staffId || req.shopId
        }
      })
    ]);

    res.json({ message: 'Stock updated successfully', difference: diff });
  } catch (e) { next(e); }
});

// ── Purchases ─────────────────────────────────────────────
export const purchasesRouter = Router();
purchasesRouter.use(authenticate);
purchasesRouter.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const [purchases, total] = await prisma.$transaction([
      prisma.purchase.findMany({
        where: { shopId: req.shopId },
        include: { supplier: { select: { name: true } }, _count: { select: { items: true } } },
        orderBy: { purchaseDate: 'desc' },
        skip: (page - 1) * limit,
        take: Number(limit)
      }),
      prisma.purchase.count({ where: { shopId: req.shopId } })
    ]);
    res.json({ purchases, pagination: { page, limit, total } });
  } catch (e) { next(e); }
});

purchasesRouter.post('/', async (req, res, next) => {
  try {
    const { supplierId, invoiceNumber, purchaseDate, items, paymentMode, paidAmount, isCredit, notes } = req.body;
    const shopId = req.shopId;

    let subtotal = 0, totalGst = 0;
    const processedItems = items.map(item => {
      const gstAmount = (item.purchasePrice * item.quantity * (item.gstPercent || 0)) / 100;
      const totalAmount = item.purchasePrice * item.quantity + gstAmount;
      subtotal += item.purchasePrice * item.quantity;
      totalGst += gstAmount;
      return { ...item, gstAmount, totalAmount };
    });

    const grandTotal = subtotal + totalGst;
    const paid = isCredit ? (paidAmount || 0) : grandTotal;
    const balance = grandTotal - paid;

    const purchase = await prisma.$transaction(async (tx) => {
      const p = await tx.purchase.create({
        data: {
          shopId, supplierId, invoiceNumber, purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
          subtotal, totalGst, grandTotal, paidAmount: paid, balanceAmount: balance,
          isCredit: Boolean(isCredit), paymentMode: paymentMode || 'CASH', notes,
          items: { create: processedItems }
        },
        include: { items: true }
      });

      // Increase stock
      for (const item of processedItems) {
        await tx.product.update({ where: { id: item.productId }, data: { currentStock: { increment: item.quantity } } });
      }

      return p;
    });

    res.status(201).json(purchase);
  } catch (e) { next(e); }
});
