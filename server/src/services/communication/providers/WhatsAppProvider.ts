import { SendMessageOptions, ProviderSendResult } from '../types';

export interface WhatsAppProvider {
  sendTemplateMessage(options: SendMessageOptions): Promise<ProviderSendResult>;
  checkDeliveryStatus?(providerMessageId: string, providerReference?: string): Promise<ProviderSendResult | null>;
}
