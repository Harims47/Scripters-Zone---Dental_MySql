import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import {
  getTreatmentCatalog,
  getPatientTreatmentPlan,
  addTreatmentPlanItem,
  updateTreatmentPlanItem,
  deleteTreatmentPlanItem
} from '../controllers/treatmentController';

const router = Router({ mergeParams: true });

router.use(requireAuth);

// Treatment Catalog (Accessible by all clinical staff & receptionist)
router.get('/catalog', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getTreatmentCatalog);

// Patient Treatment Plan endpoints
// Note: These will be mounted at /api/patients/:patientId/treatment-plan

// Receptionist can only view
router.get('/:patientId/treatment-plan', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getPatientTreatmentPlan);

// Only doctors can modify
router.post('/:patientId/treatment-plan/items', requireRole('Head Doctor', 'Duty Doctor'), addTreatmentPlanItem);
router.patch('/:patientId/treatment-plan/items/:itemId', requireRole('Head Doctor', 'Duty Doctor'), updateTreatmentPlanItem);
router.delete('/:patientId/treatment-plan/items/:itemId', requireRole('Head Doctor', 'Duty Doctor'), deleteTreatmentPlanItem);

export default router;
