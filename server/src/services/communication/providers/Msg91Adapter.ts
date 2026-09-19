import { SmsProvider } from './SmsProvider';
import { SendMessageOptions, ProviderSendResult } from '../types';

export class Msg91Adapter implements SmsProvider {
  private authKey: string;
  private senderId: string;
  private apiBaseUrl: string;
  private isDevelopment: boolean;

  constructor() {
    this.authKey = process.env.MSG91_AUTH_KEY || '';
    this.senderId = process.env.MSG91_SENDER_ID || 'DNTLCR';
    this.apiBaseUrl = process.env.MSG91_API_URL || 'https://api.msg91.com/api/v5/flow/';
    this.isDevelopment =
      process.env.NOTIFICATION_ENV === 'development' ||
      process.env.NODE_ENV === 'test' ||
      !this.authKey ||
      this.authKey.startsWith('mock_');
  }

  public async sendSms(options: SendMessageOptions): Promise<ProviderSendResult> {
    const { recipientPhone, messageBody, variables, templateName, providerReference } = options;

    if (!recipientPhone) {
      return {
        success: false,
        isPermanentFailure: true,
        error: 'Missing recipient phone number',
      };
    }

    let cleanedPhone = recipientPhone.replace(/\D/g, '');
    if (cleanedPhone.length === 10) {
      cleanedPhone = '91' + cleanedPhone;
    }

    if (this.isDevelopment) {
      console.log(`[MSG91 MOCK] Sending SMS to +${cleanedPhone} [Ref: ${providerReference}]:`, {
        template: templateName,
        message: messageBody,
        variables,
      });

      return {
        success: true,
        providerMessageId: `msg91_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        providerReference,
        rawResponse: { type: 'success', mock: true },
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const payload = {
        template_id: templateName || process.env.MSG91_DEFAULT_FLOW_ID || '',
        short_url: '0',
        recipients: [
          {
            mobiles: cleanedPhone,
            client_ref: providerReference,
            ...(variables || {}),
          },
        ],
      };

      const response = await fetch(this.apiBaseUrl, {
        method: 'POST',
        headers: {
          'authkey': this.authKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseData: any = await response.json().catch(() => ({}));

      if (!response.ok || responseData?.type === 'error') {
        const errorMsg = responseData?.message || response.statusText;
        return {
          success: false,
          providerReference,
          error: `MSG91 Error: ${errorMsg}`,
          isPermanentFailure: response.status === 400,
          rawResponse: responseData,
        };
      }

      return {
        success: true,
        providerMessageId: responseData?.request_id || `msg91_${Date.now()}`,
        providerReference,
        rawResponse: responseData,
      };
    } catch (networkError: any) {
      const isTimeout = networkError.name === 'AbortError' || networkError.code === 'ETIMEDOUT';
      return {
        success: false,
        providerReference,
        error: `MSG91 Network Exception: ${networkError.message}`,
        isPermanentFailure: false,
        isUncertainResponse: isTimeout,
      };
    }
  }
}
