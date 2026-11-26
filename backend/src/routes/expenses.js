import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getExpenses, createExpense, updateExpense, deleteExpense, getCategories, createCategory } from '../controllers/expenses.js';

const router = Router();
router.use(authenticate);
router.get('/', getExpenses);
router.post('/', createExpense);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);
router.get('/categories', getCategories);
router.post('/categories', createCategory);
export default router;
