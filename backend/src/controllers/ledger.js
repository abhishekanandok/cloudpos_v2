import prisma from '../config/prisma.js';
import bcrypt from 'bcryptjs';

const verifyUserPassword = async (req, password) => {
  if (!password) throw new Error('Password is required');
  if (req.userType === 'shop') {
    const shop = await prisma.shop.findUnique({ where: { id: req.shopId } });
    if (!shop) throw new Error('Account not found');
    const valid = await bcrypt.compare(password, shop.passwordHash);
    if (!valid) throw new Error('Incorrect password');
  } else if (req.userType === 'staff') {
    const staff = await prisma.staff.findUnique({ where: { id: req.staffId } });
    if (!staff) throw new Error('Account not found');
    const valid = await bcrypt.compare(password, staff.passwordHash);
    if (!valid) throw new Error('Incorrect password');
  } else {
    throw new Error('Unauthorized role for this action');
  }
};

export const getCustomerLedger = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const { startDate, endDate } = req.query;
    const where = { customerId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    const [customer, entries] = await Promise.all([
      prisma.customer.findFirst({ where: { id: customerId, shopId: req.shopId } }),
      prisma.customerLedger.findMany({ where, orderBy: { createdAt: 'asc' } }),
    ]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json({ customer, entries });
  } catch (err) { next(err); }
};

export const getSupplierLedger = async (req, res, next) => {
  try {
    const { supplierId } = req.params;
    const { startDate, endDate } = req.query;
    const where = { supplierId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    const [supplier, entries] = await Promise.all([
      prisma.supplier.findFirst({ where: { id: supplierId, shopId: req.shopId } }),
      prisma.supplierLedger.findMany({ where, orderBy: { createdAt: 'asc' } }),
    ]);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    res.json({ supplier, entries });
  } catch (err) { next(err); }
};

export const addManualCustomerEntry = async (req, res, next) => {
  try {
    const { customerId, type, amount, description } = req.body;
    const customer = await prisma.customer.findFirst({ where: { id: customerId, shopId: req.shopId } });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const delta = type === 'DEBIT' ? Number(amount) : -Number(amount);
    const newBalance = Number(customer.currentBalance) + delta;
    await prisma.$transaction([
      prisma.customer.update({ where: { id: customerId }, data: { currentBalance: newBalance } }),
      prisma.customerLedger.create({ data: { customerId, type, amount: Number(amount), balance: newBalance, description } }),
    ]);
    res.json({ message: 'Entry added', newBalance });
  } catch (err) { next(err); }
};

export const addManualSupplierEntry = async (req, res, next) => {
  try {
    const { supplierId, type, amount, description } = req.body;
    const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, shopId: req.shopId } });
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    const delta = type === 'CREDIT' ? Number(amount) : -Number(amount);
    const newBalance = Number(supplier.currentBalance) + delta;
    await prisma.$transaction([
      prisma.supplier.update({ where: { id: supplierId }, data: { currentBalance: newBalance } }),
      prisma.supplierLedger.create({ data: { supplierId, type, amount: Number(amount), balance: newBalance, description } }),
    ]);
    res.json({ message: 'Entry added', newBalance });
  } catch (err) { next(err); }
};
export const updateCustomerEntry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password, type, amount, description } = req.body;
    try { await verifyUserPassword(req, password); } catch (e) { return res.status(403).json({ error: e.message }); }

    const entry = await prisma.customerLedger.findUnique({ where: { id, customer: { shopId: req.shopId } } });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    const customerId = entry.customerId;
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });

    await prisma.$transaction(async (tx) => {
      await tx.customerLedger.update({ where: { id }, data: { amount: Number(amount), type, description } });
      const allEntries = await tx.customerLedger.findMany({ where: { customerId }, orderBy: { createdAt: 'asc' } });
      let runningBalance = Number(customer.openingBalance || 0);
      for (const e of allEntries) {
        const amt = Number(e.amount);
        const delta = e.type === 'DEBIT' ? amt : -amt;
        runningBalance += delta;
        if (Number(e.balance) !== runningBalance) {
          await tx.customerLedger.update({ where: { id: e.id }, data: { balance: runningBalance } });
        }
      }
      await tx.customer.update({ where: { id: customerId }, data: { currentBalance: runningBalance } });
    });
    res.json({ message: 'Entry updated successfully' });
  } catch (err) { next(err); }
};

