import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import shopRoutes from './routes/shop.js';
import productRoutes from './routes/products.js';
import categoryRoutes from './routes/categories.js';
import brandRoutes from './routes/brands.js';
import customerRoutes from './routes/customers.js';
import supplierRoutes from './routes/suppliers.js';
import purchaseRoutes from './routes/purchases.js';
import saleRoutes from './routes/sales.js';
import stockRoutes from './routes/stock.js';
import reportRoutes from './routes/reports.js';
import ledgerRoutes from './routes/ledger.js';
import settingsRoutes from './routes/settings.js';
import staffRoutes from './routes/staff.js';
import branchRoutes from './routes/branches.js';
import salesmenRoutes from './routes/salesmen.js';
import expensesRoutes from './routes/expenses.js';
import cashClosingRoutes from './routes/cashclosing.js';
import driverRoutes from './routes/drivers.js';

dotenv.config();

// Fix for "Do not know how to serialize a BigInt" when using Prisma aggregations
BigInt.prototype.toJSON = function() {
  return this.toString();
};

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5001;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, message: { error: 'Too many requests' } });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many auth attempts' } });
app.use('/api', limiter);
app.use('/api/auth', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/salesmen', salesmenRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/cash-closing', cashClosingRoutes);
app.use('/api/drivers', driverRoutes);

app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 CloudPOS API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});

export default app;
