import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getSalesmen, createSalesman, updateSalesman, deleteSalesman, salesmanLogin, salesmanReport } from '../controllers/salesmen.js';

const router = Router();
router.post('/login', salesmanLogin);
router.use(authenticate);
router.get('/', getSalesmen);
router.post('/', createSalesman);
router.get('/report', salesmanReport);
router.put('/:id', updateSalesman);
router.delete('/:id', deleteSalesman);
export default router;
