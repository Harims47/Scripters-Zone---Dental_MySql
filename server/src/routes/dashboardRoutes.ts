import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import { getDashboardData } from '../controllers/dashboardController';

const router = Router();

// All authenticated roles (Receptionist, Duty Doctor, Head Doctor) can access their respective dashboard slice
router.use(requireAuth);

router.get('/', getDashboardData);

export default router;
