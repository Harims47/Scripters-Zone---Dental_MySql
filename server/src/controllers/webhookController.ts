import { Request, Response } from 'express';
import { prisma } from '../db';

function verifyWebhookToken(req: Request): boolean {
  const secret = process.env.COMMUNICATION_WEBHOOK_SECRET;
  if (!secret) {
    return true; // Permissive in development if secret not configured
  }
  const token = req.headers['x-webhook-secret'] || req.query.secret;
  return token === secret;
}

export const handleAiSensyWebhook = async (req: Request, res: Response) => {
  try {
    if (!verifyWebhookToken(req)) {
      return res.status(401).json({ error: 'Unauthorized webhook request' });
    }

    const { event, messageId, clientReference, status } = req.body;
    console.log('[Webhook] AiSensy event received:', { event, messageId, clientReference, status });

    if (messageId || clientReference) {
      const normalizedStatus =
        status?.toUpperCase() === 'DELIVERED'
          ? 'DELIVERED'
          : status?.toUpperCase() === 'READ'
          ? 'DELIVERED'
          : status?.toUpperCase() === 'FAILED'
          ? 'FAILED'
          : undefined;

      if (normalizedStatus) {
        await prisma.notification.updateMany({
          where: {
            OR: [
              { providerMessageId: messageId },
              { providerReference: clientReference },
            ],
          },
          data: {
            status: normalizedStatus as any,
            deliveredAt: normalizedStatus === 'DELIVERED' ? new Date() : undefined,
            failedAt: normalizedStatus === 'FAILED' ? new Date() : undefined,
          },
        });
      }
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[Webhook] Error handling AiSensy webhook:', error.message);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
};

export const handleMsg91Webhook = async (req: Request, res: Response) => {
  try {
    if (!verifyWebhookToken(req)) {
      return res.status(401).json({ error: 'Unauthorized webhook request' });
    }

    const { request_id, status } = req.body;
    console.log('[Webhook] MSG91 event received:', { request_id, status });

    if (request_id && status) {
      const isDelivered = status.toLowerCase() === 'delivered' || status.toLowerCase() === 'success';
      await prisma.notification.updateMany({
        where: { providerMessageId: request_id },
        data: {
          status: isDelivered ? 'DELIVERED' : 'FAILED',
          deliveredAt: isDelivered ? new Date() : undefined,
        },
      });
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[Webhook] Error handling MSG91 webhook:', error.message);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
};

export const handleBrevoWebhook = async (req: Request, res: Response) => {
  try {
    if (!verifyWebhookToken(req)) {
      return res.status(401).json({ error: 'Unauthorized webhook request' });
    }

    const { event, 'message-id': messageId } = req.body;
    console.log('[Webhook] Brevo event received:', { event, messageId });

    if (messageId && event) {
      const isDelivered = event === 'delivered' || event === 'opened' || event === 'click';
      const isFailed = event === 'hard_bounce' || event === 'soft_bounce' || event === 'blocked' || event === 'spam';

      if (isDelivered || isFailed) {
        await prisma.notification.updateMany({
          where: { providerMessageId: messageId },
          data: {
            status: isDelivered ? 'DELIVERED' : 'FAILED',
            deliveredAt: isDelivered ? new Date() : undefined,
            failedAt: isFailed ? new Date() : undefined,
          },
        });
      }
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[Webhook] Error handling Brevo webhook:', error.message);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
};
