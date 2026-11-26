import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getStaff, createStaff, updateStaff } from '../controllers/settings.js';
const router = Router();
router.use(authenticate);
router.get('/', getStaff);
router.post('/', createStaff);
router.put('/:id', updateStaff);
export default router;
