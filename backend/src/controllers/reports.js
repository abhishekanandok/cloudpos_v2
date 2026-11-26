import prisma from '../config/prisma.js';
import { getBaseMultiplier } from '../utils/stockUtils.js';

// ── Daily Sales Report ────────────────────────────────────
export const dailySalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const shopId = req.shopId;

    const start = startDate ? new Date(`${startDate}T00:00:00.000`) : new Date(new Date().setHours(0,0,0,0));
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : new Date(new Date().setHours(23,59,59,999));

    const sales = await prisma.sale.findMany({
      where: { shopId, saleDate: { gte: start, lte: end } },
      include: {
        customer: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } }
      },
      orderBy: { saleDate: 'asc' }
    });

    const summary = await prisma.sale.aggregate({
      where: { shopId, saleDate: { gte: start, lte: end } },
      _sum: { grandTotal: true, paidAmount: true, balanceAmount: true, totalGst: true, totalDiscount: true },
      _count: { id: true }
    });

    const paymentBreakdownQuery = await prisma.$queryRaw`
      SELECT sp."paymentMode", SUM(sp.amount) as amount, CAST(COUNT(sp.id) AS INTEGER) as "count"
      FROM sale_payments sp
      JOIN sales s ON sp."saleId" = s.id
      WHERE s."shopId" = ${shopId} AND s."saleDate" BETWEEN ${start} AND ${end}
      GROUP BY sp."paymentMode"
    `;

    const paymentBreakdown = paymentBreakdownQuery.map(row => ({
      paymentMode: row.paymentMode,
      _sum: { paidAmount: Number(row.amount) || 0 },
      _count: { id: Number(row.count) || 0 }
    }));

    res.json({ sales, summary: summary._sum, totalSales: summary._count.id, paymentBreakdown });
  } catch (err) { next(err); }
};

// ── Monthly Sales Report ──────────────────────────────────
export const monthlySalesReport = async (req, res, next) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    const shopId = req.shopId;

    const data = await prisma.$queryRaw`
      SELECT 
        EXTRACT(MONTH FROM "saleDate") as month,
        TO_CHAR("saleDate", 'Mon') as "monthName",
        COUNT(*) as "totalSales",
        SUM("grandTotal") as "revenue",
        SUM("paidAmount") as "collected",
        SUM("totalGst") as "gst"
      FROM sales
      WHERE "shopId" = ${shopId}
        AND EXTRACT(YEAR FROM "saleDate") = ${Number(year)}
      GROUP BY EXTRACT(MONTH FROM "saleDate"), TO_CHAR("saleDate", 'Mon')
      ORDER BY month
    `;

    res.json(data);
  } catch (err) { next(err); }
};

// ── Daily History Report (All Time Dashboard) ───────────────
export const historyReport = async (req, res, next) => {
  try {
    const shopId = req.shopId;
    
    // Fetch all sales and minimum required fields to aggregate daily history
    const sales = await prisma.sale.findMany({
      where: { shopId },
      select: {
          saleDate: true,
          grandTotal: true,
          paidAmount: true,
          items: {
              select: {
                  quantity: true,
                  totalAmount: true,
                  unitType: true,
                  saleType: true,
                  product: {
                      select: { purchasePrice: true, pricingTiers: true }
                  }
              }
          }
      },
      orderBy: { saleDate: 'desc' }
    });

    const dailyMap = {};
    
    sales.forEach(s => {
       // get YYYY-MM-DD in local time ideally, but UTC is standard for DB dates.
       // Let's adjust to local ISO date string by adding offset, or just use string split
       // Since saleDate is a JS Date object, creating an ISO string gives UTC time.
       // Assuming DB stores UTC, getting local date:
       const date = new Date(s.saleDate.getTime() - (s.saleDate.getTimezoneOffset() * 60000));
       const dateStr = date.toISOString().split('T')[0];
       
       if (!dailyMap[dateStr]) {
           dailyMap[dateStr] = {
              date: dateStr,
              bills: 0,
              revenue: 0,
              collected: 0,
              profit: 0
           };
       }
       const d = dailyMap[dateStr];
       d.bills += 1;
       d.revenue += Number(s.grandTotal);
       d.collected += Number(s.paidAmount);
       
       // Calculate profit for this sale
       let saleProfit = 0;
        s.items.forEach(si => {
            const p = si.product;
            const baseMultiplier = getBaseMultiplier(p.pricingTiers, si.unitType, si.saleType);
            const totalDeductionQty = Number(si.quantity) * baseMultiplier;
            const costOfGoods = totalDeductionQty * Number(p.purchasePrice);
            const revenue = Number(si.totalAmount);
            saleProfit += (revenue - costOfGoods);
        });
       d.profit += saleProfit;
    });
    
    const sortedHistory = Object.values(dailyMap).sort((a,b) => new Date(b.date) - new Date(a.date));
    res.json(sortedHistory);
  } catch (err) { next(err); }
};

