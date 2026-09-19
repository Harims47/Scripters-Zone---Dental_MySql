import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import { createSupplierSchema, updateSupplierSchema } from '../schemas/supplierSchema';
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deactivateSupplier,
  exportSuppliers
} from '../controllers/supplierController';

const router = Router();

router.use(requireAuth);

// Head Doctor and Duty Doctor have inventory management roles
router.get('/export', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), exportSuppliers);
router.get('/', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getSuppliers);
router.get('/:id', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getSupplierById);
router.post('/', requireRole('Head Doctor', 'Duty Doctor'), validateRequest(createSupplierSchema), createSupplier);
router.put('/:id', requireRole('Head Doctor', 'Duty Doctor'), validateRequest(updateSupplierSchema), updateSupplier);
router.patch('/:id/deactivate', requireRole('Head Doctor', 'Duty Doctor'), deactivateSupplier);

export default router;
