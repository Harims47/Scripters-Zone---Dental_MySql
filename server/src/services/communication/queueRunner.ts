import { prisma } from '../../db';
import { AiSensyAdapter } from './providers/AiSensyAdapter';
import { Msg91Adapter } from './providers/Msg91Adapter';
import { BrevoAdapter } from './providers/BrevoAdapter';
import { TemplateEngine } from './templates';
import { NotificationStatus } from './types';

export class QueueRunner {
  private static isRunning = false;
  private static pollTimer: NodeJS.Timeout | null = null;
  private static reminderTimer: NodeJS.Timeout | null = null;

  private static whatsAppProvider = new AiSensyAdapter();
  private static smsProvider = new Msg91Adapter();
  private static emailProvider = new BrevoAdapter();

  /**
   * Starts the background queue worker and schedulers.
   */
  public static async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🚀 [QueueRunner] Initializing communication queue worker...');

    // 1. Crash recovery sweep on startup
    await this.recoverStaleJobs();

    // 2. Start polling loop (every 10 seconds)
    this.pollTimer = setInterval(async () => {
      try {
        await this.processBatch();
      } catch (err: any) {
        console.error('[QueueRunner] Error in queue batch cycle:', err.message);
      }
    }, 10000);

    // 3. Start 24-hour appointment reminder scheduler (every 15 minutes)
    this.reminderTimer = setInterval(async () => {
      try {
        await this.scheduleUpcomingAppointmentReminders();
      } catch (err: any) {
        console.error('[QueueRunner] Error in appointment reminder sweeper:', err.message);
      }
    }, 15 * 60 * 1000);

