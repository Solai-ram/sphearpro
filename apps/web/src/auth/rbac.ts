export type AppRole = 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'BILLING' | 'INVENTORY';

export type NavChild = {
  name: string;
  href: string;
  /** If omitted, inherits parent module roles */
  roles?: readonly AppRole[];
  children?: readonly NavChild[];
};

export type NavItem = {
  name: string;
  href: string;
  icon: string;
  roles: readonly AppRole[];
  children?: readonly NavChild[];
};

/**
 * Module visibility by job role.
 * ADMIN sees everything; other roles only their modules / sub-items.
 */
export const navigation: readonly NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: 'dashboard',
    roles: ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'BILLING', 'INVENTORY'],
  },
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
      {
        name: 'New OP registration',
        href: '/patients/new?intent=op',
        roles: ['ADMIN', 'RECEPTIONIST'],
      },
      {
        name: 'OP review registration',
        href: '/patients/op-review',
        roles: ['ADMIN', 'RECEPTIONIST'],
      },
      {
        name: 'Service masters',
        href: '/patients/services',
        roles: ['ADMIN', 'RECEPTIONIST'],
      },
      {
        name: 'OP reports',
        href: '/patients',
        roles: ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'BILLING'],
      },
      {
        name: 'Patient search',
        href: '/patients/lookup',
        roles: ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'BILLING'],
      },
      {
        name: 'Patients Modify',
        href: '/patients/modify',
        roles: ['ADMIN', 'RECEPTIONIST'],
      },
    ],
  },
  {
    name: 'Appointments',
    href: '/appointments',
    icon: 'appointments',
    roles: ['ADMIN', 'DOCTOR', 'RECEPTIONIST'],
    children: [
      {
        name: 'Assign Doctors',
        href: '/appointments',
        roles: ['ADMIN', 'RECEPTIONIST'],
      },
      {
        name: 'Calendar',
        href: '/appointments/calendar',
        roles: ['ADMIN', 'DOCTOR', 'RECEPTIONIST'],
      },
      {
        name: 'Day schedule',
        href: '/appointments/day',
        roles: ['ADMIN', 'DOCTOR', 'RECEPTIONIST'],
      },
      {
        name: 'Slot timings',
        href: '/appointments/slots',
        roles: ['ADMIN', 'RECEPTIONIST'],
      },
    ],
  },
  {
    name: 'Therapy',
    href: '/therapy',
    icon: 'therapy',
    roles: ['ADMIN', 'RECEPTIONIST'],
    children: [
      { name: 'Therapy registration', href: '/therapy/new', roles: ['ADMIN', 'RECEPTIONIST'] },
      { name: 'Therapy cases', href: '/therapy', roles: ['ADMIN', 'RECEPTIONIST'] },
      { name: 'Packages', href: '/therapy/packages', roles: ['ADMIN', 'RECEPTIONIST'] },
    ],
  },
  {
    name: 'Audio',
    href: '/lab',
    icon: 'lab',
    roles: ['ADMIN', 'DOCTOR', 'RECEPTIONIST'],
    children: [
      { name: 'Dashboard', href: '/lab', roles: ['ADMIN', 'DOCTOR', 'RECEPTIONIST'] },
      {
        name: 'Audio procedure creation',
        href: '/lab/procedures/new',
        roles: ['ADMIN', 'RECEPTIONIST'],
      },
    ],
  },
  {
    name: 'Billing',
    href: '/billing',
    icon: 'billing',
    roles: ['ADMIN', 'BILLING'],
    children: [
      { name: 'New billing', href: '/billing/new', roles: ['ADMIN', 'BILLING'] },
      { name: 'Invoices', href: '/billing', roles: ['ADMIN', 'BILLING'] },
      { name: 'Billing report', href: '/billing/report', roles: ['ADMIN', 'BILLING'] },
      { name: 'Revenue report', href: '/billing/revenue', roles: ['ADMIN', 'BILLING'] },
    ],
  },
  {
    name: 'Inventory',
    href: '/inventory',
    icon: 'inventory',
    roles: ['ADMIN', 'INVENTORY'],
    children: [
      { name: 'Overview', href: '/inventory', roles: ['ADMIN', 'INVENTORY'] },
      { name: 'Item master', href: '/inventory/items', roles: ['ADMIN', 'INVENTORY'] },
      { name: 'Stock report', href: '/inventory/stock', roles: ['ADMIN', 'INVENTORY'] },
      { name: 'Sales report', href: '/inventory/sales', roles: ['ADMIN', 'INVENTORY'] },
      { name: 'Stock entry', href: '/inventory/movements', roles: ['ADMIN', 'INVENTORY'] },
      { name: 'Item returns', href: '/inventory/returns', roles: ['ADMIN', 'INVENTORY'] },
      { name: 'Return report', href: '/inventory/returns-report', roles: ['ADMIN', 'INVENTORY'] },
      { name: 'Suppliers', href: '/inventory/suppliers', roles: ['ADMIN', 'INVENTORY'] },
    ],
  },
  {
    name: 'Documents',
    href: '/documents',
    icon: 'documents',
    roles: ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'BILLING'],
  },
  // WhatsApp communication is not available in v1 — hidden from nav
  {
    name: 'AI',
    href: '/ai',
    icon: 'ai',
    roles: ['ADMIN', 'DOCTOR'],
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: 'reports',
    roles: ['ADMIN', 'BILLING', 'INVENTORY'],
    children: [
      { name: 'OP clinical reports', href: '/reports/clinical', roles: ['ADMIN'] },
      { name: 'OP visits reports', href: '/reports/op', roles: ['ADMIN'] },
      { name: 'Therapy reports', href: '/reports/therapy', roles: ['ADMIN'] },
      { name: 'Audio reports', href: '/reports/lab', roles: ['ADMIN'] },
      { name: 'Billing reports', href: '/reports/billing', roles: ['ADMIN', 'BILLING'] },
      { name: 'Revenue reports', href: '/reports/revenue', roles: ['ADMIN', 'BILLING'] },
      { name: 'Stock reports', href: '/reports/stock', roles: ['ADMIN', 'INVENTORY'] },
      { name: 'Sales reports', href: '/reports/sales', roles: ['ADMIN', 'INVENTORY'] },
      { name: 'Item returns reports', href: '/reports/returns', roles: ['ADMIN', 'INVENTORY'] },
      { name: 'AI usage reports', href: '/reports/ai', roles: ['ADMIN'] },
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
      { name: 'Overview', href: '/subscription', roles: ['ADMIN'] },
      { name: 'Checkout', href: '/subscription/checkout', roles: ['ADMIN'] },
      { name: 'Payments', href: '/subscription/payments', roles: ['ADMIN'] },
      { name: 'Invoices', href: '/subscription/invoices', roles: ['ADMIN'] },
    ],
  },
  { name: 'Audit', href: '/audit', icon: 'audit', roles: ['ADMIN'] },
  { name: 'Settings', href: '/settings', icon: 'settings', roles: ['ADMIN'] },
];

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
  DOCTOR: ['total_patients', 'today_op', 'active_therapy'],
  RECEPTIONIST: ['total_patients', 'today_op', 'active_therapy'],
  BILLING: ['today_revenue', 'outstanding', 'total_patients'],
  INVENTORY: ['low_stock', 'today_revenue'],
};

