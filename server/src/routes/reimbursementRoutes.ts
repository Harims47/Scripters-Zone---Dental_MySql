import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import { createReimbursementSchema, updateReimbursementSchema } from '../schemas/reimbursementSchema';
import {
  getReimbursements,
  getReimbursementById,
  createReimbursement,
  updateReimbursement,
  deleteReimbursement,
  downloadReimbursementPDF
} from '../controllers/reimbursementController';

const router = Router();

// All Reimbursement operations require Head Doctor authentication
router.use(requireAuth);
router.use(requireRole('Head Doctor'));

router.get('/', getReimbursements);
router.get('/:id', getReimbursementById);
router.post('/', validateRequest(createReimbursementSchema), createReimbursement);
router.put('/:id', validateRequest(updateReimbursementSchema), updateReimbursement);
router.delete('/:id', deleteReimbursement);
router.get('/:id/pdf', downloadReimbursementPDF);

export default router;
