import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getPurchases,
  getPurchaseById,
  createPurchase,
  recordPayment,
  deletePurchase,
} from '../controllers/purchases.js';

const router = Router();
router.use(authenticate);

router.get('/', getPurchases);
router.get('/:id', getPurchaseById);

router.post('/', [
  body('items').isArray({ min: 1 }).withMessage('At least one item required'),
  body('items.*.productId').notEmpty(),
  body('items.*.quantity').isFloat({ min: 0.001 }),
  body('items.*.purchasePrice').isFloat({ min: 0 }),
  validate,
], createPurchase);

router.post('/:id/payment', [
  body('amount').isFloat({ min: 0.01 }),
  body('paymentMode').notEmpty(),
  validate,
], recordPayment);

router.delete('/:id', deletePurchase);

export default router;
