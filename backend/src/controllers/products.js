import prisma from '../config/prisma.js';

const generateMissingBarcodes = (tiers) => {
  if (!Array.isArray(tiers)) return tiers;
  return tiers.map(tier => {
    if (!tier.barcode || tier.barcode.trim() === '') {
      tier.barcode = Math.floor(Math.random() * 900000000000) + 100000000000 + '';
    }
    return tier;
  });
};

export const createProduct = async (req, res, next) => {
  try {
    const {
      name, brandId, categoryId, barcode, unitType,
      purchasePrice, retailPrice, minRetailQty, wholesalePrice, minWholesaleQty,
      semiWholesalePrice, minSemiWholesaleQty, salesmanPrice, gstPercent, openingStock,
      minStockAlert, defaultSaleType, pricingTiers, loyaltyCoins, loyaltyValue
    } = req.body;

    const processedTiers = generateMissingBarcodes(pricingTiers || []);

    const product = await prisma.product.create({
      data: {
        shopId: req.shopId, name,
        brandId: brandId || null, categoryId: categoryId || null,
        barcode: barcode || null, unitType: unitType || 'PCS',
        purchasePrice: purchasePrice || 0, retailPrice: retailPrice || 0,
        minRetailQty: minRetailQty || 1, wholesalePrice: wholesalePrice || 0,
        minWholesaleQty: minWholesaleQty || 12, semiWholesalePrice: semiWholesalePrice || 0,
        minSemiWholesaleQty: minSemiWholesaleQty || 6,
        salesmanPrice: salesmanPrice || 0,
        gstPercent: gstPercent || 0, openingStock: openingStock || 0,
        currentStock: openingStock || 0, minStockAlert: minStockAlert || 0,
        defaultSaleType: defaultSaleType || 'RETAIL',
        loyaltyCoins: loyaltyCoins || 0, loyaltyValue: loyaltyValue || 0,
        pricingTiers: processedTiers,
      },
      include: { category: true, brand: true }
    });
    res.status(201).json(product);
  } catch (err) { next(err); }
};

export const getProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search, categoryId, brandId, barcode } = req.query;
    const where = { shopId: req.shopId, isActive: true };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { brand: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (barcode) where.barcode = barcode;
    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } }
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: Number(limit),
      }),
      prisma.product.count({ where })
    ]);

    res.json({ products, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

export const getProductById = async (req, res, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, shopId: req.shopId },
      include: { category: true, brand: true }
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) { next(err); }
};

export const getByBarcode = async (req, res, next) => {
  try {
    const { barcode } = req.params;
    // Check main barcode
    let product = await prisma.product.findFirst({
      where: { shopId: req.shopId, barcode, isActive: true },
      include: { category: { select: { name: true } }, brand: { select: { name: true } } }
    });
    // If not found, search in pricingTiers JSON
    if (!product) {
      const allProducts = await prisma.product.findMany({
        where: { shopId: req.shopId, isActive: true },
        include: { category: { select: { name: true } }, brand: { select: { name: true } } }
      });
      product = allProducts.find(p =>
        Array.isArray(p.pricingTiers) && p.pricingTiers.some(t => t.barcode === barcode)
      ) || null;
    }
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) { next(err); }
};

export const updateProduct = async (req, res, next) => {
  try {
    const data = { ...req.body };
    delete data.id; delete data.createdAt; delete data.updatedAt;
    delete data.category; delete data.brand; delete data.shop;
    // Never allow currentStock to be overwritten via product edit
    // Stock is managed exclusively through stock adjustment endpoints
    delete data.currentStock;
    if (data.brandId === '') data.brandId = null;
    if (data.categoryId === '') data.categoryId = null;
    if (data.pricingTiers) data.pricingTiers = generateMissingBarcodes(data.pricingTiers);

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data,
      include: { category: true, brand: true }
    });
    res.json(product);
  } catch (err) { next(err); }
};

export const deleteProduct = async (req, res, next) => {
  try {
    await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Product deleted' });
  } catch (err) { next(err); }
};

