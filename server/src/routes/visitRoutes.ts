import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import { startWalkInVisitSchema, checkInAppointmentSchema, updateVisitSchema, transferVisitsSchema, applyDoctorDiscountSchema } from '../schemas/visitSchema';
import {
  getVisits,
  getVisitById,
  startWalkInVisit,
  checkInAppointment,
  cancelVisit,
  updateVisit,
  exportVisits,
  transferVisits,
  applyDoctorDiscount
} from '../controllers/visitController';

const router = Router();

router.use(requireAuth);

router.get('/export', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), exportVisits);
router.get('/', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getVisits);
router.get('/:id', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getVisitById);

// Apply doctor-authorized discount (Head Doctor, Duty Doctor only)
router.post('/:id/doctor-discount', requireRole('Head Doctor', 'Duty Doctor'), validateRequest(applyDoctorDiscountSchema), applyDoctorDiscount);

// Transfer visits to next day
router.post('/transfer', requireRole('Head Doctor', 'Receptionist'), validateRequest(transferVisitsSchema), transferVisits);

// Start walk-in visit (Receptionist, Head Doctor)
// Depending on frontend 'Patients'/'Queue' permissions
router.post('/walk-in', requireRole('Head Doctor', 'Receptionist'), validateRequest(startWalkInVisitSchema), startWalkInVisit);

// Check-in appointment (Receptionist, Head Doctor)
router.post('/check-in', requireRole('Head Doctor', 'Receptionist'), validateRequest(checkInAppointmentSchema), checkInAppointment);

// Update visit (Receptionist, Head Doctor, Duty Doctor)
router.patch('/:id', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), validateRequest(updateVisitSchema), updateVisit);

// Cancel visit
router.patch('/:id/cancel', requireRole('Head Doctor', 'Receptionist'), cancelVisit);


export default router;
