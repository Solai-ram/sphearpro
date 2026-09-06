/**
 * Canonical rate limits for auth endpoints.
 * Keep in sync with @Throttle on AuthController.
 */
export const THROTTLE_POLICY = {
  clinicSignup: { limit: 5, ttlMs: 60_000 },
  login: { limit: 10, ttlMs: 60_000 },
  refresh: { limit: 30, ttlMs: 60_000 },
  forgotPassword: { limit: 5, ttlMs: 60_000 },
  resetPassword: { limit: 5, ttlMs: 60_000 },
} as const;
