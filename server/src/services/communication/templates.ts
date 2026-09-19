import { NotificationType, NotificationChannel } from './types';

export interface RenderedTemplate {
  subject?: string;
  body: string;
  templateName: string;
  variables: Record<string, any>;
}

export class TemplateEngine {
  private static clinicName = 'DentalCore Clinic';
  private static clinicPhone = '+91 98765 43210';

  /**
   * Renders the template for a given notification type and channel.
   */
  public static render(
    type: NotificationType,
    channel: NotificationChannel,
    data: Record<string, any>
  ): RenderedTemplate {
    switch (type) {
      case 'APPOINTMENT_CONFIRMATION':
        return this.renderAppointmentConfirmation(channel, data);
      case 'APPOINTMENT_REMINDER':
        return this.renderAppointmentReminder(channel, data);
      case 'PAYMENT_RECEIPT':
        return this.renderPaymentReceipt(channel, data);
      case 'INVOICE':
        return this.renderInvoice(channel, data);
      case 'PRESCRIPTION':
        return this.renderPrescription(channel, data);
      case 'PURCHASE_ORDER_SENT':
        return this.renderPurchaseOrder(channel, data);
      default:
        return {
          templateName: 'GENERIC_NOTICE',
          body: `Notification from ${this.clinicName}`,
          variables: data,
        };
    }
  }

  private static renderAppointmentConfirmation(
    channel: NotificationChannel,
    data: Record<string, any>
  ): RenderedTemplate {
    const patientName = data.patientName || 'Valued Patient';
    const doctorName = data.doctorName ? `Dr. ${data.doctorName.replace(/^Dr\.\s*/i, '')}` : 'our dental specialist';
    const date = data.date || 'your scheduled date';
    const time = data.time || 'scheduled time';

    if (channel === 'WHATSAPP') {
      return {
        templateName: 'appointment_confirmation_v1',
        body: `Hello *${patientName}*,\n\nYour appointment at *${this.clinicName}* has been confirmed with *${doctorName}*.\n\n📅 Date: ${date}\n⏰ Time: ${time}\n\nIf you need to reschedule, please contact us at ${this.clinicPhone}.\n\nThank you!`,
        variables: { patientName, doctorName, date, time, clinicPhone: this.clinicPhone },
      };
    } else if (channel === 'SMS') {
      return {
        templateName: 'SMS_APT_CONFIRM',
        body: `Dear ${patientName}, your appointment at ${this.clinicName} with ${doctorName} is confirmed for ${date} at ${time}. Helpline: ${this.clinicPhone}`,
        variables: { patientName, doctorName, date, time },
      };
    } else {
      return {
        templateName: 'EMAIL_APT_CONFIRM',
        subject: `Appointment Confirmed - ${this.clinicName}`,
        body: `Dear ${patientName},<br><br>Your appointment with ${doctorName} has been confirmed for <strong>${date} at ${time}</strong>.<br><br>Location: ${this.clinicName}<br>Contact: ${this.clinicPhone}`,
        variables: { patientName, doctorName, date, time },
      };
    }
  }

  private static renderAppointmentReminder(
    channel: NotificationChannel,
    data: Record<string, any>
  ): RenderedTemplate {
    const patientName = data.patientName || 'Valued Patient';
    const doctorName = data.doctorName ? `Dr. ${data.doctorName.replace(/^Dr\.\s*/i, '')}` : 'our dental specialist';
    const date = data.date || 'tomorrow';
    const time = data.time || 'scheduled time';

    if (channel === 'WHATSAPP') {
      return {
        templateName: 'appointment_reminder_v1',
        body: `Reminder: Hello *${patientName}*,\n\nThis is a gentle reminder for your upcoming appointment with *${doctorName}* tomorrow, *${date} at ${time}*.\n\n📍 *${this.clinicName}*\n📞 ${this.clinicPhone}\n\nPlease arrive 10 minutes prior. See you soon!`,
        variables: { patientName, doctorName, date, time, clinicPhone: this.clinicPhone },
      };
    } else if (channel === 'SMS') {
      return {
        templateName: 'SMS_APT_REMINDER',
        body: `Reminder: Dear ${patientName}, your dental appointment is scheduled for ${date} at ${time} with ${doctorName} at ${this.clinicName}.`,
        variables: { patientName, doctorName, date, time },
      };
    } else {
      return {
        templateName: 'EMAIL_APT_REMINDER',
        subject: `Appointment Reminder: Tomorrow at ${time} - ${this.clinicName}`,
        body: `Dear ${patientName},<br><br>This is a reminder for your appointment tomorrow with ${doctorName} on <strong>${date} at ${time}</strong>.<br><br>We look forward to seeing you at ${this.clinicName}.`,
        variables: { patientName, doctorName, date, time },
      };
    }
  }

