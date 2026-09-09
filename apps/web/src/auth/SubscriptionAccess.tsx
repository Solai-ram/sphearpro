import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

export type SubscriptionAccess = {
  allowed: boolean;
  status: string | null;
  reason: string | null;
  features: string[];
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
  gracePeriodEnd?: string | null;
};

type SubscriptionAccessContextValue = {
  access: SubscriptionAccess | null;
  isGrace: boolean;
  isRestricted: boolean;
  hasFeature: (code: string) => boolean;
};

const SubscriptionAccessContext = createContext<SubscriptionAccessContextValue | null>(null);

/** Paths still usable when subscription is expired / suspended (UX only — API enforces). */
export const SUBSCRIPTION_OPEN_PATHS = [
  '/subscription',
  '/pricing',
  '/signup',
  '/register',
  '/login',
  '/forgot-password',
  '/reset-password',
  '/platform',
  '/setup',
];

export function isSubscriptionOpenPath(pathname: string): boolean {
  return SUBSCRIPTION_OPEN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Clinic setup after subscribe — ADMIN only; skip support / platform users. */
export function needsClinicSetup(user: {
  roles?: string[];
  isSystemSupport?: boolean;
  setupComplete?: boolean;
  subscriptionAccess?: { allowed?: boolean } | null;
} | null): boolean {
  if (!user) return false;
  if (user.isSystemSupport) return false;
  if (user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('ADMIN')) return false;
  if (!user.roles?.includes('ADMIN')) return false;
  if (user.subscriptionAccess && user.subscriptionAccess.allowed === false) return false;
  return user.setupComplete === false;
}

export function SubscriptionAccessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const access = (user as { subscriptionAccess?: SubscriptionAccess } | null)?.subscriptionAccess ?? null;

  const value = useMemo<SubscriptionAccessContextValue>(() => {
    const status = access?.status || null;
    const isGrace = status === 'GRACE_PERIOD';
    const isRestricted = Boolean(access && !access.allowed);
    return {
      access,
      isGrace,
      isRestricted,
      hasFeature: (code: string) => Boolean(access?.features?.includes(code)),
    };
  }, [access]);

  return (
    <SubscriptionAccessContext.Provider value={value}>
      {children}
    </SubscriptionAccessContext.Provider>
  );
}

export function useSubscriptionAccess() {
  const ctx = useContext(SubscriptionAccessContext);
  if (!ctx) {
    return {
      access: null,
      isGrace: false,
      isRestricted: false,
      hasFeature: () => false,
    };
  }
  return ctx;
}
