import { fetchApi } from '../lib/api';

export interface CommunicationMessage {
  id: string;
  type: string;
  channel: string;
  to: string;
  content: string;
  status: string;
  providerMsgId?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  failedAt?: string | null;
  failureReason?: string | null;
  createdAt: string;
  patient?: { id: string; name: string; patientNumber: string } | null;
  invoice?: { id: string; invoiceNumber: string } | null;
}

export const communicationApi = {
  getMessages(filters?: { status?: string; type?: string; page?: number }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.page) params.append('page', String(filters.page));
    params.append('limit', '50');
    return fetchApi<{ data: CommunicationMessage[]; meta: { total: number } }>(`/communication/messages?${params.toString()}`);
  },
  resend(id: string) {
    return fetchApi(`/communication/messages/${id}/resend`, { method: 'POST' });
  },
  sendInvoice(invoiceId: string) {
    return fetchApi(`/communication/invoices/${invoiceId}/send`, { method: 'POST' });
  },
  getTemplates() {
    return fetchApi<{ id: string; name: string; type: string; body: string; isActive: boolean }[]>('/communication/templates');
  },
  getMetrics() {
    return fetchApi<{ waiting: number; active: number; completed: number; failed: number }>('/communication/queue/metrics');
  },
};
