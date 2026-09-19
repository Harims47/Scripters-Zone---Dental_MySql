import express from 'express';
import {
  getNotifications,
  getNotificationById,
  sendManualNotification,
  getCommunicationSettings,
} from '../controllers/notificationController';
import { requireAuth } from '../middleware/authMiddleware';

const router = express.Router();

router.use(requireAuth);

router.get('/', getNotifications);
router.get('/settings', getCommunicationSettings);
router.get('/:id', getNotificationById);
router.post('/send', sendManualNotification);

export default router;
