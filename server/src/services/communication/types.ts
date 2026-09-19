import {
  NotificationType,
  NotificationChannel,
  NotificationStatus,
  CommunicationPreference,
} from '@prisma/client';

export {
  NotificationType,
  NotificationChannel,
  NotificationStatus,
  CommunicationPreference,
};

export interface NotificationAttachment {
  filename: string;
  content: string; // Base64 encoded string
  contentType: string; // e.g. "application/pdf"
}

export interface SendMessageOptions {
  recipientPhone?: string;
  recipientEmail?: string;
  recipientName?: string;
  templateName?: string;
  messageBody?: string;
  variables?: Record<string, any>;
  attachments?: NotificationAttachment[];
  providerReference: string; // Idempotency reference key sent to external provider
}

export interface ProviderSendResult {
  success: boolean;
  providerMessageId?: string;
  providerReference?: string;
  error?: string;
  isPermanentFailure?: boolean; // e.g. Unregistered number, Not on WhatsApp
  isUncertainResponse?: boolean; // e.g. Network timeout after request dispatched
  rawResponse?: any;
}

export interface ChannelRoutingDecision {
  channel: NotificationChannel;
  reason: string;
  recipientPhone?: string;
  recipientEmail?: string;
}

export interface NotificationRequestParams {
  type: NotificationType;
  channel?: NotificationChannel; // If not provided, determined by ChannelRouter
  patientId?: string;
  entityType?: 'APPOINTMENT' | 'PAYMENT' | 'VISIT' | 'PURCHASE_ORDER';
  entityId?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  recipientName?: string;
  paymentOwner?: string; // "DOCTOR" | "RECEPTION"
  isManualSend?: boolean;
  sentByUserId?: string;
  scheduledAt?: Date;
  variables?: Record<string, any>;
}

export interface AppointmentNotificationData {
  appointmentId: string;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  date: string;
  time: string;
  type: string;
}

export interface PaymentReceiptNotificationData {
  paymentId: string;
  visitId: string;
  patientName: string;
  patientPhone: string;
  amount: number;
  paymentMethod: string;
  date: string;
  receiptNumber: string;
  pdfBase64?: string;
}

export interface InvoiceNotificationData {
  visitId: string;
  patientName: string;
  patientPhone: string;
  amountDue: number;
  totalAmount: number;
  date: string;
  pdfBase64?: string;
}

export interface PrescriptionNotificationData {
  visitId: string;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  date: string;
  pdfBase64?: string;
}

export interface PurchaseOrderNotificationData {
  purchaseOrderId: string;
  orderNumber: string;
  supplierName: string;
  supplierEmail: string;
  supplierPhone?: string;
  totalAmount: number;
  expectedDate?: string;
  pdfBase64?: string;
}
