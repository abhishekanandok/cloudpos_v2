// shop.js
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import prisma from '../config/prisma.js';

const router = Router();
router.use(authenticate);

router.get('/profile', async (req, res, next) => {
  try {
    const shop = await prisma.shop.findUnique({
      where: { id: req.shopId },
      select: { id: true, name: true, ownerName: true, email: true, mobile: true, logo: true, address: true, gstNumber: true, businessType: true, createdAt: true }
    });
    res.json(shop);
  } catch (err) { next(err); }
});

router.put('/profile', async (req, res, next) => {
  try {
    const { name, ownerName, address, gstNumber, businessType } = req.body;
    const shop = await prisma.shop.update({
      where: { id: req.shopId },
      data: { name, ownerName, address, gstNumber, businessType }
    });
    res.json(shop);
  } catch (err) { next(err); }
});

export default router;
