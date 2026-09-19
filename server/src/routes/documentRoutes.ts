import express from 'express';
import {
  getPrescriptionPDF,
  getReceiptPDF,
  getInvoicePDF,
  getPurchaseOrderPDF,
} from '../controllers/documentController';
import { requireAuth, requireRole } from '../middleware/authMiddleware';

const router = express.Router();

// Require authentication for all document routes
router.use(requireAuth);

router.get('/prescription/:visitId', requireRole('Receptionist', 'Head Doctor', 'Duty Doctor', 'Admin'), getPrescriptionPDF);
router.get('/receipt/:visitId', requireRole('Receptionist', 'Head Doctor', 'Duty Doctor', 'Admin'), getReceiptPDF);
router.get('/invoice/:visitId', requireRole('Receptionist', 'Head Doctor', 'Duty Doctor', 'Admin'), getInvoicePDF);
router.get('/purchase-order/:id', requireRole('Head Doctor', 'Duty Doctor', 'Admin'), getPurchaseOrderPDF);

export default router;

