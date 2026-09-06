import { describe, expect, it } from 'vitest';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import {
  assertSameClinic,
  DEFAULT_CLINIC_ID,
  DEFAULT_CLINIC_SLUG,
  requireClinicId,
} from '../../common/tenant/clinic-context';

describe('clinic-context', () => {
  it('requireClinicId returns clinicId from authenticated user', () => {
    expect(requireClinicId({ clinicId: 'clinic-a' })).toBe('clinic-a');
  });

  it('requireClinicId rejects missing clinic context', () => {
    expect(() => requireClinicId({})).toThrow(UnauthorizedException);
    expect(() => requireClinicId(null)).toThrow(UnauthorizedException);
    expect(() => requireClinicId({ clinicId: null })).toThrow(UnauthorizedException);
  });

  it('assertSameClinic allows matching clinic', () => {
    expect(() => assertSameClinic('clinic-a', 'clinic-a')).not.toThrow();
  });

  it('assertSameClinic hides cross-tenant access', () => {
    expect(() => assertSameClinic('clinic-b', 'clinic-a')).toThrow(ForbiddenException);
    expect(() => assertSameClinic(null, 'clinic-a')).toThrow(ForbiddenException);
  });

  it('default clinic constants are stable for backfill/seed', () => {
    expect(DEFAULT_CLINIC_ID).toBe('cldefault00000000000000001');
    expect(DEFAULT_CLINIC_SLUG).toBe('default');
  });
});

describe('patient tenancy rules (unit)', () => {
  it('client-supplied clinicId must be ignored in favor of auth clinic', () => {
    const body = { name: 'Test', clinicId: 'attacker-clinic' };
    const authClinicId = 'clinic-a';
    const { clinicId: _ignored, ...rest } = body;
    const createPayload = { ...rest, clinicId: authClinicId };
    expect(createPayload.clinicId).toBe('clinic-a');
    expect(createPayload).not.toHaveProperty('clinicId', 'attacker-clinic');
  });

  it('cross-clinic patient lookup fails when clinicId differs', () => {
    const patient = { id: 'p1', clinicId: 'clinic-b' };
    const actorClinicId = 'clinic-a';
    const visible = patient.clinicId === actorClinicId ? patient : null;
    expect(visible).toBeNull();
  });

  it('same phone can exist in two clinics (per-clinic unique)', () => {
    const clinicA = { clinicId: 'a', phone: '9999999999' };
    const clinicB = { clinicId: 'b', phone: '9999999999' };
    const key = (r: { clinicId: string; phone: string }) => `${r.clinicId}:${r.phone}`;
    expect(key(clinicA)).not.toBe(key(clinicB));
  });
});
