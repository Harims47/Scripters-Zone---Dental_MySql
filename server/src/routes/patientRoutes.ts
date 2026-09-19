import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import { createPatientSchema, updatePatientSchema } from '../schemas/patientSchema';
import {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
  exportPatients
} from '../controllers/patientController';
import {
  inspectImportFile,
  validateImportFile,
  executeImportFile
} from '../controllers/patientImportController';

const router = Router();

// All patient endpoints require authentication
router.use(requireAuth);

// Bulk patient demographic import (strictly Head Doctor only)
router.post('/import/inspect', requireRole('Head Doctor'), inspectImportFile);
router.post('/import/validate', requireRole('Head Doctor'), validateImportFile);
router.post('/import/execute', requireRole('Head Doctor'), executeImportFile);

router.get('/export', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), exportPatients);
router.get('/', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getPatients);
router.get('/:id', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getPatientById);
router.post('/', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), validateRequest(createPatientSchema), createPatient);
router.patch('/:id', requireRole('Head Doctor', 'Receptionist'), validateRequest(updatePatientSchema), updatePatient);

export default router;
