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

    it('lets doctors open clinical modules but not admin/billing/therapy desk', () => {
      expect(canAccessPath('/doctor/sessions', ['DOCTOR'], 'DOCTOR')).toBe(true);
      expect(canAccessPath('/appointments/day', ['DOCTOR'], 'DOCTOR')).toBe(true);
      expect(canAccessPath('/patients/lookup', ['DOCTOR'], 'DOCTOR')).toBe(true);
      expect(canAccessPath('/therapy', ['DOCTOR'], 'DOCTOR')).toBe(false);
      expect(canAccessPath('/billing', ['DOCTOR'], 'DOCTOR')).toBe(false);
      expect(canAccessPath('/patients/new', ['DOCTOR'], 'DOCTOR')).toBe(false);
      expect(canAccessPath('/patients/services', ['DOCTOR'], 'DOCTOR')).toBe(false);
      expect(canAccessPath('/lab/procedures/new', ['DOCTOR'], 'DOCTOR')).toBe(false);
      expect(canAccessPath('/appointments/slots', ['DOCTOR'], 'DOCTOR')).toBe(false);
    });

    it('blocks non-admin from dashboard builder', () => {
      expect(canAccessPath('/dashboard-builder', ['DOCTOR'], 'DOCTOR')).toBe(false);
    });

    it('lets receptionist open front-desk paths', () => {
      expect(canAccessPath('/appointments/day', [], 'RECEPTIONIST')).toBe(true);
      expect(canAccessPath('/patients/new', [], 'RECEPTIONIST')).toBe(true);
      expect(canAccessPath('/billing', [], 'RECEPTIONIST')).toBe(false);
      expect(canAccessPath('/inventory', [], 'RECEPTIONIST')).toBe(false);
    });

    it('lets billing open invoices but not inventory', () => {
      expect(canAccessPath('/billing/new', [], 'BILLING')).toBe(true);
      expect(canAccessPath('/reports/revenue', [], 'BILLING')).toBe(true);
      expect(canAccessPath('/inventory', [], 'BILLING')).toBe(false);
      expect(canAccessPath('/appointments', [], 'BILLING')).toBe(false);
    });

    it('lets inventory open stock but not patients desk', () => {
      expect(canAccessPath('/inventory/items', [], 'INVENTORY')).toBe(true);
      expect(canAccessPath('/reports/stock', [], 'INVENTORY')).toBe(true);
      expect(canAccessPath('/patients', [], 'INVENTORY')).toBe(false);
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
    it('shows only doctor modules', () => {
      const nav = navForUser([], 'DOCTOR');
      const names = nav.map((n) => n.name);
      expect(names).toContain('My patients');
      expect(names).toContain('Patients');
      expect(names).toContain('Appointments');
      expect(names).toContain('AI');
      expect(names).not.toContain('Therapy');
      expect(names).not.toContain('Billing');
      expect(names).not.toContain('Inventory');
      expect(names).not.toContain('Users');
      expect(names).not.toContain('Reports');

      const patientChildren = nav.find((n) => n.name === 'Patients')?.children?.map((c) => c.name) || [];
      expect(patientChildren).toContain('Patient search');
      expect(patientChildren).not.toContain('New OP registration');
      expect(patientChildren).not.toContain('Service masters');

      const apptChildren = nav.find((n) => n.name === 'Appointments')?.children?.map((c) => c.name) || [];
      expect(apptChildren).toContain('Day schedule');
      expect(apptChildren).not.toContain('Slot timings');
    });

    it('shows front-desk modules for receptionist', () => {
      const names = navForUser([], 'RECEPTIONIST').map((n) => n.name);
      expect(names).toContain('Patients');
      expect(names).toContain('Appointments');
      expect(names).toContain('Therapy');
      expect(names).not.toContain('Billing');
      expect(names).not.toContain('Users');
      expect(names).not.toContain('My patients');
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
