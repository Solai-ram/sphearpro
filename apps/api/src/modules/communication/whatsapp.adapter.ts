import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WhatsAppSendResult {
  providerMsgId: string;
  mocked: boolean;
}

@Injectable()
export class WhatsAppAdapter {
  private readonly apiKey?: string;
  private readonly phoneNumberId?: string;
  private readonly apiVersion: string;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('WHATSAPP_API_KEY') || undefined;
    this.phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID') || undefined;
    this.apiVersion = this.config.get<string>('WHATSAPP_GRAPH_VERSION') || 'v21.0';
  }

  isLive(): boolean {
    return Boolean(this.apiKey && this.phoneNumberId);
  }

  toE164(phone: string): string {
    const digits = (phone || '').replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) return digits;
    if (digits.length === 10) return `91${digits}`;
    return digits;
  }

  async sendText(to: string, body: string): Promise<WhatsAppSendResult> {
    const recipient = this.toE164(to);
    if (!this.isLive()) {
      console.log(`[WHATSAPP MOCK] To: ${recipient}\n${body}`);
      return { providerMsgId: `wamid.mock.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`, mocked: true };
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'text',
        text: { preview_url: false, body },
      }),
    });

    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.error?.message || JSON.stringify(payload);
      throw new Error(`WhatsApp API ${response.status}: ${detail}`);
    }

    const providerMsgId = payload?.messages?.[0]?.id;
    if (!providerMsgId) throw new Error('WhatsApp API did not return a message id');
    return { providerMsgId, mocked: false };
  }
}
