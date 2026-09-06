import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TherapyService } from './therapy.service';
import { BillingService } from '../billing/billing.service';
import { AuditService } from '../audit/audit.service';
import { disconnectTestPrisma, getTestPrisma, truncateAll, describeDb } from '../../test/prisma-test';
import {
  createOpCase,
  createTestPatient,
  createTestTenant,
  futureStart,
} from '../../test/tenant-factory';

function commStub() {
  return {
    queueInvoiceNotification: vi.fn().mockResolvedValue(undefined),
    queuePaymentReceipt: vi.fn().mockResolvedValue(undefined),
    queueTherapySessions: vi.fn().mockResolvedValue(undefined),
  };
}

describeDb('TherapyService (database)', () => {
  let prisma: PrismaClient | null;
  let therapy: TherapyService;
  let billing: BillingService;

  beforeAll(async () => {
    prisma = await getTestPrisma();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  beforeEach(async () => {
    if (!prisma) return;
    await truncateAll(prisma);
    const audit = new AuditService(prisma);
    const comm = commStub();
    billing = new BillingService(prisma, audit, comm as any);
    therapy = new TherapyService(prisma, audit, billing, {} as any, comm as any);
  });

  it('generates weekly sessions from an assigned package', async () => {
    if (!prisma) return;
    const tenant = await createTestTenant(prisma);
    const patient = await createTestPatient(prisma, tenant.clinic.id);
    await createOpCase(prisma, tenant.clinic.id, patient.id, tenant.therapist.id);
    const type = await therapy.createType({ clinicId: tenant.clinic.id, name: 'Speech' }, tenant.adminUser.id);
    const pkg = await therapy.createPackage(
      {
        clinicId: tenant.clinic.id,
        therapyTypeId: type.id,
        name: '8-week speech',
        totalSessions: 4,
        frequency: 'WEEKLY',
        price: 8000,
        validityDays: 120,
      },
      tenant.adminUser.id,
    );
    const therapyCase = await therapy.createCase({
      clinicId: tenant.clinic.id,
      patientId: patient.id,
      therapistId: tenant.therapist.id,
      title: 'Speech therapy',
      createdBy: tenant.adminUser.id,
    });
    const start = futureStart(3);
    const assigned = await therapy.assignPackage(therapyCase.id, tenant.clinic.id, {
      packageId: pkg.id,
      startDate: start,
      createdBy: tenant.adminUser.id,
    });
    expect(assigned.sessionsGenerated).toBe(4);
    const dates = assigned.sessions.map((s: { scheduledAt: Date }) => new Date(s.scheduledAt).getTime());
    expect(dates[1] - dates[0]).toBe(7 * 86_400_000);
    expect(assigned.remainingSessions).toBe(4);
  });

  it('package attendance PRESENT increments usedSessions and does not extra-bill the session', async () => {
    if (!prisma) return;
    const tenant = await createTestTenant(prisma);
    const patient = await createTestPatient(prisma, tenant.clinic.id);
    await createOpCase(prisma, tenant.clinic.id, patient.id, tenant.therapist.id);
    const type = await therapy.createType({ clinicId: tenant.clinic.id, name: 'OT' }, tenant.adminUser.id);
    const pkg = await therapy.createPackage(
      {
        clinicId: tenant.clinic.id,
        therapyTypeId: type.id,
        name: 'OT pack',
        totalSessions: 2,
        frequency: 'WEEKLY',
        price: 2000,
      },
      tenant.adminUser.id,
    );
    const therapyCase = await therapy.createCase({
      clinicId: tenant.clinic.id,
      patientId: patient.id,
      therapistId: tenant.therapist.id,
      title: 'OT',
      createdBy: tenant.adminUser.id,
    });
    const assigned = await therapy.assignPackage(therapyCase.id, tenant.clinic.id, {
      packageId: pkg.id,
      startDate: futureStart(2),
      createdBy: tenant.adminUser.id,
    });
    const invoicesAfterPackage = await prisma.invoice.count({ where: { clinicId: tenant.clinic.id } });
    await therapy.markAttendance(assigned.sessions[0].id, tenant.clinic.id, {
      status: 'PRESENT',
      createdBy: tenant.adminUser.id,
    });
    const invoicesAfterAttend = await prisma.invoice.count({ where: { clinicId: tenant.clinic.id } });
    expect(invoicesAfterAttend).toBe(invoicesAfterPackage);
    const updatedPkg = await prisma.patientPackage.findFirst({
      where: { clinicId: tenant.clinic.id },
    });
    expect(updatedPkg?.usedSessions).toBe(1);
  });

  it('ABSENT does not consume a package session', async () => {
    if (!prisma) return;
    const tenant = await createTestTenant(prisma);
    const patient = await createTestPatient(prisma, tenant.clinic.id);
    await createOpCase(prisma, tenant.clinic.id, patient.id, tenant.therapist.id);
    const type = await therapy.createType({ clinicId: tenant.clinic.id, name: 'PT' }, tenant.adminUser.id);
    const pkg = await therapy.createPackage(
      {
        clinicId: tenant.clinic.id,
        therapyTypeId: type.id,
        name: 'PT pack',
        totalSessions: 2,
        frequency: 'WEEKLY',
        price: 1500,
      },
      tenant.adminUser.id,
    );
    const therapyCase = await therapy.createCase({
      clinicId: tenant.clinic.id,
      patientId: patient.id,
      therapistId: tenant.therapist.id,
      title: 'PT',
      createdBy: tenant.adminUser.id,
    });
    const assigned = await therapy.assignPackage(therapyCase.id, tenant.clinic.id, {
      packageId: pkg.id,
      startDate: futureStart(2),
      createdBy: tenant.adminUser.id,
    });
    await therapy.markAttendance(assigned.sessions[0].id, tenant.clinic.id, {
      status: 'ABSENT',
      createdBy: tenant.adminUser.id,
    });
    const updatedPkg = await prisma.patientPackage.findFirst({
      where: { clinicId: tenant.clinic.id },
    });
    expect(updatedPkg?.usedSessions).toBe(0);
  });

  it('session without a package is billed when PRESENT', async () => {
    if (!prisma) return;
    const tenant = await createTestTenant(prisma);
    const patient = await createTestPatient(prisma, tenant.clinic.id);
    await createOpCase(prisma, tenant.clinic.id, patient.id, tenant.therapist.id);
    const therapyCase = await therapy.createCase({
      clinicId: tenant.clinic.id,
      patientId: patient.id,
      therapistId: tenant.therapist.id,
      title: 'Ad-hoc',
      createdBy: tenant.adminUser.id,
    });
    const session = await prisma.therapySession.create({
      data: {
        clinicId: tenant.clinic.id,
        therapyCaseId: therapyCase.id,
        therapistId: tenant.therapist.id,
        scheduledAt: futureStart(1),
        status: 'SCHEDULED',
      },
    });
    const before = await prisma.invoice.count({ where: { clinicId: tenant.clinic.id } });
    await therapy.markAttendance(session.id, tenant.clinic.id, {
      status: 'PRESENT',
      unitPrice: 500,
      createdBy: tenant.adminUser.id,
    });
    const after = await prisma.invoice.findMany({
      where: { clinicId: tenant.clinic.id },
      include: { items: true },
    });
    expect(after.length).toBe(before + 1);
    expect(after[0].items[0].billableType).toBe('THERAPY_SESSION');
  });
});
