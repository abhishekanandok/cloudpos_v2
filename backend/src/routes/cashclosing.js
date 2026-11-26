import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getClosingSummary, saveClosing, getClosings } from '../controllers/cashclosing.js';

const router = Router();
router.use(authenticate);
router.get('/summary', getClosingSummary);
router.get('/', getClosings);
router.post('/', saveClosing);
export default router;
