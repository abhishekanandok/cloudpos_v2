import prisma from '../config/prisma.js';

export const getCustomers = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 30 } = req.query;
    const where = { shopId: req.shopId, isActive: true };

    console.log(`[DEBUG customers.js] getCustomers called! userType: ${req.userType}, driverId: ${req.driverId}`);

    // Drivers can only see customers they created
    // Owners/staff see ALL customers (including driver-created ones)
    if (req.userType === 'driver') {
      where.createdByDriverId = req.driverId;
      console.log(`[DEBUG customers.js] where clause updated for driver:`, where);
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { mobile: { contains: search } },
            { gstNumber: { contains: search, mode: 'insensitive' } },
          ]
        }
      ];
    }
    const [customers, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where, orderBy: { name: 'asc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: { _count: { select: { sales: true } } },
      }),
      prisma.customer.count({ where }),
    ]);
    res.json({ customers, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

export const getCustomerById = async (req, res, next) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, shopId: req.shopId },
      include: {
        sales: { orderBy: { saleDate: 'desc' }, take: 10, select: { id: true, invoiceNumber: true, grandTotal: true, paidAmount: true, saleDate: true, paymentMode: true } },
        ledger: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) { next(err); }
};

export const createCustomer = async (req, res, next) => {
  try {
    const { name, mobile, address, gstNumber, creditLimit, openingBalance } = req.body;
    const customer = await prisma.customer.create({
      data: {
        shopId: req.shopId, name, mobile, address,
        gstNumber: gstNumber || null,
        creditLimit: creditLimit || 0,
        openingBalance: openingBalance || 0,
        currentBalance: openingBalance || 0,
        // Tag which driver created this customer (null if owner/staff)
        createdByDriverId: req.userType === 'driver' ? req.driverId : null,
      },
    });
    if (Number(openingBalance) > 0) {
      await prisma.customerLedger.create({
        data: {
          customerId: customer.id, type: 'DEBIT',
          amount: Number(openingBalance), balance: Number(openingBalance),
          description: 'Opening Balance',
        },
      });
    }
    res.status(201).json(customer);
  } catch (err) { next(err); }
};

export const updateCustomer = async (req, res, next) => {
  try {
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(customer);
  } catch (err) { next(err); }
};

export const deleteCustomer = async (req, res, next) => {
  try {
    await prisma.customer.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Customer deleted' });
  } catch (err) { next(err); }
};
