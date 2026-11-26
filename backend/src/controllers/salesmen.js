import prisma from '../config/prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ── List Salesmen ─────────────────────────────────────────
export const getSalesmen = async (req, res, next) => {
  try {
    const salesmen = await prisma.salesman.findMany({
      where: { shopId: req.shopId, isActive: true },
      select: {
        id: true, name: true, mobile: true, loginId: true,
        type: true, isActive: true, createdAt: true,
        _count: { select: { sales: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(salesmen);
  } catch (err) { next(err); }
};

// ── Create Salesman ───────────────────────────────────────
export const createSalesman = async (req, res, next) => {
  try {
    const { name, mobile, loginId, password, type } = req.body;
    if (!name || !loginId || !password) {
      return res.status(400).json({ error: 'Name, Login ID and Password are required' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const salesman = await prisma.salesman.create({
      data: { shopId: req.shopId, name, mobile, loginId, passwordHash, type: type || 'STAFF' }
    });
    const { passwordHash: _, ...safe } = salesman;
    res.status(201).json(safe);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Login ID already exists' });
    next(err);
  }
};

// ── Update Salesman ───────────────────────────────────────
export const updateSalesman = async (req, res, next) => {
  try {
    const { name, mobile, type, isActive, password } = req.body;
    const data = { name, mobile, type, isActive };
    if (password) data.passwordHash = await bcrypt.hash(password, 12);
    const salesman = await prisma.salesman.update({
      where: { id: req.params.id },
      data
    });
    const { passwordHash: _, ...safe } = salesman;
    res.json(safe);
  } catch (err) { next(err); }
};

// ── Delete Salesman ───────────────────────────────────────
export const deleteSalesman = async (req, res, next) => {
  try {
    await prisma.salesman.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });
    res.json({ message: 'Salesman deactivated' });
  } catch (err) { next(err); }
};

// ── Salesman Login ────────────────────────────────────────
export const salesmanLogin = async (req, res, next) => {
  try {
    const { loginId, password } = req.body;
    const salesman = await prisma.salesman.findUnique({
      where: { loginId },
      include: { shop: { select: { id: true, name: true, logo: true } } }
    });
    if (!salesman || !salesman.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, salesman.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { salesmanId: salesman.id, shopId: salesman.shopId, type: 'salesman' },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({
      token,
      salesman: { id: salesman.id, name: salesman.name, loginId: salesman.loginId, type: salesman.type, shop: salesman.shop }
    });
  } catch (err) { next(err); }
};

// ── Salesman Performance Report ───────────────────────────
export const salesmanReport = async (req, res, next) => {
  try {
    const { startDate, endDate, salesmanId } = req.query;
    const shopId = req.shopId;
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(1));
    const end = endDate ? new Date(endDate) : new Date();

    const where = { shopId, saleDate: { gte: start, lte: end } };
    if (salesmanId) where.salesmanId = salesmanId;

    const report = await prisma.$queryRaw`
      SELECT 
        sm.id, sm.name, sm."loginId", sm.type,
        COUNT(s.id) as "totalBills",
        COALESCE(SUM(s."grandTotal"), 0) as "totalSales",
        COALESCE(SUM(s."paidAmount"), 0) as "totalCollected",
        COALESCE(SUM(s."balanceAmount"), 0) as "totalCredit"
      FROM salesmen sm
      LEFT JOIN sales s ON s."salesmanId" = sm.id 
        AND s."saleDate" BETWEEN ${start} AND ${end}
      WHERE sm."shopId" = ${shopId} AND sm."isActive" = true
      GROUP BY sm.id, sm.name, sm."loginId", sm.type
      ORDER BY "totalSales" DESC
    `;

    res.json(report.map(r => ({
      ...r,
      totalBills: Number(r.totalBills),
      totalSales: Number(r.totalSales),
      totalCollected: Number(r.totalCollected),
      totalCredit: Number(r.totalCredit),
    })));
  } catch (err) { next(err); }
};
