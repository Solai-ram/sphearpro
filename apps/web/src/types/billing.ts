export type InvoiceStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED' | 'CANCELLED';
export type BillableType = 'OP_VISIT' | 'THERAPY_PACKAGE' | 'THERAPY_SESSION' | 'PRODUCT' | 'LAB_TEST' | 'OTHER';
export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'NET_BANKING' | 'WALLET' | 'OTHER';
export type PaymentStatus = 'SUCCESS' | 'FAILED' | 'PENDING' | 'REFUNDED';

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  billableType: BillableType;
  referenceId?: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number | string;
  discount: number | string;
  tax: number | string;
  lineTotal: number | string;
  model?: string | null;
  serialNo?: string | null;
  warranty?: string | null;
  colour?: string | null;
}

export interface Payment {
  id: string;
  invoiceId: string;
  patientId: string;
  amount: number | string;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: string;
  reference?: string;
  invoice?: { id: string; invoiceNumber: string; grandTotal: number | string; status: InvoiceStatus };
  patient?: { id: string; name: string; patientNumber: string };
}

export interface Refund {
  id: string;
  invoiceId: string;
  paymentId?: string;
  amount: number | string;
  reason?: string;
  status: string;
  refundedAt: string;
}

export interface Invoice {
  id: string;
  patientId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  status: InvoiceStatus;
  subtotal: number | string;
  discountTotal: number | string;
  taxTotal: number | string;
  grandTotal: number | string;
  paidAmount?: number | string;
  refundedAmount?: number | string;
  outstanding?: number | string;
  notes?: string;
  patient?: { id: string; name: string; patientNumber: string; phone?: string; email?: string; address?: unknown };
  items?: InvoiceItem[];
  payments?: Payment[];
  refunds?: Refund[];
}

export interface InvoiceItemInput {
  billableType: BillableType;
  referenceId?: string;
  productId?: string;
  description: string;
  quantity?: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
  model?: string;
  serialNo?: string;
  warranty?: string;
  colour?: string;
}

export interface PaginatedInvoices {
  data: Invoice[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface InvoiceFilters {
  page?: number;
  limit?: number;
  search?: string;
  patientId?: string;
  status?: string;
}