function hrefPath(href: string) {
  return href.split('?')[0];
}

function pathMatches(path: string, href: string) {
  const base = hrefPath(href);
  return path === base || path.startsWith(`${base}/`);
}

function childRoles(parent: NavItem, child: NavChild): readonly AppRole[] {
  return child.roles || parent.roles;
}

export function effectiveRoles(roles: string[] = [], staffType?: string | null) {
  const next = [...roles];
  if (staffType === 'THERAPIST') {
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

/** Extra detail routes that belong to a module but are not listed as nav children. */
function extraAllowedPath(path: string, role: AppRole): boolean {
  // Patient profile / documents / OP receipt
  if (
    /^\/patients\/[^/]+$/.test(path) ||
    /^\/patients\/[^/]+\/(edit|documents)$/.test(path) ||
    path.startsWith('/patients/op-receipt/') ||
    path === '/patients/op-new'
  ) {
    return (['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'BILLING'] as AppRole[]).includes(role);
  }
  // Appointment detail / assign flow
  if (path.startsWith('/appointments/assign/') || /^\/appointments\/[^/]+$/.test(path)) {
    if (path.startsWith('/appointments/assign/')) {
      return (['ADMIN', 'RECEPTIONIST'] as AppRole[]).includes(role);
    }
    return (['ADMIN', 'DOCTOR', 'RECEPTIONIST'] as AppRole[]).includes(role);
  }
  // Therapy case detail
  if (/^\/therapy\/[^/]+$/.test(path)) {
    return (['ADMIN', 'RECEPTIONIST'] as AppRole[]).includes(role);
  }
  // Doctor session workspace
  if (path.startsWith('/doctor/sessions/')) {
    return role === 'DOCTOR' || role === 'ADMIN';
  }
  if (path === '/setup' || path.startsWith('/setup/')) {
    return role === 'ADMIN';
  }
  // Billing invoice detail / print
  if (path.startsWith('/billing/')) {
    return (['ADMIN', 'BILLING'] as AppRole[]).includes(role);
  }
  return false;
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

  // Prefer longest / most specific nav href (children before parents).
  type Candidate = { href: string; roles: readonly AppRole[] };
  const candidates: Candidate[] = [];
  for (const item of navigation) {
    for (const child of item.children || []) {
      candidates.push({ href: hrefPath(child.href), roles: childRoles(item, child) });
    }
    candidates.push({ href: hrefPath(item.href), roles: item.roles });
  }

  const matches = candidates.filter((c) => pathMatches(path, c.href));
  if (matches.length) {
    const maxLen = Math.max(...matches.map((c) => c.href.length));
    const top = matches.filter((c) => c.href.length === maxLen);
    // Same path can be listed as parent + child (e.g. /patients, /appointments) — allow if any entry permits the role.
    return top.some((c) => c.roles.includes(role));
  }

  return extraAllowedPath(path, role);
}

export function navForUser(roles: string[] = [], staffType?: string | null): NavItem[] {
  const role = primaryAppRole(roles, staffType);
  if (!role) return [];

  return navigation
    .filter((item) => item.roles.includes(role))
    .map((item) => {
      if (!item.children?.length) return { ...item };
      const children = item.children.filter((child) => childRoles(item, child).includes(role));
      if (!children.length) {
        // Module allowed but no visible children — keep parent link only when href itself is useful
        return { ...item, children: undefined };
      }
      return { ...item, children };
    })
    .filter((item) => {
      // Drop empty parent sections that only existed for children the role cannot see
      if (item.children && item.children.length === 0) return false;
      return true;
    });
}
