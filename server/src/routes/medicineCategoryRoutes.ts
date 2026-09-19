import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import { createCategorySchema, updateCategorySchema } from '../schemas/medicineCategorySchema';
import {
  getMedicineCategories,
  getMedicineCategoryById,
  createMedicineCategory,
  updateMedicineCategory,
  deactivateMedicineCategory,
  reactivateMedicineCategory,
  exportMedicineCategories
} from '../controllers/medicineCategoryController';

const router = Router();

router.use(requireAuth);

// Export & Read permissions align with Inventory & Suppliers
router.get('/export', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), exportMedicineCategories);
router.get('/', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getMedicineCategories);
router.get('/:id', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getMedicineCategoryById);

// Write permissions restricted to Head Doctor and Duty Doctor
router.post('/', requireRole('Head Doctor', 'Duty Doctor'), validateRequest(createCategorySchema), createMedicineCategory);
router.put('/:id', requireRole('Head Doctor', 'Duty Doctor'), validateRequest(updateCategorySchema), updateMedicineCategory);
router.patch('/:id/deactivate', requireRole('Head Doctor', 'Duty Doctor'), deactivateMedicineCategory);
router.patch('/:id/reactivate', requireRole('Head Doctor', 'Duty Doctor'), reactivateMedicineCategory);

export default router;