// ── Profit Report ─────────────────────────────────────────
export const profitReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const shopId = req.shopId;

    const start = startDate ? new Date(`${startDate}T00:00:00.000`) : new Date(new Date().setDate(1));
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : new Date();

    const salesItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          shopId,
          saleDate: { gte: start, lte: end }
        }
      },
      include: {
        product: { select: { id: true, name: true, purchasePrice: true, pricingTiers: true } }
      }
    });

    const profitMap = {};

    salesItems.forEach(si => {
      const p = si.product;
      const baseMultiplier = getBaseMultiplier(p.pricingTiers, si.unitType, si.saleType);

      const totalDeductionQty = Number(si.quantity) * baseMultiplier;
      const costOfGoods = totalDeductionQty * Number(p.purchasePrice);
      const revenue = Number(si.totalAmount);
      const grossProfit = revenue - costOfGoods;

      if (!profitMap[p.id]) {
        profitMap[p.id] = {
          productId: p.id,
          productName: p.name,
          qtySold: 0,
          revenue: 0,
          costOfGoods: 0,
          grossProfit: 0
        };
      }

      profitMap[p.id].qtySold += totalDeductionQty;
      profitMap[p.id].revenue += revenue;
      profitMap[p.id].costOfGoods += costOfGoods;
      profitMap[p.id].grossProfit += grossProfit;
    });

    const salesData = Object.values(profitMap).sort((a, b) => b.grossProfit - a.grossProfit);

    const totals = salesData.reduce((acc, item) => ({
      revenue: acc.revenue + item.revenue,
      costOfGoods: acc.costOfGoods + item.costOfGoods,
      grossProfit: acc.grossProfit + item.grossProfit,
    }), { revenue: 0, costOfGoods: 0, grossProfit: 0 });

    res.json({ items: salesData, totals });
  } catch (err) { next(err); }
};

