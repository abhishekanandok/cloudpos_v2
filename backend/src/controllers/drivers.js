import prisma from '../config/prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getBaseMultiplier, findPricingTier, normalizeString } from '../utils/stockUtils.js';

// ── List Drivers ──────────────────────────────────────────
export const getDrivers = async (req, res, next) => {
  try {
    const drivers = await prisma.driver.findMany({
      where: { shopId: req.shopId, isActive: true },
      select: {
        id: true, name: true, mobile: true, loginId: true,
        vehicle: true, isActive: true, createdAt: true,
        _count: { select: { sales: true, vehicleLoads: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(drivers);
  } catch (err) { next(err); }
};

// ── Create Driver ─────────────────────────────────────────
export const createDriver = async (req, res, next) => {
  try {
    const { name, mobile, loginId, password, vehicle } = req.body;
    if (!name || !loginId || !password) {
      return res.status(400).json({ error: 'Name, Login ID and Password required' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const driver = await prisma.driver.create({
      data: { shopId: req.shopId, name, mobile, loginId, passwordHash, vehicle }
    });
    const { passwordHash: _, ...safe } = driver;
    res.status(201).json(safe);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Login ID already exists' });
    next(err);
  }
};

// ── Update Driver ─────────────────────────────────────────
export const updateDriver = async (req, res, next) => {
  try {
    const { name, mobile, vehicle, isActive, password } = req.body;
    const data = { name, mobile, vehicle, isActive };
    if (password) data.passwordHash = await bcrypt.hash(password, 12);
    const driver = await prisma.driver.update({ where: { id: req.params.id }, data });
    const { passwordHash: _, ...safe } = driver;
    res.json(safe);
  } catch (err) { next(err); }
};

// ── Delete Driver ─────────────────────────────────────────
export const deleteDriver = async (req, res, next) => {
  try {
    await prisma.driver.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Driver deactivated' });
  } catch (err) { next(err); }
};

// ── Driver Login ──────────────────────────────────────────
export const driverLogin = async (req, res, next) => {
  try {
    const { loginId, password } = req.body;
    const driver = await prisma.driver.findUnique({
      where: { loginId },
      include: { shop: { select: { id: true, name: true, logo: true } } }
    });
    if (!driver || !driver.isActive) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, driver.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // Log login
    await prisma.driverLog.create({
      data: { shopId: driver.shopId, driverId: driver.id, action: 'LOGIN', details: 'Driver logged in' }
    });

    const token = jwt.sign(
      { driverId: driver.id, shopId: driver.shopId, type: 'driver' },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({
      token,
      driver: { id: driver.id, name: driver.name, loginId: driver.loginId, vehicle: driver.vehicle, shop: driver.shop }
    });
  } catch (err) { next(err); }
};

// ── Get Vehicle Stock ─────────────────────────────────────
export const getVehicleStock = async (req, res, next) => {
  try {
    const driverId = req.params.driverId || req.driverId;
    const shopId   = req.shopId;
    const stock = await prisma.vehicleStock.findMany({
      where: { driverId, shopId, quantity: { gt: 0 } },
      include: {
        product: {
          select: {
            id: true, name: true, barcode: true, unitType: true,
            retailPrice: true, minRetailQty: true,
            wholesalePrice: true, minWholesaleQty: true,
            semiWholesalePrice: true, minSemiWholesaleQty: true,
            salesmanPrice: true, gstPercent: true, pricingTiers: true
          }
        }
      },
      orderBy: { product: { name: 'asc' } }
    });
    // Convert Decimal fields to numbers for clean JSON
    const result = stock.map(s => ({
      ...s,
      quantity: Number(s.quantity),
      product: {
        ...s.product,
        retailPrice:        Number(s.product.retailPrice),
        minRetailQty:       Number(s.product.minRetailQty),
        wholesalePrice:     Number(s.product.wholesalePrice),
        minWholesaleQty:    Number(s.product.minWholesaleQty),
        semiWholesalePrice: Number(s.product.semiWholesalePrice),
        minSemiWholesaleQty:Number(s.product.minSemiWholesaleQty),
        salesmanPrice:      Number(s.product.salesmanPrice),
        gstPercent:         Number(s.product.gstPercent),
      }
    }));
    res.json(result);
  } catch (err) { next(err); }
};

// ── Load Stock to Vehicle ─────────────────────────────────
export const loadStock = async (req, res, next) => {
  try {
    const { driverId, items, notes, loadDate } = req.body;
    const shopId = req.shopId;

    if (!items || items.length === 0) return res.status(400).json({ error: 'No items provided' });

    const result = await prisma.$transaction(async (tx) => {
      // Create load record
      const load = await tx.vehicleLoad.create({
        data: {
          shopId, driverId,
          type: 'LOAD',
          notes,
          loadDate: loadDate ? new Date(loadDate) : new Date(),
          items: { create: items.map(i => ({ productId: i.productId, quantity: Number(i.quantity) })) }
        }
      });

      for (const item of items) {
        const qty = Number(item.quantity);
        // Deduct from shop stock
        const product = await tx.product.findFirst({ where: { id: item.productId, shopId } });
        if (!product) throw new Error(`Product not found: ${item.productId}`);
        if (Number(product.currentStock) < qty) throw Object.assign(new Error(`Insufficient shop stock for ${product.name}`), { statusCode: 400 });

        await tx.product.update({ where: { id: item.productId }, data: { currentStock: { decrement: qty } } });

        // Add to vehicle stock
        await tx.vehicleStock.upsert({
          where: { driverId_productId: { driverId, productId: item.productId } },
          update: { quantity: { increment: qty } },
          create: { shopId, driverId, productId: item.productId, quantity: qty }
        });
      }

      // Log
      await tx.driverLog.create({
        data: { shopId, driverId, action: 'STOCK_LOAD', details: `Loaded ${items.length} products` }
      });

      return load;
    });

    res.status(201).json(result);
  } catch (err) { next(err); }
};

// ── Unload Stock from Vehicle ─────────────────────────────
export const unloadStock = async (req, res, next) => {
  try {
    const { driverId, items, notes, loadDate } = req.body;
    const shopId = req.shopId;

    const result = await prisma.$transaction(async (tx) => {
      const load = await tx.vehicleLoad.create({
        data: {
          shopId, driverId,
          type: 'UNLOAD',
          notes,
          loadDate: loadDate ? new Date(loadDate) : new Date(),
          items: { create: items.map(i => ({ productId: i.productId, quantity: Number(i.quantity) })) }
        }
      });

      for (const item of items) {
        const qty = Number(item.quantity);
        const vs = await tx.vehicleStock.findUnique({ where: { driverId_productId: { driverId, productId: item.productId } } });
        if (!vs || Number(vs.quantity) < qty) throw Object.assign(new Error(`Insufficient vehicle stock`), { statusCode: 400 });

        await tx.vehicleStock.update({ where: { driverId_productId: { driverId, productId: item.productId } }, data: { quantity: { decrement: qty } } });
        await tx.product.update({ where: { id: item.productId }, data: { currentStock: { increment: qty } } });
      }

      await tx.driverLog.create({
        data: { shopId, driverId, action: 'STOCK_UNLOAD', details: `Unloaded ${items.length} products` }
      });

      return load;
    });

    res.status(201).json(result);
  } catch (err) { next(err); }
};

// ── Load History ──────────────────────────────────────────
export const getLoadHistory = async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const loads = await prisma.vehicleLoad.findMany({
      where: { driverId, shopId: req.shopId },
      include: {
        items: { include: { product: { select: { name: true, unitType: true, pricingTiers: true } } } }
      },
      orderBy: { loadDate: 'desc' },
      take: 50
    });
    res.json(loads);
  } catch (err) { next(err); }
};

// ── Driver Activity Logs ──────────────────────────────────
export const getDriverLogs = async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const logs = await prisma.driverLog.findMany({
      where: { driverId, driver: { shopId: req.shopId } },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json(logs);
  } catch (err) { next(err); }
};

// ── Driver Report (Owner View) ────────────────────────────
export const driverReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const shopId = req.shopId;
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(1));
    const end = endDate ? new Date(endDate) : new Date();

    const report = await prisma.$queryRaw`
      SELECT 
        d.id, d.name, d."loginId", d.vehicle,
        COUNT(s.id) as "totalBills",
        COALESCE(SUM(s."grandTotal"), 0) as "totalSales",
        COALESCE(SUM(s."paidAmount"), 0) as "totalCollected",
        COALESCE(SUM(s."balanceAmount"), 0) as "totalCredit"
      FROM drivers d
      LEFT JOIN sales s ON s."driverId" = d.id 
        AND s."saleDate" BETWEEN ${start} AND ${end}
      WHERE d."shopId" = ${shopId} AND d."isActive" = true
      GROUP BY d.id, d.name, d."loginId", d.vehicle
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

// ── Trip Settlement — Full Calculation ───────────────────
// Loaded → Sold → Returned → Cash/Credit breakdown
export const getDriverSettlement = async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const { startDate, endDate } = req.query;
    const shopId = req.shopId;

    // Set start to beginning of day and end to end of day (23:59:59.999)
    const start = startDate
      ? (() => { const d = new Date(startDate); d.setHours(0,0,0,0); return d; })()
      : (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
    const end = endDate
      ? (() => { const d = new Date(endDate); d.setHours(23,59,59,999); return d; })()
      : (() => { const d = new Date(); d.setHours(23,59,59,999); return d; })();

    // 1. LOADED — what was given to driver
    const loads = await prisma.vehicleLoad.findMany({
      where: { driverId, shopId, type: 'LOAD', loadDate: { gte: start, lte: end } },
      include: { items: { include: { product: { select: { id: true, name: true, unitType: true, purchasePrice: true, retailPrice: true, pricingTiers: true } } } } }
    });

    // 2. UNLOADED — what driver returned
    const unloads = await prisma.vehicleLoad.findMany({
      where: { driverId, shopId, type: 'UNLOAD', loadDate: { gte: start, lte: end } },
      include: { items: { include: { product: { select: { id: true, name: true, unitType: true, purchasePrice: true, retailPrice: true, pricingTiers: true } } } } }
    });

    // 3. SOLD — bills created by driver
    const sales = await prisma.sale.findMany({
      where: { driverId, shopId, saleDate: { gte: start, lte: end } },
      include: {
        items: { include: { product: { select: { id: true, name: true, unitType: true, purchasePrice: true, pricingTiers: true } } } },
        customer: { select: { name: true } },
        payments: true,
      }
    });

    const productMap = {};
    let totalProfit = 0;

    const ensureProduct = (p) => {
      if (!productMap[p.id]) {
        productMap[p.id] = {
          productId: p.id, name: p.name, unitType: p.unitType,
          pricingTiers: p.pricingTiers,
          purchasePrice: Number(p.purchasePrice || 0),
          retailPrice: Number(p.retailPrice || 0),
          loadedQty: 0, soldQty: 0, returnedQty: 0,
        };
      }
    };

    loads.forEach(load => {
      load.items.forEach(item => {
        ensureProduct(item.product);
        productMap[item.product.id].loadedQty += Number(item.quantity);
      });
    });

    sales.forEach(sale => {
      sale.items.forEach(item => {
        const p = item.product;
        ensureProduct(p);
        
        let baseMultiplier = getBaseMultiplier(p.pricingTiers, item.unitType || p.unitType, item.saleType || sale.saleType || 'retail');
        
        const qty = Number(item.quantity) * baseMultiplier;
        productMap[p.id].soldQty += qty;

        // Calculate dynamic cost per base unit
        let itemCostPrice = Number(p.purchasePrice) || 0;

        if (Array.isArray(p.pricingTiers)) {
          const matchedTier = findPricingTier(p.pricingTiers, item.saleType || sale.saleType || 'retail');
          if (matchedTier && Array.isArray(matchedTier.units)) {
            // Explicit cost match against the sold unitType
            const targetUnitType = item.unitType || p.unitType;
            const matchedUnit = matchedTier.units.find(u => u.name && normalizeString(u.name) === normalizeString(targetUnitType));
            if (matchedUnit && Number(matchedUnit.costPrice) > 0) {
              itemCostPrice = Number(matchedUnit.costPrice) / (baseMultiplier || 1);
            } else {
              itemCostPrice = (Number(p.purchasePrice) || 0);
            }
          }
        }

        // Sale amount (unitPrice * raw quantity) - discount
        const saleValueAfterDiscount = (Number(item.unitPrice) - Number(item.discount)) * Number(item.quantity);
        const totalItemsCost = itemCostPrice * qty; // Cost per base unit * base units
        
        totalProfit += (saleValueAfterDiscount - totalItemsCost);
      });
    });

    unloads.forEach(unload => {
      unload.items.forEach(item => {
        ensureProduct(item.product);
        productMap[item.product.id].returnedQty += Number(item.quantity);
      });
    });

    // Calculate missing qty (loaded - sold - returned = should be 0 ideally)
    const productSummary = Object.values(productMap).map(p => ({
      ...p,
      missingQty: Math.max(0, p.loadedQty - p.soldQty - p.returnedQty),
      loadedValue:  +(p.loadedQty   * p.purchasePrice).toFixed(2),
      soldValue:    +(p.soldQty     * p.retailPrice).toFixed(2),
      returnedValue:+(p.returnedQty * p.purchasePrice).toFixed(2),
    }));

    // 5. Cash / UPI / Card / Credit breakdown from sales
    const paymentBreakdown = { CASH: 0, UPI: 0, CARD: 0, CREDIT: 0 };
    sales.forEach(sale => {
      sale.payments.forEach(p => {
        paymentBreakdown[p.paymentMode] = (paymentBreakdown[p.paymentMode] || 0) + Number(p.amount);
      });
      if (Number(sale.balanceAmount) > 0) {
        paymentBreakdown.CREDIT += Number(sale.balanceAmount);
      }
    });

    const totalLoaded   = productSummary.reduce((s, p) => s + p.loadedQty, 0);
    const totalSold     = productSummary.reduce((s, p) => s + p.soldQty, 0);
    const totalReturned = productSummary.reduce((s, p) => s + p.returnedQty, 0);
    const totalMissing  = productSummary.reduce((s, p) => s + p.missingQty, 0);
    const totalSalesAmt = sales.reduce((s, sale) => s + Number(sale.grandTotal), 0);
    const totalCollected= sales.reduce((s, sale) => s + Number(sale.paidAmount), 0);
    const totalCredit   = sales.reduce((s, sale) => s + Number(sale.balanceAmount), 0);

    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: { name: true, vehicle: true, mobile: true }
    });

    res.json({
      driver,
      period: { from: start, to: end },
      productSummary,
      paymentBreakdown,
      totals: {
        totalLoaded, totalSold, totalReturned, totalMissing,
        totalSalesAmt, totalCollected, totalCredit,
        totalBills: sales.length,
        totalProfit // Exposing backend calculated profit to frontend
      },
      loads, unloads, sales,
    });
  } catch (err) { next(err); }
};

// ── Collect Payment from Customer (by Driver) ─────────────
export const collectPayment = async (req, res, next) => {
  try {
    const { customerId, amount, paymentMode = 'CASH', driverId, notes } = req.body;
    const shopId = req.shopId;

    if (!customerId || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'customerId and positive amount required' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Get customer
      const customer = await tx.customer.findFirst({ where: { id: customerId, shopId } });
      if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });

      const payAmt = Number(amount);
      const currentDue = Number(customer.currentBalance || 0);

      // Update customer balance
      await tx.customer.update({
        where: { id: customerId },
        data: { currentBalance: { decrement: payAmt } },
      });

      // Find the oldest unpaid sale(s) for this customer and reduce their balance
      const creditSales = await tx.sale.findMany({
        where: { customerId, shopId, balanceAmount: { gt: 0 } },
        orderBy: { saleDate: 'asc' },
      });

      let remaining = payAmt;
      for (const sale of creditSales) {
        if (remaining <= 0) break;
        const saleBalance = Number(sale.balanceAmount);
        const deduct = Math.min(remaining, saleBalance);
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            paidAmount:    { increment: deduct },
            balanceAmount: { decrement: deduct },
            isCredit:      saleBalance - deduct > 0,
          },
        });
        remaining -= deduct;
      }

      // Log driver action
      if (driverId) {
        await tx.driverLog.create({
          data: {
            shopId, driverId,
            action: 'PAYMENT_COLLECT',
            details: `Collected ${payAmt} from ${customer.name} via ${paymentMode}`,
          },
        });
      }

      return {
        customerId,
        customerName: customer.name,
        amount: payAmt,
        paymentMode,
        previousBalance: currentDue,
        newBalance: Math.max(0, currentDue - payAmt),
      };
    });

    res.json(result);
  } catch (err) { next(err); }
};

// ── Vehicle Dashboard (Owner) ─────────────────────────────
export const vehicleDashboard = async (req, res, next) => {
  try {
    const shopId = req.shopId;
    const { startDate, endDate } = req.query;
    const start = startDate
      ? (() => { const d = new Date(startDate); d.setHours(0,0,0,0); return d; })()
      : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();
    const end = endDate
      ? (() => { const d = new Date(endDate); d.setHours(23,59,59,999); return d; })()
      : (() => { const d = new Date(); d.setHours(23,59,59,999); return d; })();

    // Per-driver stats (parameterized for bulletproof timezone alignment)
    const driverStats = await prisma.$queryRaw`
      SELECT
        d.id, d.name, d.vehicle,
        CAST(COUNT(DISTINCT s.id)           AS INT)   AS "totalBills",
        CAST(COALESCE(SUM(s."grandTotal"),0) AS FLOAT) AS "totalSales",
        CAST(COALESCE(SUM(s."paidAmount"),0) AS FLOAT) AS "totalCollected",
        CAST(COALESCE(SUM(s."balanceAmount"),0) AS FLOAT) AS "totalCredit"
      FROM drivers d
      LEFT JOIN sales s ON s."driverId" = d.id
        AND s."saleDate" BETWEEN ${start} AND ${end}
      WHERE d."shopId" = ${shopId} AND d."isActive" = true
      GROUP BY d.id, d.name, d.vehicle
      ORDER BY "totalSales" DESC
    `;

    // Vehicle stock per driver
    const vehicleStocks = await prisma.vehicleStock.findMany({
      where: { shopId, quantity: { gt: 0 } },
      include: {
        product: { select: { name: true, unitType: true, retailPrice: true } },
        driver:  { select: { name: true, vehicle: true } },
      },
      orderBy: { driver: { name: 'asc' } },
    });

    // Total load this period (parameterized)
    const loadTotals = await prisma.$queryRaw`
      SELECT
        CAST(COALESCE(SUM(CASE WHEN vl.type = 'LOAD' THEN vli.quantity ELSE 0 END), 0) AS FLOAT) AS "totalLoaded",
        CAST(COALESCE(SUM(CASE WHEN vl.type = 'UNLOAD' THEN vli.quantity ELSE 0 END), 0) AS FLOAT) AS "totalUnloaded"
      FROM vehicle_loads vl
      JOIN vehicle_load_items vli ON vli."loadId" = vl.id
      WHERE vl."shopId" = ${shopId}
        AND vl."loadDate" BETWEEN ${start} AND ${end}
    `;

    const summary = {
      totalLoaded:    Number(loadTotals[0]?.totalLoaded   || 0),
      totalUnloaded:  Number(loadTotals[0]?.totalUnloaded || 0),
      totalSales:     driverStats.reduce((s, d) => s + d.totalSales, 0),
      totalCollected: driverStats.reduce((s, d) => s + d.totalCollected, 0),
      totalCredit:    driverStats.reduce((s, d) => s + d.totalCredit, 0),
      totalBills:     driverStats.reduce((s, d) => s + d.totalBills, 0),
      activeDrivers:  driverStats.length,
    };

    res.json({
      summary,
      drivers: driverStats.map(d => ({
        ...d,
        totalSales:     Number(d.totalSales),
        totalCollected: Number(d.totalCollected),
        totalCredit:    Number(d.totalCredit),
        totalBills:     Number(d.totalBills),
        vehicleStock:   vehicleStocks
          .filter(vs => vs.driverId === d.id)
          .map(vs => ({ name: vs.product.name, qty: Number(vs.quantity), unitType: vs.product.unitType })),
      })),
    });
  } catch (err) {
    console.error('Error in vehicleDashboard:', err);
    res.status(500).json({ error: 'Failed to load vehicle dashboard data', details: err.message });
  }
};
// ── Get Single Sale by ID (Driver) — for bill printing ────
export const getDriverSaleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const shopId = req.shopId; // set by authenticate middleware (works for driver token too)

    const sale = await prisma.sale.findFirst({
      where: { id, shopId },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                barcode: true,
                unitType: true,
                gstPercent: true,
                pricingTiers: true,
              }
            }
          }
        },
        customer: { select: { name: true, mobile: true } },
        payments: true,
      }
    });

    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    res.json(sale);
  } catch (err) { next(err); }
};
