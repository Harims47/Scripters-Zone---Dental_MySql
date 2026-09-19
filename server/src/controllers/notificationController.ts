import { Request, Response } from 'express';
import { prisma } from '../db';
import { NotificationService } from '../services/communication/NotificationService';
import { QueueRunner } from '../services/communication/queueRunner';

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const { patientId, entityType, entityId, status, type, page, limit } = req.query;

    const result = await NotificationService.listNotifications(
      {
        patientId: patientId as string,
        entityType: entityType as string,
        entityId: entityId as string,
        status: status as any,
        type: type as any,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
      },
      req.user?.role
    );

    return res.json(result);
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch notifications' });
  }
};

export const getNotificationById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const notification = await prisma.notification.findUnique({
      where: { id },
      include: { patient: true },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const sanitized = NotificationService.maskSensitiveNotificationForRole(
      notification,
      req.user?.role
    );

    return res.json(sanitized);
  } catch (error: any) {
    console.error('Error fetching notification by id:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch notification' });
  }
};

export const sendManualNotification = async (req: Request, res: Response) => {
  try {
    const {
      type,
      channel,
      patientId,
      entityType,
      entityId,
      paymentOwner,
      recipientPhone,
      recipientEmail,
      recipientName,
      variables,
    } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Notification type is required' });
    }

    // Security Check: If visit or payment is doctor-owned, Reception cannot manually send payment/invoice notices
    let effectivePaymentOwner = paymentOwner;
    if (!effectivePaymentOwner && entityType === 'VISIT' && entityId) {
      const visit = await prisma.visit.findUnique({ where: { id: entityId }, select: { paymentOwner: true } });
      if (visit) effectivePaymentOwner = visit.paymentOwner;
    } else if (!effectivePaymentOwner && entityType === 'PAYMENT' && entityId) {
      const payment = await prisma.payment.findUnique({
        where: { id: entityId },
        include: { visit: { select: { paymentOwner: true } } },
      });
      if (payment?.visit) effectivePaymentOwner = payment.visit.paymentOwner;
    }

    const result = await NotificationService.requestNotification(
      {
        type,
        channel,
        patientId,
        entityType,
        entityId,
        paymentOwner: effectivePaymentOwner,
        recipientPhone,
        recipientEmail,
        recipientName,
        isManualSend: true,
        variables,
      },
      {
        userId: req.user?.id,
        role: req.user?.role,
      }
    );

    // Process batch immediately to trigger dispatch without waiting for next poll cycle
    QueueRunner.processBatch(1).catch(console.error);

    return res.status(201).json(result);
  } catch (error: any) {
    console.error('Error sending manual notification:', error);
    if (error.message.includes('Rate limit') || error.message.includes('wait 60 seconds')) {
      return res.status(429).json({ error: error.message });
    }
    if (error.message.includes('Unauthorized') || error.message.includes('restricted')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Failed to send notification' });
  }
};

export const getCommunicationSettings = async (req: Request, res: Response) => {
  try {
    // Return high-level generic status without leaking internal vendor secrets
    return res.json({
      environment: process.env.NOTIFICATION_ENV || 'development',
      channels: {
        whatsapp: {
          enabled: true,
          status: 'Active',
          primary: true,
        },
        sms: {
          enabled: true,
          status: 'Active',
          fallback: true,
        },
        email: {
          enabled: true,
          status: 'Active',
          documents: true,
        },
      },
      autoRemindersEnabled: true,
      reminderLeadHours: 24,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch communication settings' });
  }
};