// ── Top Selling Products (Enhanced) ──────────────────────
export const topProducts = async (req, res, next) => {
  try {
    const {
      startDate, endDate,
      limit = 20,
      categoryId,
      branchId,
      vehicleOnly,
      sortBy = 'revenue',   // 'revenue' | 'qty'
    } = req.query;
    const shopId = req.shopId;

    const start = startDate ? new Date(`${startDate}T00:00:00.000`) : new Date(new Date().setDate(1));
    const end   = endDate   ? new Date(`${endDate}T23:59:59.999`)   : new Date();

    // Build optional WHERE fragments
    const catFilter     = categoryId  ? `AND p."categoryId" = '${categoryId}'`  : '';
    const branchFilter  = branchId    ? `AND s."branchId"   = '${branchId}'`    : '';
    // Vehicle sales: sales that have a driverId (loaded by a driver)
    const vehicleFilter = vehicleOnly === 'true' ? `AND s."driverId" IS NOT NULL` : '';
    const orderCol      = sortBy === 'qty' ? '"totalQty"' : '"totalRevenue"';

    const products = await prisma.$queryRawUnsafe(`
      SELECT
        p.id,
        p.name,
        p.barcode,
        p."unitType",
        c.name  AS "categoryName",
        b.name  AS "brandName",
        CAST(SUM(si.quantity)             AS FLOAT) AS "totalQty",
        CAST(SUM(si."totalAmount")        AS FLOAT) AS "totalRevenue",
        CAST(COUNT(DISTINCT si."saleId")  AS INT)   AS "totalOrders"
      FROM sale_items si
      JOIN sales    s  ON si."saleId"    = s.id
      JOIN products p  ON si."productId" = p.id
      LEFT JOIN categories c ON p."categoryId" = c.id
      LEFT JOIN brands     b ON p."brandId"    = b.id
      WHERE s."shopId"   = '${shopId}'
        AND s."saleDate" BETWEEN '${start.toISOString()}' AND '${end.toISOString()}'
        ${catFilter}
        ${branchFilter}
        ${vehicleFilter}
      GROUP BY p.id, p.name, p.barcode, p."unitType", c.name, b.name
      ORDER BY ${orderCol} DESC
      LIMIT ${Math.min(Number(limit), 100)}
    `);

    // Compute totals for share %
    const totalRevenue = products.reduce((s, p) => s + (p.totalRevenue || 0), 0);
    const totalQty     = products.reduce((s, p) => s + (p.totalQty     || 0), 0);

    const result = products.map((p, i) => ({
      rank:           i + 1,
      id:             p.id,
      name:           p.name,
      barcode:        p.barcode,
      unitType:       p.unitType,
      categoryName:   p.categoryName,
      brandName:      p.brandName,
      totalQty:       Number(p.totalQty     || 0),
      totalRevenue:   Number(p.totalRevenue || 0),
      totalOrders:    Number(p.totalOrders  || 0),
      revenueShare:   totalRevenue > 0 ? ((p.totalRevenue / totalRevenue) * 100).toFixed(1) : '0.0',
      qtyShare:       totalQty     > 0 ? ((p.totalQty     / totalQty)     * 100).toFixed(1) : '0.0',
    }));

    res.json({
      products: result,
      summary: {
        totalProducts: result.length,
        totalQty:      Number(totalQty.toFixed(2)),
        totalRevenue:  Number(totalRevenue.toFixed(2)),
        topProduct:    result[0]?.name || null,
      },
    });
  } catch (err) { next(err); }
};


// ── Current Stock Report ──────────────────────────────────
export const stockReport = async (req, res, next) => {
  try {
    const { categoryId, lowStock } = req.query;
    const where = { shopId: req.shopId, isActive: true };

    if (categoryId) where.categoryId = categoryId;

    let products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } }
      },
      orderBy: { name: 'asc' }
    });

    if (lowStock === 'true') {
      products = products.filter(p => 
        Number(p.minStockAlert) > 0 && 
        Number(p.currentStock) <= Number(p.minStockAlert)
      );
    }

    const totalValue = products.reduce((sum, p) => 
      sum + Number(p.currentStock) * Number(p.purchasePrice), 0
    );

    res.json({ products, totalStockValue: totalValue, totalProducts: products.length });
  } catch (err) { next(err); }
};

// ── Purchase Report ───────────────────────────────────────
export const purchaseReport = async (req, res, next) => {
  try {
    const { startDate, endDate, supplierId } = req.query;
    const shopId = req.shopId;

    const where = { shopId };
    if (startDate || endDate) {
      where.purchaseDate = {};
      if (startDate) where.purchaseDate.gte = new Date(`${startDate}T00:00:00.000`);
      if (endDate) where.purchaseDate.lte = new Date(`${endDate}T23:59:59.999`);
    }
    if (supplierId) where.supplierId = supplierId;

    const [purchases, summary] = await prisma.$transaction([
      prisma.purchase.findMany({
        where,
        include: {
          supplier: { select: { name: true } },
          _count: { select: { items: true } }
        },
        orderBy: { purchaseDate: 'desc' }
      }),
      prisma.purchase.aggregate({
        where,
        _sum: { grandTotal: true, paidAmount: true, balanceAmount: true, totalGst: true },
        _count: { id: true }
      })
    ]);

    res.json({ purchases, summary: summary._sum, totalPurchases: summary._count.id });
  } catch (err) { next(err); }
};
