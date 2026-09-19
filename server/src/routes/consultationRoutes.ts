import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import {
  createConsultationSchema,
  updateConsultationSchema,
  completeConsultationSchema
} from '../schemas/consultationSchema';
import {
  getConsultationByVisitId,
  createConsultation,
  updateConsultation,
  completeConsultation
} from '../controllers/consultationController';

const router = Router();

router.use(requireAuth);

router.get('/visit/:visitId', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getConsultationByVisitId);

// Clinical mutations strictly Head Doctor / Duty Doctor
router.post('/', requireRole('Head Doctor', 'Duty Doctor'), validateRequest(createConsultationSchema), createConsultation);
router.patch('/:id', requireRole('Head Doctor', 'Duty Doctor'), validateRequest(updateConsultationSchema), updateConsultation);
router.post('/visit/:visitId/complete', requireRole('Head Doctor', 'Duty Doctor'), validateRequest(completeConsultationSchema), completeConsultation);

export default router;
