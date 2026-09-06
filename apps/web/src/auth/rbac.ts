export type NavChild = {
  name: string;
  href: string;
  children?: readonly NavChild[];
};

export const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: 'dashboard', roles: ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'BILLING', 'INVENTORY'] },
  {
    name: 'My patients',
    href: '/doctor/sessions',
    icon: 'day',
    roles: ['DOCTOR'],
  },
  {
    name: 'Patients',
    href: '/patients',
    icon: 'patients',
    roles: ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'BILLING'],
    children: [
      { name: 'New OP registration', href: '/patients/new?intent=op' },
      { name: 'OP review registration', href: '/patients/op-review' },
      { name: 'OP reports', href: '/patients' },
      { name: 'Patient search', href: '/patients/lookup' },
      { name: 'Patients Modify', href: '/patients/modify' },
    ],
  },
  {
    name: 'Appointments',
    href: '/appointments',
    icon: 'appointments',
    roles: ['ADMIN', 'RECEPTIONIST'],
    children: [
      { name: 'Assign Doctors', href: '/appointments' },
      { name: 'Calendar', href: '/appointments/calendar' },
      { name: 'Day schedule', href: '/appointments/day' },
      { name: 'Slot timings', href: '/appointments/slots' },
    ],
  },
  {
    name: 'Therapy',
    href: '/therapy',
    icon: 'therapy',
    roles: ['ADMIN', 'RECEPTIONIST'],
    children: [
      { name: 'Therapy registration', href: '/therapy/new' },
      { name: 'Therapy cases', href: '/therapy' },
      { name: 'Packages', href: '/therapy/packages' },
    ],
  },
  {
    name: 'Lab',
    href: '/lab',
    icon: 'lab',
    roles: ['ADMIN', 'DOCTOR', 'RECEPTIONIST'],
    children: [
      { name: 'Dashboard', href: '/lab' },
      { name: 'Lab procedure creation', href: '/lab/procedures/new' },
    ],
  },
  {
    name: 'Billing',
    href: '/billing',
    icon: 'billing',
    roles: ['ADMIN', 'BILLING'],
    children: [
      { name: 'New billing', href: '/billing/new' },
      { name: 'Invoices', href: '/billing' },
      { name: 'Billing report', href: '/billing/report' },
      { name: 'Revenue report', href: '/billing/revenue' },
    ],
  },
  {
    name: 'Inventory',
    href: '/inventory',
    icon: 'inventory',
    roles: ['ADMIN', 'INVENTORY'],
    children: [
      { name: 'Overview', href: '/inventory' },
      { name: 'Item master', href: '/inventory/items' },
      { name: 'Stock report', href: '/inventory/stock' },
      { name: 'Sales report', href: '/inventory/sales' },
      { name: 'Stock entry', href: '/inventory/movements' },
      { name: 'Item returns', href: '/inventory/returns' },
      { name: 'Return report', href: '/inventory/returns-report' },
      { name: 'Suppliers', href: '/inventory/suppliers' },
    ],
  },
  { name: 'Documents', href: '/documents', icon: 'documents', roles: ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'BILLING'] },
  // WhatsApp communication is not available in v1 — hidden from nav
  // { name: 'Communication', href: '/communication', icon: 'communication', roles: ['ADMIN', 'RECEPTIONIST', 'BILLING'] },
  { name: 'AI', href: '/ai', icon: 'ai', roles: ['ADMIN', 'DOCTOR'] },
  {
    name: 'Reports',
    href: '/reports',
    icon: 'reports',
    roles: ['ADMIN', 'BILLING', 'INVENTORY'],
    children: [
      { name: 'OP clinical', href: '/reports/clinical' },
      { name: 'OP visits', href: '/reports/op' },
      { name: 'Therapy', href: '/reports/therapy' },
      { name: 'Lab', href: '/reports/lab' },
      { name: 'Billing', href: '/reports/billing' },
      { name: 'Revenue', href: '/reports/revenue' },
      { name: 'Stock', href: '/reports/stock' },
      { name: 'Sales', href: '/reports/sales' },
      { name: 'Item returns', href: '/reports/returns' },
      { name: 'AI usage', href: '/reports/ai' },
    ],
  },
  { name: 'Users', href: '/users', icon: 'users', roles: ['ADMIN'] },
  { name: 'Roles', href: '/roles', icon: 'roles', roles: ['ADMIN'] },
  {
    name: 'Subscription',
    href: '/subscription',
    icon: 'billing',
    roles: ['ADMIN'],
    children: [
      { name: 'Overview', href: '/subscription' },
      { name: 'Checkout', href: '/subscription/checkout' },
      { name: 'Payments', href: '/subscription/payments' },
      { name: 'Invoices', href: '/subscription/invoices' },
    ],
  },
  { name: 'Audit', href: '/audit', icon: 'audit', roles: ['ADMIN'] },
  { name: 'Settings', href: '/settings', icon: 'settings', roles: ['ADMIN'] },
] as const;

export type AppRole = (typeof navigation)[number]['roles'][number];

const JOB_ROLES: AppRole[] = ['DOCTOR', 'RECEPTIONIST', 'BILLING', 'INVENTORY'];

export const DASHBOARD_WIDGETS: Record<AppRole, string[]> = {
  ADMIN: [
    'total_patients',
    'today_op',
    'active_therapy',
    'today_revenue',
    'outstanding',
    'low_stock',
    'ai_usage',
  ],
  DOCTOR: ['total_patients', 'active_therapy'],
  RECEPTIONIST: ['total_patients', 'active_therapy'],
  BILLING: ['today_revenue', 'outstanding', 'total_patients'],
  INVENTORY: ['low_stock', 'today_revenue'],
};

export function effectiveRoles(roles: string[] = [], staffType?: string | null) {
  const next = [...roles];
  if (staffType === 'THERAPIST') {
    // Legacy accounts: treat as doctor clinically, but login is blocked server-side
    if (!next.includes('DOCTOR')) next.push('DOCTOR');
    return next;
  }
  if (staffType && !next.includes(staffType)) next.push(staffType);
  return next;
}

/** Job the user is working as. Staff type wins so extra roles do not unlock admin menus. */
export function primaryAppRole(roles: string[] = [], staffType?: string | null): AppRole | null {
  if (roles.includes('SUPER_ADMIN') && !roles.includes('ADMIN')) return null;
  if (staffType === 'THERAPIST') return 'DOCTOR';
  if (staffType && (JOB_ROLES as string[]).includes(staffType)) {
    return staffType as AppRole;
  }
  const all = effectiveRoles(roles, staffType);
  if (all.includes('ADMIN') || staffType === 'ADMIN') return 'ADMIN';
  const found = JOB_ROLES.find((role) => all.includes(role));
  return found || null;
}

export function canAccessPath(path: string, roles: string[] = [], staffType?: string | null) {
  if (roles.includes('SUPER_ADMIN')) {
    return path === '/platform' || path.startsWith('/platform/');
  }
  if (path === '/platform' || path.startsWith('/platform/')) return false;

  const role = primaryAppRole(roles, staffType);
  if (!role) return false;
  if (role === 'ADMIN') return true;
  if (path.startsWith('/dashboard-builder')) return false;

  const match = [...navigation]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => path === item.href || path.startsWith(`${item.href}/`));

  if (!match) return false;
  return (match.roles as readonly string[]).includes(role);
}

export function navForUser(roles: string[] = [], staffType?: string | null) {
  const role = primaryAppRole(roles, staffType);
  if (!role) return [];
  return navigation.filter((item) => (item.roles as readonly string[]).includes(role));
}
