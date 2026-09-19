import express from 'express';
import {
  handleAiSensyWebhook,
  handleMsg91Webhook,
  handleBrevoWebhook,
} from '../controllers/webhookController';

const router = express.Router();

// Webhooks are publicly reachable callback endpoints verified by signatures or headers
router.post('/aisensy', handleAiSensyWebhook);
router.post('/msg91', handleMsg91Webhook);
router.post('/brevo', handleBrevoWebhook);

export default router;
