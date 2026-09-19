import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import {
  getTreatmentCatalog,
  getPatientTreatmentPlan,
  addTreatmentPlanItem,
  updateTreatmentPlanItem,
  deleteTreatmentPlanItem
} from '../controllers/treatmentController';

// Catalog router mounted at /api/treatments
const treatmentRoutes = Router();
treatmentRoutes.use(requireAuth);
treatmentRoutes.get('/catalog', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getTreatmentCatalog);

// Dedicated patient treatment plan router mounted at /api/patients
export const patientTreatmentRouter = Router({ mergeParams: true });
patientTreatmentRouter.use(requireAuth);

// Receptionist can only view
patientTreatmentRouter.get('/:patientId/treatment-plan', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getPatientTreatmentPlan);

// Only doctors can modify
patientTreatmentRouter.post('/:patientId/treatment-plan/items', requireRole('Head Doctor', 'Duty Doctor'), addTreatmentPlanItem);
patientTreatmentRouter.patch('/:patientId/treatment-plan/items/:itemId', requireRole('Head Doctor', 'Duty Doctor'), updateTreatmentPlanItem);
patientTreatmentRouter.delete('/:patientId/treatment-plan/items/:itemId', requireRole('Head Doctor', 'Duty Doctor'), deleteTreatmentPlanItem);

export default treatmentRoutes;
