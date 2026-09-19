import express from 'express';
import {
  getNotifications,
  getNotificationById,
  sendManualNotification,
  getCommunicationSettings,
} from '../controllers/notificationController';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { notificationLimiter } from '../middleware/rateLimiters';

const router = express.Router();

router.use(requireAuth);

router.get('/', getNotifications);
router.get('/settings', getCommunicationSettings);
router.get('/:id', getNotificationById);
router.post('/send', requireRole('Head Doctor', 'Receptionist'), notificationLimiter, sendManualNotification);

export default router;
