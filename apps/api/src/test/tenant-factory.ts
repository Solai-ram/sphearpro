import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

function slug() {
  return `c${randomBytes(6).toString('hex')}`;
}

export type TestTenant = {
  clinic: { id: string; slug: string; name: string; email: string };
  adminUser: { id: string; email: string };
  adminRole: { id: string };
  therapist: { id: string; name: string };
};

export async function createTestTenant(prisma: PrismaClient): Promise<TestTenant> {
  const clinicSlug = slug();
  const clinic = await prisma.clinic.create({
    data: {
      name: `Clinic ${clinicSlug}`,
      slug: clinicSlug,
      email: `${clinicSlug}@example.com`,
      status: 'ACTIVE',
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN', description: 'Clinic admin', isSystem: true },
  });

  const adminUser = await prisma.user.create({
    data: {
      clinicId: clinic.id,
      email: `admin-${clinicSlug}@example.com`,
      passwordHash: 'test-hash',
      name: 'Admin User',
      status: 'ACTIVE',
      staffType: 'ADMIN',
      roles: { create: { roleId: adminRole.id } },
    },
  });

  const therapist = await prisma.staffProfile.create({
    data: {
      clinicId: clinic.id,
      name: 'Therapist One',
      staffType: 'THERAPIST',
      isProvider: true,
    },
  });

  return {
    clinic: { id: clinic.id, slug: clinic.slug, name: clinic.name, email: clinic.email || '' },
    adminUser: { id: adminUser.id, email: adminUser.email },
    adminRole: { id: adminRole.id },
    therapist: { id: therapist.id, name: therapist.name },
  };
}

export async function createTestPatient(
  prisma: PrismaClient,
  clinicId: string,
  overrides: { name?: string; phone?: string } = {},
) {
  const n = randomBytes(3).toString('hex');
  return prisma.patient.create({
    data: {
      clinicId,
      patientNumber: `P${n}`,
      name: overrides.name || `Patient ${n}`,
      phone: overrides.phone || `9${n.slice(0, 9).padEnd(9, '0')}`,
      gender: 'UNKNOWN',
    },
  });
}

export async function createOpCase(
  prisma: PrismaClient,
  clinicId: string,
  patientId: string,
  providerId?: string,
) {
  return prisma.opCase.create({
    data: {
      clinicId,
      patientId,
      providerId,
      chiefComplaint: 'Follow-up',
      status: 'OPEN',
    },
  });
}

export async function ensureStandardPlan(prisma: PrismaClient) {
  return prisma.subscriptionPlan.upsert({
    where: { code: 'STANDARD' },
    update: { isActive: true, trialDays: 7 },
    create: {
      code: 'STANDARD',
      name: 'SPHEAR Standard',
      monthlyPricePaise: 180_000,
      currency: 'INR',
      billingInterval: 'MONTHLY',
      maxStaffUsers: 5,
      maxAdminUsers: 1,
      trialDays: 7,
      isActive: true,
      sortOrder: 1,
    },
  });
}

export function futureStart(daysFromNow = 7) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(10, 0, 0, 0);
  return d;
}
