import prisma from '../config/prisma.js';

export const getSettings = async (req, res, next) => {
  try {
    const settings = await prisma.shopSettings.findUnique({ where: { shopId: req.shopId } });
    res.json(settings);
  } catch (err) { next(err); }
};

export const updateSettings = async (req, res, next) => {
  try {
    const settings = await prisma.shopSettings.update({
      where: { shopId: req.shopId },
      data: req.body,
    });
    res.json(settings);
  } catch (err) { next(err); }
};

export const getStaff = async (req, res, next) => {
  try {
    const staff = await prisma.staff.findMany({
      where: { shopId: req.shopId, isActive: true },
      select: { id: true, name: true, email: true, mobile: true, role: true, branchId: true, createdAt: true },
    });
    res.json(staff);
  } catch (err) { next(err); }
};

export const createStaff = async (req, res, next) => {
  try {
    const bcrypt = (await import('bcryptjs')).default;
    const { name, email, mobile, password, role, branchId } = req.body;
    const existing = await prisma.staff.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const passwordHash = await bcrypt.hash(password, 12);
    const staff = await prisma.staff.create({
      data: { shopId: req.shopId, name, email, mobile, passwordHash, role: role || 'STAFF', branchId: branchId || null },
    });
    res.status(201).json({ id: staff.id, name: staff.name, email: staff.email, role: staff.role });
  } catch (err) { next(err); }
};

export const updateStaff = async (req, res, next) => {
  try {
    const { name, mobile, role, branchId, isActive } = req.body;
    const staff = await prisma.staff.update({
      where: { id: req.params.id },
      data: { name, mobile, role, branchId, isActive },
    });
    res.json(staff);
  } catch (err) { next(err); }
};

export const getBranches = async (req, res, next) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { shopId: req.shopId, isActive: true },
      include: { _count: { select: { sales: true, purchases: true } } },
    });
    res.json(branches);
  } catch (err) { next(err); }
};

export const createBranch = async (req, res, next) => {
  try {
    const branch = await prisma.branch.create({
      data: { ...req.body, shopId: req.shopId },
    });
    res.status(201).json(branch);
  } catch (err) { next(err); }
};

export const updateShopProfile = async (req, res, next) => {
  try {
    const { name, ownerName, address, gstNumber, businessType } = req.body;
    const shop = await prisma.shop.update({
      where: { id: req.shopId },
      data: { name, ownerName, address, gstNumber, businessType },
    });
    res.json(shop);
  } catch (err) { next(err); }
};
