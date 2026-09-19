import { prisma } from '../../db';
import {
  NotificationType,
  NotificationChannel,
  NotificationRequestParams,
  CommunicationPreference,
} from './types';
import { ChannelRouter } from './ChannelRouter';
import { TemplateEngine } from './templates';

export class NotificationService {
  /**
   * Sanitizes notification records for Receptionists when paymentOwner is DOCTOR.
   */
  public static maskSensitiveNotificationForRole(notification: any, userRole?: string): any {
    if (!notification) return null;

    const normalizedRole = (userRole || '').toUpperCase();
    const isDoctorOwnedPayment =
      notification.paymentOwner === 'DOCTOR' &&
      (notification.type === 'PAYMENT_RECEIPT' || notification.type === 'INVOICE');

    if (isDoctorOwnedPayment && normalizedRole === 'RECEPTIONIST') {
      return {
        id: notification.id,
        type: notification.type,
        channel: notification.channel,
        status: notification.status,
        patientId: notification.patientId,
        entityType: notification.entityType,
        entityId: notification.entityId,
        paymentOwner: 'DOCTOR',
        recipientPhone: undefined,
        recipientEmail: undefined,
        recipientName: undefined,
        templateName: 'RESTRICTED',
        payload: { message: 'Handled by Doctor' },
        provider: undefined,
        providerMessageId: undefined,
        scheduledAt: notification.scheduledAt,
        sentAt: notification.sentAt,
        deliveredAt: notification.deliveredAt,
        createdAt: notification.createdAt,
      };
    }

    return notification;
  }

  /**
   * Requests a notification to be queued and dispatched.
   * Handles idempotency, rate-limiting on manual resends, and security checks.
   */
  public static async requestNotification(
    params: NotificationRequestParams,
    userContext?: { userId?: string; role?: string }
  ) {
    const {
      type,
      channel: requestedChannel,
      patientId,
      entityType,
      entityId,
      paymentOwner,
      isManualSend = false,
      scheduledAt = new Date(),
      variables = {},
    } = params;

    const userRole = userContext?.role;
    const sentByUserId = userContext?.userId;

    // 1. Enforce RBAC & PaymentOwner security boundary
    const authCheck = ChannelRouter.validateAuthorization({
      userRole,
      type,
      paymentOwner,
    });
    if (!authCheck.authorized) {
      throw new Error(authCheck.reason);
    }

    // 2. Load Patient details if patientId provided
    let patient = null;
    if (patientId) {
      patient = await prisma.patient.findUnique({
        where: { id: patientId },
      });
    }

    // 3. Idempotency & Rate-limiting
    let idempotencyKey: string | null = null;
    let manualSendKey: string | null = null;

    if (!isManualSend) {
      // Deterministic automatic event idempotency key
      idempotencyKey = `${type}:${entityType || 'ENTITY'}:${entityId || 'ID'}`;

      const existing = await prisma.notification.findUnique({
        where: { idempotencyKey },
      });

      if (existing) {
        return {
          status: 'ALREADY_EXISTS',
          notification: this.maskSensitiveNotificationForRole(existing, userRole),
        };
      }
    } else {
      // Manual Send: Enforce 60-second cooldown rate limit per (entityType, entityId, type)
      const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
      const recentSend = await prisma.notification.findFirst({
        where: {
          type,
          entityType: entityType || null,
          entityId: entityId || null,
          createdAt: { gte: sixtySecondsAgo },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (recentSend) {
        const remainingSeconds = Math.ceil(
          (recentSend.createdAt.getTime() + 60 * 1000 - Date.now()) / 1000
        );
        throw new Error(
          `Please wait ${remainingSeconds > 0 ? remainingSeconds : 60} seconds before resending this notification.`
        );
      }

      manualSendKey = `manual_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    // 4. Resolve Channel
    const routingDecision = ChannelRouter.route({
      type,
      preferredChannel: patient?.preferredCommunicationChannel as CommunicationPreference,
      whatsappAvailable: patient?.whatsappAvailable,
      patientPhone: params.recipientPhone || patient?.phone,
      patientEmail: params.recipientEmail || patient?.email,
      supplierEmail: params.recipientEmail,
      overrideChannel: requestedChannel,
      userRole,
      paymentOwner,
    });

    const chosenChannel = routingDecision.channel;
    const recipientPhone = routingDecision.recipientPhone || params.recipientPhone;
    const recipientEmail = routingDecision.recipientEmail || params.recipientEmail;
    const recipientName = params.recipientName || patient?.name;

    // 5. Render Template
    const templateData = {
      ...variables,
      patientName: recipientName,
      patientPhone: recipientPhone,
      recipientEmail,
    };
    const rendered = TemplateEngine.render(type, chosenChannel, templateData);

    // 6. Persist Notification Record
    const createdNotification = await prisma.notification.create({
      data: {
        type,
        channel: chosenChannel,
        status: 'QUEUED',
        recipientPhone,
        recipientEmail,
        recipientName,
        patientId: patientId || null,
        entityType: entityType || null,
        entityId: entityId || null,
        idempotencyKey,
        manualSendKey,
        isManualSend,
        sentByUserId: sentByUserId || null,
        paymentOwner: paymentOwner || null,
        templateName: rendered.templateName,
        payload: {
          body: rendered.body,
          subject: rendered.subject,
          variables: rendered.variables,
        },
        scheduledAt,
      },
    });

    return {
      status: 'QUEUED',
      notification: this.maskSensitiveNotificationForRole(createdNotification, userRole),
    };
  }

  /**
   * Queries notifications with RBAC & paymentOwner masking.
   */
  public static async listNotifications(
    filters: {
      patientId?: string;
      entityType?: string;
      entityId?: string;
      status?: any;
      type?: any;
      page?: number;
      limit?: number;
    },
    userRole?: string
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;

    // If Receptionist, completely exclude doctor-owned payment notifications from the list
    const normalizedRole = (userRole || '').toUpperCase();
    if (normalizedRole === 'RECEPTIONIST') {
      where.NOT = [
        {
          paymentOwner: 'DOCTOR',
          type: { in: ['PAYMENT_RECEIPT', 'INVOICE'] },
        },
      ];
    }

    const [total, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const sanitized = notifications.map((n) =>
      this.maskSensitiveNotificationForRole(n, userRole)
    );

    return {
      data: sanitized,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
