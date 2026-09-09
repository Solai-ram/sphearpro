import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchApi, getAccessToken, logoutApi, setAccessToken } from '../lib/api';
import { effectiveRoles } from './rbac';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  clinicId?: string | null;
  clinic?: { id: string; name: string; slug: string } | null;
  staffType?: string | null;
  staffProfileId?: string | null;
  isSystemSupport?: boolean;
  roles: string[];
  permissions: string[];
  subscriptionAccess?: {
    allowed: boolean;
    status: string | null;
    reason: string | null;
    features: string[];
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string | null;
  };
  /** False until clinic finishes post-subscription setup (letterhead + ID formats). */
  setupComplete?: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  hasRole: (...roles: string[]) => boolean;
  hasPermission: (permission: string) => boolean;
  refresh: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    // Bootstrap: cookie refresh may mint access token if memory empty
    const me = await fetchApi<AuthUser>('/auth/me');
    setUser({
      id: me.id,
      email: me.email,
      name: me.name,
      clinicId: me.clinicId ?? null,
      clinic: me.clinic ?? null,
      staffType: me.staffType,
      staffProfileId: me.staffProfileId ?? null,
      isSystemSupport: Boolean(me.isSystemSupport),
      roles: effectiveRoles(me.roles || [], me.staffType),
      permissions: me.permissions || [],
      subscriptionAccess: me.subscriptionAccess,
      setupComplete: me.setupComplete !== false,
    });
  }, []);

  useEffect(() => {
    // Drop any legacy tokens left in localStorage
    setAccessToken(getAccessToken());
    refresh()
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, [refresh]);

  const logout = useCallback(() => {
    void logoutApi().finally(() => {
      setUser(null);
      window.location.assign('/login');
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    ready,
    hasRole: (...roles: string[]) => {
      if (!user) return false;
      if (user.roles.includes('ADMIN')) return true;
      return roles.some((role) => user.roles.includes(role));
    },
    hasPermission: (permission: string) => {
      if (!user) return false;
      if (user.roles.includes('ADMIN')) return true;
      return user.permissions.includes(permission);
    },
    refresh,
    logout,
  }), [user, ready, refresh, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
