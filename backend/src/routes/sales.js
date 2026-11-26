import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { createSale, updateSale, getSales, getSaleById, getDailySummary } from '../controllers/sales.js';

const router = Router();
router.use(authenticate);
router.get('/summary/daily', getDailySummary);
router.get('/', getSales);
router.post('/', createSale);
router.put('/:id', updateSale);
router.get('/:id', getSaleById);
export default router;
