import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getBranches, createBranch } from '../controllers/settings.js';
const router = Router();
router.use(authenticate);
router.get('/', getBranches);
router.post('/', createBranch);
export default router;
