import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import {
  getSupplierBills,
  getSupplierBillById,
  createSupplierBill,
  cancelSupplierBill,
  recordSupplierPayment,
  createSupplierBillSchema,
  recordSupplierPaymentSchema
} from '../controllers/supplierBillController';

const router = Router();

router.use(requireAuth);

router.get('/', getSupplierBills);
router.get('/:id', getSupplierBillById);

// Billing creation / cancellation restricted to authorized management
router.post('/', requireRole('Head Doctor'), validateRequest(createSupplierBillSchema), createSupplierBill);
router.patch('/:id/cancel', requireRole('Head Doctor'), cancelSupplierBill);

// Payment recording restricted to authorized management
router.post('/:id/payments', requireRole('Head Doctor'), validateRequest(recordSupplierPaymentSchema), recordSupplierPayment);

export default router;
