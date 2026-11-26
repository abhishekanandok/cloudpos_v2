import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import prisma from '../config/prisma.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const items = await prisma.category.findMany({ where: { shopId: req.shopId, isActive: true }, orderBy: { name: 'asc' } });
    res.json(items);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const item = await prisma.category.create({ data: { name: req.body.name, shopId: req.shopId } });
    res.status(201).json(item);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Category already exists' });
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const item = await prisma.category.update({ where: { id: req.params.id }, data: { name: req.body.name } });
    res.json(item);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.category.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Category deleted' });
  } catch (e) { next(e); }
});

export default router;
