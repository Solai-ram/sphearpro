import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

export type AuthedUser = {
  sub?: string;
  id?: string;
  clinicId?: string | null;
  roles?: string[];
  permissions?: string[];
  email?: string;
};

/** Derive clinic from authenticated user — never from client payload. */
export function requireClinicId(user: AuthedUser | null | undefined): string {
  const clinicId = user?.clinicId;
  if (!clinicId) {
    throw new UnauthorizedException('Clinic context required');
  }
  return clinicId;
}

export function assertSameClinic(
  resourceClinicId: string | null | undefined,
  actorClinicId: string,
  message = 'Resource not found',
): void {
  if (!resourceClinicId || resourceClinicId !== actorClinicId) {
    // Hide cross-tenant existence
    throw new ForbiddenException(message);
  }
}

export const DEFAULT_CLINIC_ID = 'cldefault00000000000000001';
export const DEFAULT_CLINIC_SLUG = 'default';
