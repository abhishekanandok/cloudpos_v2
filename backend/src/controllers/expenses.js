import prisma from '../config/prisma.js';

// ── List Expenses ─────────────────────────────────────────
export const getExpenses = async (req, res, next) => {
  try {
    const { startDate, endDate, categoryId, page = 1, limit = 30 } = req.query;
    const where = { shopId: req.shopId };
    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) where.expenseDate.gte = new Date(startDate);
      if (endDate) { const e = new Date(endDate); e.setHours(23,59,59,999); where.expenseDate.lte = e; }
    }
    if (categoryId) where.categoryId = categoryId;

    const [expenses, total, summary] = await prisma.$transaction([
      prisma.expense.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { expenseDate: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.expense.count({ where }),
      prisma.expense.aggregate({ where, _sum: { amount: true } })
    ]);

    res.json({
      expenses,
      pagination: { page: Number(page), total, pages: Math.ceil(total / Number(limit)) },
      totalAmount: summary._sum.amount || 0
    });
  } catch (err) { next(err); }
};

// ── Create Expense ────────────────────────────────────────
export const createExpense = async (req, res, next) => {
  try {
    const { categoryId, amount, description, expenseDate, notes } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });
    const expense = await prisma.expense.create({
      data: {
        shopId: req.shopId,
        categoryId: categoryId || null,
        amount,
        description,
        expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
        notes
      },
      include: { category: { select: { id: true, name: true } } }
    });
    res.status(201).json(expense);
  } catch (err) { next(err); }
};

// ── Update Expense ────────────────────────────────────────
export const updateExpense = async (req, res, next) => {
  try {
    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: req.body,
      include: { category: { select: { id: true, name: true } } }
    });
    res.json(expense);
  } catch (err) { next(err); }
};

// ── Delete Expense ────────────────────────────────────────
export const deleteExpense = async (req, res, next) => {
  try {
    await prisma.expense.delete({ where: { id: req.params.id } });
    res.json({ message: 'Expense deleted' });
  } catch (err) { next(err); }
};

// ── Expense Categories ────────────────────────────────────
export const getCategories = async (req, res, next) => {
  try {
    const cats = await prisma.expenseCategory.findMany({ where: { shopId: req.shopId } });
    res.json(cats);
  } catch (err) { next(err); }
};

export const createCategory = async (req, res, next) => {
  try {
    const cat = await prisma.expenseCategory.create({
      data: { shopId: req.shopId, name: req.body.name }
    });
    res.status(201).json(cat);
  } catch (err) { next(err); }
};
