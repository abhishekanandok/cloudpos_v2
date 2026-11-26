import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createProduct, getProducts, getProductById,
  getByBarcode, updateProduct, deleteProduct,
  getLowStock, getDeadStock, getStockReport
} from '../controllers/products.js';

const router = Router();
router.use(authenticate);
router.get('/low-stock', getLowStock);
router.get('/dead-stock', getDeadStock);
router.get('/stock-report', getStockReport);
router.get('/barcode/:barcode', getByBarcode);
router.get('/', getProducts);
router.post('/', createProduct);
router.get('/:id', getProductById);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
export default router;