export const deleteCustomerEntry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.query; // Send password in query for DELETE (or body if HTTP client supports it, usually we send in data body via axios.delete { data: { password } })
    const bodyPassword = req.body.password || password; // Fallback to handle both
    try { await verifyUserPassword(req, bodyPassword); } catch (e) { return res.status(403).json({ error: e.message }); }

    const entry = await prisma.customerLedger.findUnique({ where: { id, customer: { shopId: req.shopId } } });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    const customerId = entry.customerId;
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });

    await prisma.$transaction(async (tx) => {
      await tx.customerLedger.delete({ where: { id } });
      const allEntries = await tx.customerLedger.findMany({ where: { customerId }, orderBy: { createdAt: 'asc' } });
      let runningBalance = Number(customer.openingBalance || 0);
      for (const e of allEntries) {
        const amt = Number(e.amount);
        const delta = e.type === 'DEBIT' ? amt : -amt;
        runningBalance += delta;
        if (Number(e.balance) !== runningBalance) {
           await tx.customerLedger.update({ where: { id: e.id }, data: { balance: runningBalance } });
        }
      }
      await tx.customer.update({ where: { id: customerId }, data: { currentBalance: runningBalance } });
    });
    res.json({ message: 'Entry deleted successfully' });
  } catch (err) { next(err); }
};

export const updateSupplierEntry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password, type, amount, description } = req.body;
    try { await verifyUserPassword(req, password); } catch (e) { return res.status(403).json({ error: e.message }); }

    const entry = await prisma.supplierLedger.findUnique({ where: { id, supplier: { shopId: req.shopId } } });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    const supplierId = entry.supplierId;
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });

    await prisma.$transaction(async (tx) => {
      await tx.supplierLedger.update({ where: { id }, data: { amount: Number(amount), type, description } });
      const allEntries = await tx.supplierLedger.findMany({ where: { supplierId }, orderBy: { createdAt: 'asc' } });
      let runningBalance = Number(supplier.openingBalance || 0);
      for (const e of allEntries) {
        const amt = Number(e.amount);
        const delta = e.type === 'CREDIT' ? amt : -amt;
        runningBalance += delta;
        if (Number(e.balance) !== runningBalance) {
          await tx.supplierLedger.update({ where: { id: e.id }, data: { balance: runningBalance } });
        }
      }
      await tx.supplier.update({ where: { id: supplierId }, data: { currentBalance: runningBalance } });
    });
    res.json({ message: 'Entry updated successfully' });
  } catch (err) { next(err); }
};

export const deleteSupplierEntry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.query;
    const bodyPassword = req.body.password || password;
    try { await verifyUserPassword(req, bodyPassword); } catch (e) { return res.status(403).json({ error: e.message }); }

    const entry = await prisma.supplierLedger.findUnique({ where: { id, supplier: { shopId: req.shopId } } });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    const supplierId = entry.supplierId;
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });

    await prisma.$transaction(async (tx) => {
      await tx.supplierLedger.delete({ where: { id } });
      const allEntries = await tx.supplierLedger.findMany({ where: { supplierId }, orderBy: { createdAt: 'asc' } });
      let runningBalance = Number(supplier.openingBalance || 0);
      for (const e of allEntries) {
        const amt = Number(e.amount);
        const delta = e.type === 'CREDIT' ? amt : -amt;
        runningBalance += delta;
        if (Number(e.balance) !== runningBalance) {
          await tx.supplierLedger.update({ where: { id: e.id }, data: { balance: runningBalance } });
        }
      }
      await tx.supplier.update({ where: { id: supplierId }, data: { currentBalance: runningBalance } });
    });
    res.json({ message: 'Entry deleted successfully' });
  } catch (err) { next(err); }
};
