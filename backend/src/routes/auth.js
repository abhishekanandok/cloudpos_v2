import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, staffLogin, verifyEmail, getMe, changePassword } from '../controllers/auth.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.post('/register', [
  body('shopName').notEmpty().trim(),
  body('ownerName').notEmpty().trim(),
  body('mobile').isMobilePhone(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  validate
], register);

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate
], login);

router.post('/staff/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate
], staffLogin);

router.get('/verify-email', verifyEmail);

router.get('/me', authenticate, getMe);

router.put('/change-password', authenticate, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 }),
  validate
], changePassword);

export default router;
