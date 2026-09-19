import { Router } from 'express';
import { requireAuth, requireRole, requireModule } from '../middleware/authMiddleware';
import {
  getStaff,
  exportStaff,
  createStaff,
  updateStaff,
  updateStaffStatus,
  updateStaffAttendance
} from '../controllers/staffController';

const router = Router();

router.use(requireAuth);

router.get('/export', requireRole('Head Doctor', 'Receptionist'), exportStaff);
router.get('/', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getStaff);
router.post('/', requireRole('Head Doctor'), requireModule('Staff Management'), createStaff);
router.put('/:id', requireRole('Head Doctor'), requireModule('Staff Management'), updateStaff);
router.put('/:id/status', requireRole('Head Doctor'), requireModule('Staff Management'), updateStaffStatus);
router.put('/:id/attendance', requireRole('Head Doctor'), requireModule('Staff Management'), updateStaffAttendance);

export default router;