    // Run initial batch immediately
    this.processBatch().catch(console.error);
    this.scheduleUpcomingAppointmentReminders().catch(console.error);
  }

  /**
   * Stops the queue worker gracefully.
   */
  public static stop() {
    this.isRunning = false;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.reminderTimer) clearInterval(this.reminderTimer);
    console.log('🛑 [QueueRunner] Queue worker stopped.');
  }

  /**
   * Crash Recovery: Reset jobs stuck in SENDING back to RETRYING on backend boot.
   */
  public static async recoverStaleJobs() {
    try {
      const recovered = await prisma.notification.updateMany({
        where: { status: 'SENDING' },
        data: {
          status: 'RETRYING',
          lastError: 'Worker restarted while notification was in flight. Re-enqueued for delivery.',
        },
      });
      if (recovered.count > 0) {
        console.log(`[QueueRunner] Recovered ${recovered.count} jobs stuck in SENDING status.`);
      }
    } catch (err: any) {
      console.error('[QueueRunner] Failed to recover stale jobs:', err.message);
    }
  }

  /**
   * Claims and processes a batch of notifications atomically using MySQL FOR UPDATE SKIP LOCKED.
   */
  public static async processBatch(batchSize: number = 5): Promise<number> {
    console.log(`[Diagnostic] QueueRunner cycle start (batchSize: ${batchSize})`);
    let claimedNotifications: any[] = [];
    try {
      console.log('[Diagnostic] QueueRunner transaction start');
      claimedNotifications = await prisma.$transaction(async (tx) => {
        // 1. Atomically lock candidate IDs using FOR UPDATE SKIP LOCKED
        const candidates = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM \`Notification\`
          WHERE \`scheduledAt\` <= NOW()
            AND status IN ('QUEUED', 'RETRYING')
          ORDER BY \`scheduledAt\` ASC
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        `;

        if (!candidates || candidates.length === 0) {
          return [];
        }

        const ids = candidates.map(c => c.id);

        // 2. Transition strictly the locked IDs to SENDING
        await tx.notification.updateMany({
          where: { id: { in: ids } },
          data: {
            status: 'SENDING',
            updatedAt: new Date(),
          },
        });

        // 3. Fetch the updated claimed records before transaction commit
        return tx.notification.findMany({
          where: { id: { in: ids } },
        });
      });
      console.log(`[Diagnostic] QueueRunner transaction completed successfully (claimed: ${claimedNotifications.length})`);
    } catch (txErr: any) {
      console.error('[Diagnostic] QueueRunner transaction failure:', txErr.message);
      throw txErr;
    }

    // 4. Commit has occurred — dispatch completely outside the database transaction
    if (!claimedNotifications || claimedNotifications.length === 0) {
      console.log('[Diagnostic] QueueRunner cycle complete (0 jobs processed)');
      return 0;
    }

    console.log(`[QueueRunner] Atomically claimed ${claimedNotifications.length} notification job(s).`);

    for (const notification of claimedNotifications) {
      await this.dispatchNotification(notification);
    }

    console.log(`[Diagnostic] QueueRunner cycle complete (${claimedNotifications.length} jobs dispatched)`);
    return claimedNotifications.length;
  }

  /**
   * Dispatches a single claimed notification with Two-Generals handling and permanent error detection.
   */
  private static async dispatchNotification(notification: any) {
    const currentAttempt = (notification.attempts || 0) + 1;
    const providerReference = `DC-NOTIF-${notification.id}-${currentAttempt}`;
    const payload = (notification.payload as any) || {};

    try {
      let sendResult;

      // TWO GENERALS RECONCILIATION:
      // If previous attempt ended in uncertain response (e.g., network timeout after dispatch),
      // check delivery status before sending again to avoid duplicate external dispatch.
      if (notification.status === 'RETRYING' && notification.providerReference && notification.providerMessageId) {
        if (notification.channel === 'WHATSAPP' && this.whatsAppProvider.checkDeliveryStatus) {
          const statusCheck = await this.whatsAppProvider.checkDeliveryStatus(
            notification.providerMessageId,
            notification.providerReference
          );
          if (statusCheck && statusCheck.success) {
            console.log(`[QueueRunner] Uncertain job ${notification.id} reconciled as already delivered.`);
            await prisma.notification.update({
              where: { id: notification.id },
              data: {
                status: 'DELIVERED',
                deliveredAt: new Date(),
                attempts: currentAttempt,
              },
            });
            return;
          }
        }
      }

      // Dispatch to respective provider
      if (notification.channel === 'WHATSAPP') {
        sendResult = await this.whatsAppProvider.sendTemplateMessage({
          recipientPhone: notification.recipientPhone,
          recipientName: notification.recipientName,
          templateName: notification.templateName,
          messageBody: payload.body,
          variables: payload.variables,
          providerReference,
        });
      } else if (notification.channel === 'SMS') {
        sendResult = await this.smsProvider.sendSms({
          recipientPhone: notification.recipientPhone,
          templateName: notification.templateName,
          messageBody: payload.body,
          variables: payload.variables,
          providerReference,
        });
      } else if (notification.channel === 'EMAIL') {
        sendResult = await this.emailProvider.sendEmail({
          recipientEmail: notification.recipientEmail,
          recipientName: notification.recipientName,
          subject: payload.subject || 'DentalCore Notification',
          htmlContent: payload.body || '',
          providerReference,
        });
      } else {
        throw new Error(`Unsupported channel: ${notification.channel}`);
      }

      // Handle Provider Result
      if (sendResult.success) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: 'SENT',
            provider: notification.channel === 'WHATSAPP' ? 'AISENSY' : notification.channel === 'SMS' ? 'MSG91' : 'BREVO',
            providerMessageId: sendResult.providerMessageId,
            providerReference,
            sentAt: new Date(),
            attempts: currentAttempt,
            lastError: null,
          },
        });

        // If WhatsApp sent successfully and patient was untracked, mark whatsappAvailable = true
        if (notification.channel === 'WHATSAPP' && notification.patientId) {
          await prisma.patient.update({
            where: { id: notification.patientId },
            data: { whatsappAvailable: true, whatsappCheckedAt: new Date() },
          }).catch(() => {});
        }
      } else {
        // Provider indicated failure
        await this.handleFailedDispatch(notification, currentAttempt, providerReference, sendResult);
      }
    } catch (unexpectedError: any) {
      console.error(`[QueueRunner] Exception dispatching notification ${notification.id}:`, unexpectedError.message);
      await this.handleFailedDispatch(notification, currentAttempt, providerReference, {
        success: false,
        error: unexpectedError.message,
        isPermanentFailure: false,
      });
    }
  }

  /**
   * Evaluates failure types (permanent vs temporary) and triggers backoff or fallback.
   */
  private static async handleFailedDispatch(
    notification: any,
    currentAttempt: number,
    providerReference: string,
    result: { success?: boolean; error?: string; isPermanentFailure?: boolean; isUncertainResponse?: boolean }
  ) {
    const isPermanent = !!result.isPermanentFailure;
    const maxAttempts = notification.maxAttempts || 3;

    // Case 1: WhatsApp Permanent Failure (e.g. Unregistered number, Not on WhatsApp)
    if (notification.channel === 'WHATSAPP' && isPermanent) {
      console.warn(`[QueueRunner] Permanent WhatsApp failure for notification ${notification.id}: ${result.error}`);

      // Update patient profile: genuine WhatsApp unavailability
      if (notification.patientId) {
        await prisma.patient.update({
          where: { id: notification.patientId },
          data: { whatsappAvailable: false, whatsappCheckedAt: new Date() },
        }).catch(() => {});
      }

      // Mark WhatsApp notification as FAILED
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          attempts: currentAttempt,
          providerReference,
          lastError: `Permanent Failure: ${result.error}`,
        },
      });

      // Check if patient preference permits SMS fallback:
      // AUTO = genuine fallback to SMS.
      // WHATSAPP = explicit patient choice, NEVER silent fallback!
      let patientPref = 'AUTO';
      if (notification.patientId) {
        const patient = await prisma.patient.findUnique({
          where: { id: notification.patientId },
          select: { preferredCommunicationChannel: true },
        });
        if (patient) patientPref = patient.preferredCommunicationChannel;
      }

      if (patientPref === 'AUTO' && notification.recipientPhone) {
        console.log(`[QueueRunner] Triggering SMS fallback for AUTO preference on notification ${notification.id}`);
        const rendered = TemplateEngine.render(notification.type, 'SMS', (notification.payload as any)?.variables || {});
        await prisma.notification.create({
          data: {
            type: notification.type,
            channel: 'SMS',
            status: 'QUEUED',
            recipientPhone: notification.recipientPhone,
            recipientName: notification.recipientName,
            patientId: notification.patientId,
            entityType: notification.entityType,
            entityId: notification.entityId,
            paymentOwner: notification.paymentOwner,
            templateName: rendered.templateName,
            payload: { body: rendered.body, variables: rendered.variables },
            scheduledAt: new Date(),
          },
        });
      }
      return;
    }

    // Case 2: Temporary Failure / Network Outage
    // Temporary API/network failures must NEVER trigger immediate SMS fallback!
    if (currentAttempt < maxAttempts) {
      // Exponential Backoff:
      // Attempt 1: +1 min, Attempt 2: +5 mins, Attempt 3: +15 mins
      const backoffMinutes = currentAttempt === 1 ? 1 : currentAttempt === 2 ? 5 : 15;
      const nextSchedule = new Date(Date.now() + backoffMinutes * 60 * 1000);

      console.log(
        `[QueueRunner] Notification ${notification.id} temporary failure (Attempt ${currentAttempt}/${maxAttempts}). Retrying in ${backoffMinutes}m.`
      );

      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'RETRYING',
          attempts: currentAttempt,
          providerReference,
          scheduledAt: nextSchedule,
          lastError: `Attempt ${currentAttempt} failed: ${result.error}${result.isUncertainResponse ? ' (Uncertain Provider Response)' : ''}`,
        },
      });
    } else {
      // Max attempts exhausted
      console.error(`[QueueRunner] Notification ${notification.id} exhausted max retries (${maxAttempts}). Status set to FAILED.`);
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          attempts: currentAttempt,
          providerReference,
          lastError: `Exhausted ${maxAttempts} attempts. Final error: ${result.error}`,
        },
      });
    }
  }

  /**
   * Sweeper for scheduling 24h appointment reminders.
   */
  public static async scheduleUpcomingAppointmentReminders() {
    // Find appointments scheduled for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0]; // "YYYY-MM-DD"

    const upcomingAppointments = await prisma.appointment.findMany({
      where: {
        date: tomorrowStr,
        status: 'Scheduled',
      },
      include: {
        visit: {
          include: {
            patient: true,
          },
        },
      },
    });

    for (const apt of upcomingAppointments) {
      const patient = apt.visit?.patient;
      if (!patient) continue;

      const idempotencyKey = `APPOINTMENT_REMINDER:APPOINTMENT:${apt.id}`;

      // Check if reminder already exists
      const existing = await prisma.notification.findUnique({
        where: { idempotencyKey },
      });

      if (!existing) {
        const pref = (patient.preferredCommunicationChannel as any) || 'AUTO';
        const channel = pref === 'SMS' ? 'SMS' : pref === 'EMAIL' ? 'EMAIL' : patient.whatsappAvailable === false ? 'SMS' : 'WHATSAPP';
        const rendered = TemplateEngine.render('APPOINTMENT_REMINDER', channel, {
          patientName: patient.name,
          doctorName: 'your doctor',
          date: apt.date,
          time: apt.time,
        });

        await prisma.notification.create({
          data: {
            type: 'APPOINTMENT_REMINDER',
            channel,
            status: 'QUEUED',
            recipientPhone: patient.phone,
            recipientEmail: patient.email,
            recipientName: patient.name,
            patientId: patient.id,
            entityType: 'APPOINTMENT',
            entityId: apt.id,
            idempotencyKey,
            templateName: rendered.templateName,
            payload: {
              body: rendered.body,
              subject: rendered.subject,
              variables: rendered.variables,
            },
            scheduledAt: new Date(),
          },
        });
      }
    }
  }
}
