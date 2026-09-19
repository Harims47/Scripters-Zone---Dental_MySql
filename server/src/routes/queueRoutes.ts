import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import { transitionQueueSchema, assignDoctorSchema } from '../schemas/queueSchema';
import {
  getQueue,
  getQueueEntryById,
  transitionQueue,
  exportQueue,
  assignDoctor
} from '../controllers/queueController';

const router = Router();

router.use(requireAuth);

router.get('/export', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), exportQueue);
router.get('/', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getQueue);
router.get('/:id', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getQueueEntryById);

// Transition Queue handles RBAC internally based on action ('CALL_PATIENT' vs 'START_CONSULTATION')
router.patch('/:id/transition', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), validateRequest(transitionQueueSchema), transitionQueue);
router.patch('/:id/assign', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), validateRequest(assignDoctorSchema), assignDoctor);

export default router;
