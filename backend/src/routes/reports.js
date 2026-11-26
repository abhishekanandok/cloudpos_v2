import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  dailySalesReport, monthlySalesReport, profitReport,
  topProducts, stockReport, purchaseReport, historyReport
} from '../controllers/reports.js';

const router = Router();
router.use(authenticate);
router.get('/sales/daily', dailySalesReport);
router.get('/sales/monthly', monthlySalesReport);
router.get('/sales/history', historyReport);
router.get('/profit', profitReport);
router.get('/top-products', topProducts);
router.get('/stock', stockReport);
router.get('/purchases', purchaseReport);
export default router;
