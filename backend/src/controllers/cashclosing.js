import prisma from '../config/prisma.js';

// ── Get Today's Closing Summary (pre-closing view) ────────
export const getClosingSummary = async (req, res, next) => {
  try {
    const shopId = req.shopId;
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(targetDate); start.setHours(0,0,0,0);
    const end = new Date(targetDate); end.setHours(23,59,59,999);

    const paymentBreakdown = await prisma.$queryRaw`
      SELECT sp."paymentMode", COALESCE(SUM(sp.amount), 0) as total
      FROM sale_payments sp
      JOIN sales s ON sp."saleId" = s.id
      WHERE s."shopId" = ${shopId} AND s."saleDate" BETWEEN ${start} AND ${end}
      GROUP BY sp."paymentMode"
    `;

    const creditSales = await prisma.sale.aggregate({
      where: { shopId, saleDate: { gte: start, lte: end }, isCredit: true },
      _sum: { balanceAmount: true }
    });

    const breakdown = { CASH: 0, UPI: 0, CARD: 0 };
    paymentBreakdown.forEach(r => { breakdown[r.paymentMode] = Number(r.total); });

    res.json({
      date: targetDate,
      cashSales: breakdown.CASH,
      upiSales: breakdown.UPI,
      cardSales: breakdown.CARD,
      creditSales: Number(creditSales._sum.balanceAmount || 0),
      expectedCash: breakdown.CASH,
    });
  } catch (err) { next(err); }
};

// ── Save Closing Entry ────────────────────────────────────
export const saveClosing = async (req, res, next) => {
  try {
    const { closingDate, actualCash, expectedCash, totalCashSales, totalUpiSales, totalCardSales, totalCreditSales, notes } = req.body;
    const diff = Number(actualCash) - Number(expectedCash);
    const closing = await prisma.dailyCashClosing.create({
      data: {
        shopId: req.shopId,
        closingDate: closingDate ? new Date(closingDate) : new Date(),
        expectedCash: Number(expectedCash),
        actualCash: Number(actualCash),
        difference: diff,
        totalCashSales: Number(totalCashSales || 0),
        totalUpiSales: Number(totalUpiSales || 0),
        totalCardSales: Number(totalCardSales || 0),
        totalCreditSales: Number(totalCreditSales || 0),
        notes,
        closedBy: req.shopId
      }
    });
    res.status(201).json(closing);
  } catch (err) { next(err); }
};

// ── List Past Closings ────────────────────────────────────
export const getClosings = async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const [closings, total] = await prisma.$transaction([
      prisma.dailyCashClosing.findMany({
        where: { shopId: req.shopId },
        orderBy: { closingDate: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit)
      }),
      prisma.dailyCashClosing.count({ where: { shopId: req.shopId } })
    ]);
    res.json({ closings, pagination: { page: Number(page), total, pages: Math.ceil(total / Number(limit)) } });
  } catch (err) { next(err); }
};
