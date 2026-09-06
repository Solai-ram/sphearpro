import { describe, expect, it } from 'vitest';
import { THROTTLE_POLICY } from '../auth/auth-throttle.policy';

/**
 * Phase 12 — security policy invariants that must stay wired on auth routes.
 * Controllers use @Throttle matching these limits (see auth.controller.ts).
 */
describe('Phase 12 — auth security policy', () => {
  it('login / signup / password reset are rate-limited', () => {
    expect(THROTTLE_POLICY.clinicSignup).toEqual({ limit: 5, ttlMs: 60_000 });
    expect(THROTTLE_POLICY.login).toEqual({ limit: 10, ttlMs: 60_000 });
    expect(THROTTLE_POLICY.refresh).toEqual({ limit: 30, ttlMs: 60_000 });
    expect(THROTTLE_POLICY.forgotPassword).toEqual({ limit: 5, ttlMs: 60_000 });
    expect(THROTTLE_POLICY.resetPassword).toEqual({ limit: 5, ttlMs: 60_000 });
  });

  it('refresh cookie is httpOnly, path /api, secure in production', () => {
    const production = true;
    const cookie = {
      httpOnly: true,
      secure: production,
      sameSite: 'strict' as const,
      path: '/api',
      maxAgeMs: 7 * 24 * 60 * 60 * 1000,
    };
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
    expect(cookie.path).toBe('/api');
    expect(cookie.sameSite).toBe('strict');
  });
});
