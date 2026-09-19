import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import {
  createBatch,
  getBatches,
  getBatchById,
  getBatchRecords,
  previewRecordDocument,
  updateRecordReview,
  resolveDuplicate,
  importApprovedBatch
} from '../controllers/historicalMigrationController';

const router = Router();

// Strictly locked to Head Doctor only
router.use(requireAuth, requireRole('Head Doctor'));

// Batch operations
router.post('/batches', createBatch);
router.get('/batches', getBatches);
router.get('/batches/:batchId', getBatchById);
router.get('/batches/:batchId/records', getBatchRecords);
router.post('/batches/:batchId/import', importApprovedBatch);

// Record review operations
router.get('/records/:recordId/preview', previewRecordDocument);
router.patch('/records/:recordId', updateRecordReview);
router.post('/records/:recordId/resolve', resolveDuplicate);

export default router;
