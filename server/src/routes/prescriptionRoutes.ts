import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import { upsertPrescriptionSchema } from '../schemas/prescriptionSchema';
import {
  upsertPrescription
} from '../controllers/prescriptionController';

const router = Router();

router.use(requireAuth);

router.post('/', requireRole('Head Doctor', 'Duty Doctor'), validateRequest(upsertPrescriptionSchema), upsertPrescription);

export default router;
