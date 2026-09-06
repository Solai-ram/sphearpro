import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TherapyService } from '../therapy/therapy.service';
import { BillingService } from '../billing/billing.service';
import { AuditService } from '../audit/audit.service';
import { PatientsService } from '../patients/patients.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { disconnectTestPrisma, getTestPrisma, truncateAll, describeDb } from '../../test/prisma-test';
import {
  createOpCase,
  createTestTenant,
  ensureStandardPlan,
  futureStart,
} from '../../test/tenant-factory';

describeDb('Clinical + billing workflow (database)', () => {
  let prisma: PrismaClient | null;

  beforeAll(async () => {
    prisma = await getTestPrisma();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  beforeEach(async () => {
    if (!prisma) return;
    await truncateAll(prisma);
  });

  it('patient → OP → therapy package → attendance → package invoice → payment, with audit trail', async () => {
    if (!prisma) return;
    const tenant = await createTestTenant(prisma);
    await ensureStandardPlan(prisma);

    const audit = new AuditService(prisma);
    const comm = {
      queueInvoiceNotification: vi.fn().mockResolvedValue(undefined),
      queuePaymentReceipt: vi.fn().mockResolvedValue(undefined),
      queueTherapySessions: vi.fn().mockResolvedValue(undefined),
    };
    const billing = new BillingService(prisma, audit, comm as any);
    const patients = new PatientsService(prisma, audit);
    const therapy = new TherapyService(prisma, audit, billing, {} as any, comm as any);
    const subscriptions = new SubscriptionService(prisma, {} as any, {
      subscriptionCreated: vi.fn(),
    } as any);

    await subscriptions.createSubscription(tenant.clinic.id, 'STANDARD', tenant.adminUser.id);
    const access = await subscriptions.checkAccess(tenant.clinic.id);
    expect(access.allowed).toBe(true);

    const patient = await patients.create({
      clinicId: tenant.clinic.id,
      name: 'Workflow Patient',
      createdBy: tenant.adminUser.id,
    });
    await createOpCase(prisma, tenant.clinic.id, patient.id, tenant.therapist.id);

    const type = await therapy.createType(
      { clinicId: tenant.clinic.id, name: 'Speech' },
      tenant.adminUser.id,
    );
    const catalog = await therapy.createPackage(
      {
        clinicId: tenant.clinic.id,
        therapyTypeId: type.id,
        name: 'Starter pack',
        totalSessions: 3,
        frequency: 'WEEKLY',
        price: 3000,
      },
      tenant.adminUser.id,
    );
    const therapyCase = await therapy.createCase({
      clinicId: tenant.clinic.id,
      patientId: patient.id,
      therapistId: tenant.therapist.id,
      title: 'Speech case',
      createdBy: tenant.adminUser.id,
    });
    const assigned = await therapy.assignPackage(therapyCase.id, tenant.clinic.id, {
      packageId: catalog.id,
      startDate: futureStart(5),
      createdBy: tenant.adminUser.id,
    });
    expect(assigned.sessionsGenerated).toBe(3);

    await therapy.markAttendance(assigned.sessions[0].id, tenant.clinic.id, {
      status: 'PRESENT',
      createdBy: tenant.adminUser.id,
    });

    const invoices = await prisma.invoice.findMany({
      where: { clinicId: tenant.clinic.id },
      include: { items: true },
    });
    expect(invoices).toHaveLength(1);
    expect(invoices[0].items[0].billableType).toBe('THERAPY_PACKAGE');
    expect(Number(invoices[0].grandTotal)).toBe(3000);

    await billing.recordPayment({
      invoiceId: invoices[0].id,
      clinicId: tenant.clinic.id,
      amount: 3000,
      method: 'UPI',
      createdBy: tenant.adminUser.id,
    });

    const paid = await billing.findInvoiceById(invoices[0].id, tenant.clinic.id);
    expect(paid.status).toBe('PAID');

    const actions = (await prisma.auditLog.findMany()).map((l) => l.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'PATIENT_CREATED',
        'THERAPY_CASE_CREATED',
        'THERAPY_PACKAGE_ASSIGNED',
        'INVOICE_CREATED',
        'THERAPY_ATTENDANCE_MARKED',
        'PAYMENT_RECORDED',
      ]),
    );
  });
});
