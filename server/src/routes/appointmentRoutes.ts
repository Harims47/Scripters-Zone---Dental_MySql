import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import { createAppointmentSchema, updateAppointmentSchema } from '../schemas/appointmentSchema';
import {
  getAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  exportAppointments
} from '../controllers/appointmentController';

const router = Router();

router.use(requireAuth);

// Duty Doctor does not have the "Appointments" module in the frontend role configuration.
router.get('/export', requireRole('Head Doctor', 'Receptionist'), exportAppointments);
router.get('/', requireRole('Head Doctor', 'Receptionist'), getAppointments);
router.get('/:id', requireRole('Head Doctor', 'Receptionist'), getAppointmentById);
router.post('/', requireRole('Head Doctor', 'Receptionist'), validateRequest(createAppointmentSchema), createAppointment);
router.patch('/:id', requireRole('Head Doctor', 'Receptionist'), validateRequest(updateAppointmentSchema), updateAppointment);

export default router;
