import { EmailProvider } from './EmailProvider';
import { SendMessageOptions, ProviderSendResult } from '../types';

export class BrevoAdapter implements EmailProvider {
  private apiKey: string;
  private senderEmail: string;
  private senderName: string;
  private apiBaseUrl: string;
  private isDevelopment: boolean;

  constructor() {
    this.apiKey = process.env.BREVO_API_KEY || '';
    this.senderEmail = process.env.BREVO_SENDER_EMAIL || 'notifications@dentalcore.com';
    this.senderName = process.env.BREVO_SENDER_NAME || 'DentalCore Clinic';
    this.apiBaseUrl = process.env.BREVO_API_URL || 'https://api.brevo.com/v3/smtp/email';
    this.isDevelopment =
      process.env.NOTIFICATION_ENV === 'development' ||
      process.env.NODE_ENV === 'test' ||
      !this.apiKey ||
      this.apiKey.startsWith('mock_');
  }

  public async sendEmail(
    options: SendMessageOptions & {
      subject: string;
      htmlContent: string;
    }
  ): Promise<ProviderSendResult> {
    const { recipientEmail, recipientName, subject, htmlContent, attachments, providerReference } = options;

    if (!recipientEmail) {
      return {
        success: false,
        isPermanentFailure: true,
        error: 'Missing recipient email address',
      };
    }

    if (this.isDevelopment) {
      console.log(`[Brevo MOCK] Sending Email to ${recipientEmail} [Ref: ${providerReference}]:`, {
        subject,
        recipient: recipientName,
        attachmentsCount: attachments?.length || 0,
      });

      return {
        success: true,
        providerMessageId: `brevo_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        providerReference,
        rawResponse: { messageId: `mock_${Date.now()}`, mock: true },
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const payload: Record<string, any> = {
        sender: { name: this.senderName, email: this.senderEmail },
        to: [{ email: recipientEmail, name: recipientName || recipientEmail }],
        subject,
        htmlContent,
        headers: {
          'X-DentalCore-Ref': providerReference,
        },
      };

      if (attachments && attachments.length > 0) {
        payload.attachment = attachments.map((att) => ({
          name: att.filename,
          content: att.content,
        }));
      }

      const response = await fetch(this.apiBaseUrl, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseData: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = responseData?.message || response.statusText;
        return {
          success: false,
          providerReference,
          error: `Brevo Error: ${errorMsg}`,
          isPermanentFailure: response.status === 400,
          rawResponse: responseData,
        };
      }

      return {
        success: true,
        providerMessageId: responseData?.messageId || `brevo_${Date.now()}`,
        providerReference,
        rawResponse: responseData,
      };
    } catch (networkError: any) {
      const isTimeout = networkError.name === 'AbortError' || networkError.code === 'ETIMEDOUT';
      return {
        success: false,
        providerReference,
        error: `Brevo Network Exception: ${networkError.message}`,
        isPermanentFailure: false,
        isUncertainResponse: isTimeout,
      };
    }
  }
}
