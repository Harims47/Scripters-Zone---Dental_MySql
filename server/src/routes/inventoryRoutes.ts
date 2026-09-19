import { Router } from 'express';
import { requireAuth, requireRole, requireModule } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import { adjustStockSchema, createMedicineSchema, updateMedicineSchema } from '../schemas/inventorySchema';
import {
  getInventory,
  getMedicine,
  createMedicine,
  updateMedicine,
  adjustStock,
  exportInventory,
  getMedicineStockHistory,
  deleteMedicine,
  deactivateMedicine,
  reactivateMedicine
} from '../controllers/inventoryController';
import { getLowStockAlerts } from '../controllers/lowStockController';

const router = Router();

router.use(requireAuth);

router.get('/export', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), requireModule('Inventory'), exportInventory);
router.get('/low-stock-alerts', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getLowStockAlerts);
router.get('/', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getInventory);
router.get('/:id/history', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getMedicineStockHistory);
router.get('/:id', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getMedicine);

// Inventory adjustments and modifications require the Inventory module
router.patch('/:id/adjust', requireRole('Head Doctor', 'Duty Doctor'), requireModule('Inventory'), validateRequest(adjustStockSchema), adjustStock);
router.post('/', requireRole('Head Doctor', 'Duty Doctor'), requireModule('Inventory'), validateRequest(createMedicineSchema), createMedicine);
router.put('/:id', requireRole('Head Doctor', 'Duty Doctor'), requireModule('Inventory'), validateRequest(updateMedicineSchema), updateMedicine);
router.patch('/:id/deactivate', requireRole('Head Doctor', 'Duty Doctor'), requireModule('Inventory'), deactivateMedicine);
router.patch('/:id/reactivate', requireRole('Head Doctor', 'Duty Doctor'), requireModule('Inventory'), reactivateMedicine);
router.delete('/:id', requireRole('Head Doctor'), requireModule('Inventory'), deleteMedicine);

export default router;

