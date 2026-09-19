import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import { createPaymentSchema } from '../schemas/paymentSchema';
import {
  getPayments,
  getPayment,
  createPayment,
  exportPayments,
  exportPartialPayments
} from '../controllers/paymentController';

const router = Router();

router.use(requireAuth);

// Payments access
router.get('/export-partial', requireRole('Head Doctor', 'Receptionist'), exportPartialPayments);
router.get('/export', requireRole('Head Doctor', 'Receptionist'), exportPayments);
router.get('/', requireRole('Head Doctor', 'Receptionist'), getPayments);
router.get('/:id', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getPayment);
router.post('/', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), validateRequest(createPaymentSchema), createPayment);

export default router;