// ── Low Stock (fixed - uses raw SQL) ──────────────────────
export const getLowStock = async (req, res, next) => {
  try {
    const products = await prisma.$queryRaw`
      SELECT p.*, c.name as "categoryName", b.name as "brandName"
      FROM products p
      LEFT JOIN categories c ON p."categoryId" = c.id
      LEFT JOIN brands b ON p."brandId" = b.id
      WHERE p."shopId" = ${req.shopId}
        AND p."isActive" = true
        AND p."minStockAlert" > 0
        AND p."currentStock" <= p."minStockAlert"
      ORDER BY (p."currentStock" - p."minStockAlert") ASC
    `;
    res.json(products);
  } catch (err) { next(err); }
};

// ── Dead Stock Report ─────────────────────────────────────
export const getDeadStock = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(days));

    const products = await prisma.$queryRaw`
      SELECT 
        p.id, p.name, p.barcode, p."currentStock", p."unitType",
        p."purchasePrice", p."retailPrice",
        MAX(s."saleDate") as "lastSaleDate",
        CURRENT_DATE - MAX(s."saleDate")::date as "daysSinceLastSale"
      FROM products p
      LEFT JOIN sale_items si ON si."productId" = p.id
      LEFT JOIN sales s ON si."saleId" = s.id
      WHERE p."shopId" = ${req.shopId}
        AND p."isActive" = true
        AND p."currentStock" > 0
      GROUP BY p.id, p.name, p.barcode, p."currentStock", p."unitType", p."purchasePrice", p."retailPrice"
      HAVING MAX(s."saleDate") < ${cutoff} OR MAX(s."saleDate") IS NULL
      ORDER BY "lastSaleDate" ASC NULLS FIRST
    `;
    res.json(products.map(p => ({
      ...p,
      currentStock: Number(p.currentStock),
      purchasePrice: Number(p.purchasePrice),
      retailPrice: Number(p.retailPrice),
      daysSinceLastSale: p.daysSinceLastSale ? Number(p.daysSinceLastSale) : null,
    })));
  } catch (err) { next(err); }
};

// ── Full Stock Report (for PDF print) ────────────────────
export const getStockReport = async (req, res, next) => {
  try {
    // Fetch all active products with category & brand
    const products = await prisma.product.findMany({
      where: { shopId: req.shopId, isActive: true },
      include: {
        category: { select: { name: true } },
        brand:    { select: { name: true } },
      },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    });

    // Fetch all vehicle stocks for this shop with driver info
    const vehicleStocks = await prisma.vehicleStock.findMany({
      where: { shopId: req.shopId, quantity: { gt: 0 } },
      include: {
        driver:  { select: { id: true, name: true } },
        product: { select: { id: true } },
      },
    });

    // Build a map: productId -> [{ driverName, quantity }]
    const vehicleMap = {};
    for (const vs of vehicleStocks) {
      const pid = vs.product.id;
      if (!vehicleMap[pid]) vehicleMap[pid] = [];
      vehicleMap[pid].push({ driverName: vs.driver.name, quantity: Number(vs.quantity) });
    }

    const report = products.map(p => ({
      id:                  p.id,
      name:                p.name,
      barcode:             p.barcode || '',
      category:            p.category?.name || '',
      brand:               p.brand?.name    || '',
      unitType:            p.unitType,
      purchasePrice:       Number(p.purchasePrice),
      retailPrice:         Number(p.retailPrice),
      wholesalePrice:      Number(p.wholesalePrice),
      semiWholesalePrice:  Number(p.semiWholesalePrice),
      salesmanPrice:       Number(p.salesmanPrice),
      gstPercent:          Number(p.gstPercent),
      currentStock:        Number(p.currentStock),
      minStockAlert:       Number(p.minStockAlert),
      pricingTiers:        p.pricingTiers || [],
      driverStock:         vehicleMap[p.id] || [],
    }));

    res.json({ products: report, generatedAt: new Date() });
  } catch (err) { next(err); }
};
