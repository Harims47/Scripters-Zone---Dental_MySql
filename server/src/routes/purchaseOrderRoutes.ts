import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  updatePurchaseOrderStatusSchema,
  receivePurchaseOrderItemsSchema
} from '../schemas/purchaseOrderSchema';
import {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
  receivePurchaseOrderItems,
  exportPurchaseOrders
} from '../controllers/purchaseOrderController';

const router = Router();

router.use(requireAuth);

router.get('/export', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), exportPurchaseOrders);
router.get('/', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getPurchaseOrders);
router.get('/:id', requireRole('Head Doctor', 'Duty Doctor', 'Receptionist'), getPurchaseOrderById);
router.post('/', requireRole('Head Doctor', 'Duty Doctor'), validateRequest(createPurchaseOrderSchema), createPurchaseOrder);
router.put('/:id', requireRole('Head Doctor', 'Duty Doctor'), validateRequest(updatePurchaseOrderSchema), updatePurchaseOrder);
router.patch('/:id/status', requireRole('Head Doctor', 'Duty Doctor'), validateRequest(updatePurchaseOrderStatusSchema), updatePurchaseOrderStatus);
router.post('/:id/receive', requireRole('Head Doctor', 'Duty Doctor'), validateRequest(receivePurchaseOrderItemsSchema), receivePurchaseOrderItems);

export default router;
