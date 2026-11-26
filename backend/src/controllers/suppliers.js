import prisma from '../config/prisma.js';

export const getSuppliers = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 30 } = req.query;
    const where = { shopId: req.shopId, isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search } },
      ];
    }
    const [suppliers, total] = await prisma.$transaction([
      prisma.supplier.findMany({
        where, orderBy: { name: 'asc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: { _count: { select: { purchases: true } } },
      }),
      prisma.supplier.count({ where }),
    ]);
    res.json({ suppliers, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

export const getSupplierById = async (req, res, next) => {
  try {
    const supplier = await prisma.supplier.findFirst({
      where: { id: req.params.id, shopId: req.shopId },
      include: {
        purchases: { orderBy: { purchaseDate: 'desc' }, take: 10 },
        ledger: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    res.json(supplier);
  } catch (err) { next(err); }
};

export const createSupplier = async (req, res, next) => {
  try {
    const { name, mobile, address, gstNumber, openingBalance } = req.body;
    const supplier = await prisma.supplier.create({
      data: {
        shopId: req.shopId, name, mobile, address,
        gstNumber: gstNumber || null,
        openingBalance: openingBalance || 0,
        currentBalance: openingBalance || 0,
      },
    });
    if (Number(openingBalance) > 0) {
      await prisma.supplierLedger.create({
        data: {
          supplierId: supplier.id, type: 'CREDIT',
          amount: Number(openingBalance), balance: Number(openingBalance),
          description: 'Opening Balance',
        },
      });
    }
    res.status(201).json(supplier);
  } catch (err) { next(err); }
};

export const updateSupplier = async (req, res, next) => {
  try {
    const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data: req.body });
    res.json(supplier);
  } catch (err) { next(err); }
};

export const deleteSupplier = async (req, res, next) => {
  try {
    await prisma.supplier.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Supplier deleted' });
  } catch (err) { next(err); }
};
