export type SubscriptionPlanSummary = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  monthlyPricePaise: number;
  monthlyPriceDisplay: string;
  billingAmountPaise?: number;
  billingAmountDisplay?: string;
  currency: string;
  billingInterval: string;
  billingIntervalLabel?: string;
  seatSummary?: string;
  maxStaffUsers?: number;
  maxAdminUsers?: number;
  features?: Array<{ code: string; name: string }>;
};

export type ClinicSeatUsage = {
  maxStaffUsers: number;
  maxAdminUsers: number;
  usedStaffUsers: number;
  usedAdminUsers: number;
  remainingStaffUsers: number;
  remainingAdminUsers: number;
};

export type ClinicSubscription = {
  id: string;
  clinicId: string;
  status: string;
  amountPaise: number;
  currency: string;
  billingInterval: string;
  provider: string;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  startDate?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  trialStart?: string | null;
  trialEnd?: string | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: string | null;
  endedAt?: string | null;
  gracePeriodStart?: string | null;
  gracePeriodEnd?: string | null;
  plan?: SubscriptionPlanSummary;
};

export type SubscriptionAccess = {
  allowed: boolean;
  status: string | null;
  reason: string | null;
  features: string[];
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
  trialEnd?: string | null;
};

export type SubscriptionPaymentRow = {
  id: string;
  amountPaise: number;
  currency: string;
  status: string;
  providerPaymentId?: string | null;
  paymentMethod?: string | null;
  failureReason?: string | null;
  paidAt?: string | null;
  createdAt: string;
};

export type SubscriptionInvoiceRow = {
  id: string;
  invoiceNumber: string;
  amountPaise: number;
  totalAmountPaise: number;
  currency: string;
  status: string;
  invoiceDate: string;
  paidAt?: string | null;
  pdfUrl?: string | null;
};

export function formatPaise(paise: number, currency = 'INR') {
  const amount = (paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return currency === 'INR' ? `₹${amount}` : `${currency} ${amount}`;
}

export function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function statusBadgeClass(status: string | null | undefined) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'GRACE_PERIOD':
      return 'bg-orange-50 text-orange-900 border-orange-200';
    case 'TRIALING':
      return 'bg-sky-50 text-sky-900 border-sky-200';
    case 'PAST_DUE':
    case 'PAYMENT_FAILED':
      return 'bg-amber-50 text-amber-900 border-amber-200';
    case 'EXPIRED':
    case 'CANCELLED':
    case 'SUSPENDED':
      return 'bg-red-50 text-red-800 border-red-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

export function statusLabel(status: string | null | undefined) {
  if (!status) return 'None';
  return status.replace(/_/g, ' ');
}
