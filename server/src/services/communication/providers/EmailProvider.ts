import { SendMessageOptions, ProviderSendResult } from '../types';

export interface EmailProvider {
  sendEmail(
    options: SendMessageOptions & {
      subject: string;
      htmlContent: string;
    }
  ): Promise<ProviderSendResult>;
}
