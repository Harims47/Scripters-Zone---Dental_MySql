import { SendMessageOptions, ProviderSendResult } from '../types';

export interface SmsProvider {
  sendSms(options: SendMessageOptions): Promise<ProviderSendResult>;
}
