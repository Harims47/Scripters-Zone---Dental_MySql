import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { getBillingQueue, exportBillingQueue } from '../controllers/billingController';

const router = Router();

router.use(requireAuth);

router.get('/export', requireRole('Head Doctor', 'Receptionist'), exportBillingQueue);
router.get('/', requireRole('Head Doctor', 'Receptionist'), getBillingQueue);

export default router;
