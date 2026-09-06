import type {
  Invoice,
  PaginatedInvoices,
  InvoiceFilters,
  InvoiceItemInput,
  Payment,
  Refund,
  PaymentMethod,
} from '../types/billing';
import { fetchApi, getAccessToken } from '../lib/api';

export const billingApi = {
  async getInvoices(filters?: InvoiceFilters): Promise<PaginatedInvoices> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.search) params.append('search', filters.search);
    if (filters?.patientId) params.append('patientId', filters.patientId);
    if (filters?.status) params.append('status', filters.status);
    return fetchApi(`/billing/invoices?${params.toString()}`);
  },

  async getInvoice(id: string): Promise<Invoice> {
    return fetchApi(`/billing/invoices/${id}`);
  },

  async createInvoice(data: {
    patientId: string;
    dueDate?: string;
    notes?: string;
    items: InvoiceItemInput[];
    payment?: { method: PaymentMethod; amount?: number; reference?: string };
  }): Promise<Invoice> {
    return fetchApi('/billing/invoices', { method: 'POST', body: JSON.stringify(data) });
  },

  async cancelInvoice(id: string): Promise<Invoice> {
    return fetchApi(`/billing/invoices/${id}/cancel`, { method: 'POST' });
  },

  async recordPayment(data: {
    invoiceId: string;
    amount: number;
    method: PaymentMethod;
    reference?: string;
  }): Promise<Payment> {
    return fetchApi('/billing/payments', { method: 'POST', body: JSON.stringify(data) });
  },

  async getPayments(filters?: { page?: number; invoiceId?: string; patientId?: string }): Promise<{
    data: Payment[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.invoiceId) params.append('invoiceId', filters.invoiceId);
    if (filters?.patientId) params.append('patientId', filters.patientId);
    return fetchApi(`/billing/payments?${params.toString()}`);
  },

  async createRefund(data: {
    invoiceId: string;
    paymentId?: string;
    amount: number;
    reason?: string;
  }): Promise<Refund> {
    return fetchApi('/billing/refunds', { method: 'POST', body: JSON.stringify(data) });
  },

  async outstanding() {
    return fetchApi<{ data: Invoice[]; totalOutstanding: number; count: number }>('/billing/reports/outstanding');
  },

  async billingReport(filters?: { period?: string; startDate?: string; endDate?: string }) {
    const params = new URLSearchParams();
    if (filters?.period) params.append('period', filters.period);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    return fetchApi<any>(`/billing/reports/billing?${params.toString()}`);
  },

  async revenue(startDate?: string, endDate?: string, period?: string) {
    const params = new URLSearchParams();
    if (period) params.append('period', period);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return fetchApi<{
      collected: number;
      refunded: number;
      net: number;
      paymentCount: number;
      byMethod: Record<string, number>;
      byDay?: { date: string; collected: number; count: number }[];
      payments?: any[];
    }>(`/billing/reports/revenue?${params.toString()}`);
  },

  async downloadPdf(path: string, fileName: string) {
    const token = getAccessToken();
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) throw new Error('Download failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  },

  downloadInvoicePdf(id: string, invoiceNumber: string) {
    return this.downloadPdf(`/billing/invoices/${id}/pdf`, `${invoiceNumber}.pdf`);
  },

  downloadReceiptPdf(paymentId: string) {
    return this.downloadPdf(`/billing/payments/${paymentId}/receipt`, `receipt-${paymentId}.pdf`);
  },
};