  private static renderPaymentReceipt(
    channel: NotificationChannel,
    data: Record<string, any>
  ): RenderedTemplate {
    const patientName = data.patientName || 'Valued Patient';
    const amount = Number(data.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const receiptNumber = data.receiptNumber || 'RCPT';
    const date = data.date || new Date().toLocaleDateString('en-IN');

    if (channel === 'WHATSAPP') {
      return {
        templateName: 'payment_receipt_v1',
        body: `Hello *${patientName}*,\n\nThank you for your payment at *${this.clinicName}*.\n\n🧾 Receipt No: *${receiptNumber}*\n💰 Amount Paid: *₹${amount}*\n📅 Date: ${date}\n\nYour official receipt document is attached below.`,
        variables: { patientName, receiptNumber, amount, date },
      };
    } else if (channel === 'SMS') {
      return {
        templateName: 'SMS_PAYMENT_RECEIPT',
        body: `Dear ${patientName}, we have received your payment of Rs. ${amount} (Receipt: ${receiptNumber}) on ${date}. Thank you for choosing ${this.clinicName}.`,
        variables: { patientName, receiptNumber, amount, date },
      };
    } else {
      return {
        templateName: 'EMAIL_PAYMENT_RECEIPT',
        subject: `Payment Receipt ${receiptNumber} - ${this.clinicName}`,
        body: `Dear ${patientName},<br><br>Thank you for your payment of <strong>₹${amount}</strong> on ${date}. Your receipt (#${receiptNumber}) is attached to this email.<br><br>Warm regards,<br>${this.clinicName}`,
        variables: { patientName, receiptNumber, amount, date },
      };
    }
  }

  private static renderInvoice(
    channel: NotificationChannel,
    data: Record<string, any>
  ): RenderedTemplate {
    const patientName = data.patientName || 'Valued Patient';
    const amountDue = Number(data.amountDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const totalAmount = Number(data.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const date = data.date || new Date().toLocaleDateString('en-IN');

    if (channel === 'WHATSAPP') {
      return {
        templateName: 'invoice_v1',
        body: `Hello *${patientName}*,\n\nHere is your treatment invoice from *${this.clinicName}* dated ${date}.\n\n💵 Total Bill: *₹${totalAmount}*\n💳 Balance Due: *₹${amountDue}*\n\nPlease find your detailed invoice attached.`,
        variables: { patientName, totalAmount, amountDue, date },
      };
    } else if (channel === 'SMS') {
      return {
        templateName: 'SMS_INVOICE',
        body: `Dear ${patientName}, your dental bill is Rs. ${totalAmount} (Due: Rs. ${amountDue}). Details sent to your email or available at ${this.clinicName}.`,
        variables: { patientName, totalAmount, amountDue },
      };
    } else {
      return {
        templateName: 'EMAIL_INVOICE',
        subject: `Treatment Invoice - ${this.clinicName}`,
        body: `Dear ${patientName},<br><br>Please find attached your dental treatment invoice from ${this.clinicName}.<br><br>Total: <strong>₹${totalAmount}</strong><br>Balance Due: <strong>₹${amountDue}</strong><br><br>Best regards,<br>${this.clinicName}`,
        variables: { patientName, totalAmount, amountDue, date },
      };
    }
  }

  private static renderPrescription(
    channel: NotificationChannel,
    data: Record<string, any>
  ): RenderedTemplate {
    const patientName = data.patientName || 'Valued Patient';
    const doctorName = data.doctorName ? `Dr. ${data.doctorName.replace(/^Dr\.\s*/i, '')}` : 'your doctor';
    const date = data.date || new Date().toLocaleDateString('en-IN');

    if (channel === 'WHATSAPP') {
      return {
        templateName: 'prescription_v1',
        body: `Hello *${patientName}*,\n\nYour digital prescription from *${doctorName}* at *${this.clinicName}* (${date}) is attached below.\n\nPlease follow the medication instructions carefully. Wishing you a speedy recovery!`,
        variables: { patientName, doctorName, date },
      };
    } else if (channel === 'SMS') {
      return {
        templateName: 'SMS_PRESCRIPTION',
        body: `Dear ${patientName}, your digital prescription from ${doctorName} at ${this.clinicName} has been generated. Please consult clinic staff if any assistance is needed.`,
        variables: { patientName, doctorName, date },
      };
    } else {
      return {
        templateName: 'EMAIL_PRESCRIPTION',
        subject: `Your Dental Prescription - ${this.clinicName}`,
        body: `Dear ${patientName},<br><br>Attached is your digital prescription issued by ${doctorName} on ${date}.<br><br>Take care,<br>${this.clinicName}`,
        variables: { patientName, doctorName, date },
      };
    }
  }

  private static renderPurchaseOrder(
    channel: NotificationChannel,
    data: Record<string, any>
  ): RenderedTemplate {
    const supplierName = data.supplierName || 'Supplier';
    const orderNumber = data.orderNumber || 'PO';
    const totalAmount = Number(data.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const expectedDate = data.expectedDate || 'Earliest convenience';

    return {
      templateName: 'EMAIL_PURCHASE_ORDER',
      subject: `Purchase Order ${orderNumber} from ${this.clinicName}`,
      body: `Dear ${supplierName},<br><br>Please find attached Purchase Order <strong>#${orderNumber}</strong> from ${this.clinicName} for a total amount of <strong>₹${totalAmount}</strong>.<br><br>Expected Delivery: ${expectedDate}<br><br>Kindly confirm receipt and expected fulfillment schedule.<br><br>Regards,<br>DentalCore Procurement`,
      variables: { supplierName, orderNumber, totalAmount, expectedDate },
    };
  }
}
