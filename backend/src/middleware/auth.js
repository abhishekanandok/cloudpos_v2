import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type === 'shop') {
      const shop = await prisma.shop.findUnique({
        where: { id: decoded.shopId },
        select: { id: true, name: true, isActive: true }
      });
      if (!shop || !shop.isActive) return res.status(401).json({ error: 'Account is inactive' });
      req.shopId = decoded.shopId;
      req.userType = 'shop';
      req.user = shop;

    } else if (decoded.type === 'staff') {
      const staff = await prisma.staff.findUnique({
        where: { id: decoded.staffId },
        select: { id: true, shopId: true, role: true, permissions: true, isActive: true }
      });
      if (!staff || !staff.isActive) return res.status(401).json({ error: 'Staff account is inactive' });
      req.shopId = staff.shopId;
      req.staffId = staff.id;
      req.staffRole = staff.role;
      req.userType = 'staff';
      req.user = staff;

    } else if (decoded.type === 'driver') {
      const driver = await prisma.driver.findUnique({
        where: { id: decoded.driverId },
        select: { id: true, shopId: true, name: true, vehicle: true, isActive: true }
      });
      if (!driver || !driver.isActive) return res.status(401).json({ error: 'Driver account is inactive' });
      req.shopId = driver.shopId;
      req.driverId = driver.id;
      req.userType = 'driver';
      req.user = driver;

    } else if (decoded.type === 'salesman') {
      const salesman = await prisma.salesman.findUnique({
        where: { id: decoded.salesmanId },
        select: { id: true, shopId: true, type: true, isActive: true }
      });
      if (!salesman || !salesman.isActive) return res.status(401).json({ error: 'Salesman account is inactive' });
      req.shopId = salesman.shopId;
      req.salesmanId = salesman.id;
      req.salesmanType = salesman.type;
      req.userType = 'salesman';
      req.user = salesman;

    } else {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (req.userType === 'shop') return next();
    if (req.userType === 'salesman') return res.status(403).json({ error: 'Insufficient permissions' });
    if (!roles.includes(req.staffRole)) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
};

export const ownerOnly = (req, res, next) => {
  if (req.userType !== 'shop') return res.status(403).json({ error: 'Owner access only' });
  next();
};
