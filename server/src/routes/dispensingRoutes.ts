import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import { completeDispensingSchema } from '../schemas/dispensingSchema';
import {
  getPendingDispensing,
  completeDispensing,
  exportDispensing
} from '../controllers/dispensingController';

const router = Router();

router.use(requireAuth);

router.get('/export', requireRole('Head Doctor', 'Receptionist'), exportDispensing);
router.get('/pending', requireRole('Head Doctor', 'Receptionist'), getPendingDispensing);

router.post('/complete', requireRole('Head Doctor', 'Receptionist'), validateRequest(completeDispensingSchema), completeDispensing);

export default router;
