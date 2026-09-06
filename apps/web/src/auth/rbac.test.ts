import { describe, expect, it } from 'vitest';
import {
  canAccessPath,
  effectiveRoles,
  navForUser,
  primaryAppRole,
} from './rbac';

describe('rbac', () => {
  describe('effectiveRoles', () => {
    it('maps THERAPIST staff type to DOCTOR role', () => {
      expect(effectiveRoles([], 'THERAPIST')).toContain('DOCTOR');
    });

    it('adds staffType when missing from roles', () => {
      expect(effectiveRoles(['ADMIN'], 'DOCTOR')).toEqual(['ADMIN', 'DOCTOR']);
    });
  });

  describe('primaryAppRole', () => {
    it('prefers staff job over extra roles', () => {
      expect(primaryAppRole(['ADMIN', 'DOCTOR'], 'DOCTOR')).toBe('DOCTOR');
    });

    it('returns ADMIN when staff is admin', () => {
      expect(primaryAppRole([], 'ADMIN')).toBe('ADMIN');
    });

    it('treats THERAPIST as DOCTOR', () => {
      expect(primaryAppRole([], 'THERAPIST')).toBe('DOCTOR');
    });
    it('returns null when no job role is known (fail closed)', () => {
      expect(primaryAppRole([])).toBeNull();
    });
  });

  describe('canAccessPath', () => {
    it('allows admin everywhere', () => {
      expect(canAccessPath('/users', ['ADMIN'])).toBe(true);
      expect(canAccessPath('/billing', ['ADMIN'])).toBe(true);
    });

    it('lets doctors open My patients but not Therapy admin', () => {
      expect(canAccessPath('/doctor/sessions', ['DOCTOR'], 'DOCTOR')).toBe(true);
      expect(canAccessPath('/therapy', ['DOCTOR'], 'DOCTOR')).toBe(false);
    });

    it('blocks non-admin from dashboard builder', () => {
      expect(canAccessPath('/dashboard-builder', ['DOCTOR'], 'DOCTOR')).toBe(false);
    });

    it('lets receptionist open appointments', () => {
      expect(canAccessPath('/appointments/day', [], 'RECEPTIONIST')).toBe(true);
    });

    it('denies unmatched paths (fail closed)', () => {
      expect(canAccessPath('/secret-new-route', [], 'DOCTOR')).toBe(false);
    });

    it('SUPER_ADMIN only reaches /platform', () => {
      expect(canAccessPath('/platform', ['SUPER_ADMIN'])).toBe(true);
      expect(canAccessPath('/platform/subscriptions', ['SUPER_ADMIN'])).toBe(true);
      expect(canAccessPath('/patients', ['SUPER_ADMIN'])).toBe(false);
    });

    it('clinic ADMIN cannot open /platform', () => {
      expect(canAccessPath('/platform', ['ADMIN'], 'ADMIN')).toBe(false);
    });

    it('doctor cannot open SaaS subscription billing pages', () => {
      expect(canAccessPath('/subscription', ['DOCTOR'], 'DOCTOR')).toBe(false);
      expect(canAccessPath('/subscription/checkout', ['DOCTOR'], 'DOCTOR')).toBe(false);
    });

    it('clinic ADMIN can open SaaS subscription pages', () => {
      expect(canAccessPath('/subscription', ['ADMIN'], 'ADMIN')).toBe(true);
      expect(canAccessPath('/subscription/payments', ['ADMIN'], 'ADMIN')).toBe(true);
    });
  });

  describe('navForUser', () => {
    it('shows My patients for doctors, not Therapy registration', () => {
      const names = navForUser([], 'DOCTOR').map((n) => n.name);
      expect(names).toContain('My patients');
      expect(names).not.toContain('Therapy');
      expect(names).not.toContain('Users');
    });

    it('shows Subscription for admin and hides Communication in v1', () => {
      const names = navForUser(['ADMIN']).map((n) => n.name);
      expect(names).toContain('Users');
      expect(names).toContain('Roles');
      expect(names).toContain('Audit');
      expect(names).toContain('Subscription');
      expect(names).not.toContain('Communication');
    });
  });
});
