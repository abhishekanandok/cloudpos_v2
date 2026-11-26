import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getDrivers, createDriver, updateDriver, deleteDriver,
  driverLogin, getVehicleStock, loadStock, unloadStock,
  getLoadHistory, getDriverLogs, driverReport, getDriverSettlement,
  collectPayment, vehicleDashboard, getDriverSaleById,
} from '../controllers/drivers.js';


const router = Router();

// Public — driver login (no auth needed)
router.post('/login', driverLogin);

// All routes below require owner/staff authentication
router.use(authenticate);
router.get('/',                      getDrivers);
router.post('/',                     createDriver);
router.get('/report',                driverReport);
router.get('/dashboard',             vehicleDashboard);
router.post('/load',                 loadStock);
router.post('/unload',               unloadStock);
router.post('/collect-payment',      collectPayment);
router.put('/:id',                   updateDriver);
router.delete('/:id',                deleteDriver);
router.get('/:driverId/stock',       getVehicleStock);
router.get('/:driverId/loads',       getLoadHistory);
router.get('/:driverId/logs',        getDriverLogs);
router.get('/:driverId/settlement',  getDriverSettlement);

// Driver-accessible routes (work with driver_token — authenticate sets req.shopId from driver)
router.get('/sale/:id',              getDriverSaleById);


export default router;
