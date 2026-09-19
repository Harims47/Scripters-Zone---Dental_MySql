import { WhatsAppProvider } from './WhatsAppProvider';
import { SendMessageOptions, ProviderSendResult } from '../types';

export class AiSensyAdapter implements WhatsAppProvider {
  private apiKey: string;
  private apiBaseUrl: string;
  private isDevelopment: boolean;

  constructor() {
    this.apiKey = process.env.AISENSY_API_KEY || '';
    this.apiBaseUrl = process.env.AISENSY_API_URL || 'https://backend.aisensy.com/campaign/t1/api/v2';
    this.isDevelopment =
      process.env.NOTIFICATION_ENV === 'development' ||
      process.env.NODE_ENV === 'test' ||
      !this.apiKey ||
      this.apiKey.startsWith('mock_');
  }

  public async sendTemplateMessage(options: SendMessageOptions): Promise<ProviderSendResult> {
    const { recipientPhone, recipientName, templateName, variables, attachments, providerReference } = options;

    if (!recipientPhone) {
      return {
        success: false,
        isPermanentFailure: true,
        error: 'Missing recipient phone number',
      };
    }

    // Standardize phone format (remove spaces, hyphens; ensure country code, default to 91 for India)
    let cleanedPhone = recipientPhone.replace(/\D/g, '');
    if (cleanedPhone.length === 10) {
      cleanedPhone = '91' + cleanedPhone;
    }

    const isMock =
      this.isDevelopment ||
      process.env.NOTIFICATION_ENV === 'development' ||
      process.env.NODE_ENV === 'test' ||
      !this.apiKey ||
      this.apiKey.startsWith('mock_') ||
      cleanedPhone.startsWith('91987654');

    // If running in development / test mock mode, simulate realistic behavior
    if (isMock) {
      console.log(`[AiSensy MOCK] Sending WhatsApp to +${cleanedPhone} [Ref: ${providerReference}]:`, {
        template: templateName,
        recipient: recipientName,
        variables,
        hasAttachments: !!attachments?.length,
      });

      // Special test hook: if phone ends with "0000", simulate permanent "NOT_ON_WHATSAPP" failure
      if (cleanedPhone.endsWith('0000')) {
        return {
          success: false,
          isPermanentFailure: true,
          error: 'Recipient is not registered on WhatsApp (Permanent: 131026)',
          providerReference,
        };
      }

      // Special test hook: if phone ends with "9999", simulate temporary timeout / uncertain response
      if (cleanedPhone.endsWith('9999')) {
        return {
          success: false,
          isPermanentFailure: false,
          isUncertainResponse: true,
          error: 'Gateway Timeout (504) - Connection terminated after dispatch',
          providerReference,
        };
      }

      return {
        success: true,
        providerMessageId: `aisensy_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        providerReference,
        rawResponse: { status: 'submitted', mock: true },
      };
    }

    // Live AiSensy API call
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const campaignName =
        (templateName === 'payment_receipt_v1' ? process.env.AISENSY_CAMPAIGN_RECEIPT : undefined) ||
        (templateName?.startsWith('appointment_') ? process.env.AISENSY_CAMPAIGN_APPOINTMENT : undefined) ||
        (templateName === 'prescription_v1' ? process.env.AISENSY_CAMPAIGN_PRESCRIPTION : undefined) ||
        process.env.AISENSY_DEFAULT_CAMPAIGN ||
        templateName ||
        'generic_notification';

      const payload: Record<string, any> = {
        apiKey: this.apiKey,
        campaignName,
        destination: cleanedPhone,
        userName: recipientName || 'Patient',
        templateParams: variables ? Object.values(variables) : [],
        source: 'DentalCore',
        tags: [providerReference],
      };

      if (attachments && attachments.length > 0) {
        payload.media = {
          filename: attachments[0].filename,
          // AiSensy expects hosted URL for media or base64 depending on endpoint configuration
          content: attachments[0].content,
        };
      }

      const response = await fetch(this.apiBaseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseData: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        const statusCode = response.status;
        const errMessage = responseData?.message || responseData?.error || response.statusText;

        // Determine if error indicates recipient does not have WhatsApp or number is invalid
        const isPermanent =
          statusCode === 400 &&
          (errMessage.toLowerCase().includes('not on whatsapp') ||
            errMessage.toLowerCase().includes('unregistered') ||
            errMessage.toLowerCase().includes('invalid phone') ||
            responseData?.code === 131026 ||
            responseData?.code === 100);

        // Determine if server/network failure implies uncertain provider state
        const isUncertain = statusCode >= 500 || statusCode === 408;

        return {
          success: false,
          providerReference,
          error: `AiSensy Error (${statusCode}): ${errMessage}`,
          isPermanentFailure: isPermanent,
          isUncertainResponse: isUncertain,
          rawResponse: responseData,
        };
      }

      return {
        success: true,
        providerMessageId: responseData?.messageId || responseData?.id || `aisensy_${Date.now()}`,
        providerReference,
        rawResponse: responseData,
      };
    } catch (networkError: any) {
      const isTimeout = networkError.name === 'AbortError' || networkError.code === 'ETIMEDOUT';
      return {
        success: false,
        providerReference,
        error: `AiSensy Network Exception: ${networkError.message}`,
        isPermanentFailure: false,
        isUncertainResponse: isTimeout, // If timeout happened, request might have reached provider
      };
    }
  }

  public async checkDeliveryStatus(providerMessageId: string, providerReference?: string): Promise<ProviderSendResult | null> {
    if (this.isDevelopment) {
      return {
        success: true,
        providerMessageId,
        providerReference,
        rawResponse: { status: 'DELIVERED', mock: true },
      };
    }
    // AiSensy status check hook if supported
    return null;
  }
}
