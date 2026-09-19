import {
  NotificationType,
  NotificationChannel,
  CommunicationPreference,
  ChannelRoutingDecision,
} from './types';

export interface RouteRequestInput {
  type: NotificationType;
  preferredChannel?: CommunicationPreference;
  whatsappAvailable?: boolean | null;
  patientPhone?: string | null;
  patientEmail?: string | null;
  supplierEmail?: string | null;
  overrideChannel?: NotificationChannel;
  userRole?: string;
  paymentOwner?: string; // "DOCTOR" | "RECEPTION"
}

export class ChannelRouter {
  /**
   * Validates whether a user is authorized to trigger or override a channel.
   * Enforces RBAC and Visit.paymentOwner security boundary.
   */
  public static validateAuthorization(input: {
    userRole?: string;
    type: NotificationType;
    paymentOwner?: string;
  }): { authorized: boolean; reason?: string } {
    const { userRole, type, paymentOwner } = input;
    const normalizedRole = (userRole || '').toUpperCase();

    // Security Rule: If paymentOwner === 'DOCTOR', Receptionists are prohibited from
    // triggering, viewing, or overriding payment-related notifications.
    const isPaymentNotification =
      type === 'PAYMENT_RECEIPT' || type === 'INVOICE';

    if (
      paymentOwner === 'DOCTOR' &&
      isPaymentNotification &&
      normalizedRole === 'RECEPTIONIST'
    ) {
      return {
        authorized: false,
        reason: 'Unauthorized: Payment details for this doctor-owned visit are restricted from Reception.',
      };
    }

    // Role-based permission checks
    if (type === 'PURCHASE_ORDER_SENT') {
      // Only Admin, Doctor, or Manager should send purchase orders
      if (normalizedRole === 'RECEPTIONIST') {
        return {
          authorized: false,
          reason: 'Receptionists are not authorized to send Purchase Orders.',
        };
      }
    }

    return { authorized: true };
  }

  /**
   * Resolves the delivery channel according to strict business logic and patient preferences.
   */
  public static route(input: RouteRequestInput): ChannelRoutingDecision {
    const {
      type,
      preferredChannel = 'AUTO',
      whatsappAvailable,
      patientPhone,
      patientEmail,
      supplierEmail,
      overrideChannel,
      userRole,
      paymentOwner,
    } = input;

    // 1. Enforce RBAC & security check
    const authCheck = this.validateAuthorization({ userRole, type, paymentOwner });
    if (!authCheck.authorized) {
      throw new Error(authCheck.reason);
    }

    // 2. Special case: Supplier Purchase Orders always route to EMAIL
    if (type === 'PURCHASE_ORDER_SENT') {
      if (!supplierEmail) {
        throw new Error('Supplier email is required for sending purchase orders.');
      }
      return {
        channel: 'EMAIL',
        recipientEmail: supplierEmail,
        reason: 'Purchase orders are strictly routed to supplier email.',
      };
    }

    // 3. If an explicit manual channel override was requested by an authorized user
    if (overrideChannel) {
      if (overrideChannel === 'WHATSAPP') {
        if (!patientPhone) throw new Error('Recipient phone required for WhatsApp.');
        return { channel: 'WHATSAPP', recipientPhone: patientPhone, reason: 'Manual override by user.' };
      }
      if (overrideChannel === 'SMS') {
        if (!patientPhone) throw new Error('Recipient phone required for SMS.');
        return { channel: 'SMS', recipientPhone: patientPhone, reason: 'Manual override by user.' };
      }
      if (overrideChannel === 'EMAIL') {
        if (!patientEmail) throw new Error('Recipient email required for Email.');
        return { channel: 'EMAIL', recipientEmail: patientEmail, reason: 'Manual override by user.' };
      }
    }

    // 4. Resolve by patient's explicit communication preference
    switch (preferredChannel) {
      case 'WHATSAPP':
        // Explicit preference: WhatsApp ONLY. Do not fall back to SMS automatically!
        if (!patientPhone) {
          throw new Error('Patient prefers WhatsApp, but no phone number is registered.');
        }
        return {
          channel: 'WHATSAPP',
          recipientPhone: patientPhone,
          reason: 'Patient explicit preference is WHATSAPP.',
        };

      case 'SMS':
        // Explicit preference: SMS ONLY.
        if (!patientPhone) {
          throw new Error('Patient prefers SMS, but no phone number is registered.');
        }
        return {
          channel: 'SMS',
          recipientPhone: patientPhone,
          reason: 'Patient explicit preference is SMS.',
        };

      case 'EMAIL':
        // Explicit preference: EMAIL ONLY.
        if (!patientEmail) {
          throw new Error('Patient prefers Email, but no email address is registered.');
        }
        return {
          channel: 'EMAIL',
          recipientEmail: patientEmail,
          reason: 'Patient explicit preference is EMAIL.',
        };

      case 'AUTO':
      default:
        // AUTO routing:
        // WhatsApp is the primary channel when genuinely available.
        // If whatsappAvailable === false (confirmed not on WhatsApp), route to SMS.
        // If whatsappAvailable is true or null (untested), try WhatsApp.
        if (patientPhone) {
          if (whatsappAvailable === false) {
            return {
              channel: 'SMS',
              recipientPhone: patientPhone,
              reason: 'AUTO preference: Patient verified not on WhatsApp. Routing to SMS.',
            };
          }
          return {
            channel: 'WHATSAPP',
            recipientPhone: patientPhone,
            reason: 'AUTO preference: WhatsApp is primary channel.',
          };
        }

        // If no phone but email is available
        if (patientEmail) {
          return {
            channel: 'EMAIL',
            recipientEmail: patientEmail,
            reason: 'AUTO preference: No phone available, routing to email.',
          };
        }

        throw new Error('No contact method (phone or email) available for patient.');
    }
  }
}
