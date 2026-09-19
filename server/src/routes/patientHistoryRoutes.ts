import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { getPatientHistory, getHistoricalVisit } from '../controllers/patientHistoryController';

const router = Router({ mergeParams: true });

router.use(requireAuth);

// Receptionist, Duty Doctor, Head Doctor have read access
router.get('/:patientId/history', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getPatientHistory);
router.get('/:patientId/history/:visitId', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getHistoricalVisit);

export default router;
