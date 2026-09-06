import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { AuditService } from '../audit/audit.service';
import { PatientsService } from '../patients/patients.service';
import { disconnectTestPrisma, getTestPrisma, truncateAll, describeDb } from '../../test/prisma-test';
import { createTestPatient, createTestTenant } from '../../test/tenant-factory';

describeDb('BillingService (database)', () => {
  let prisma: PrismaClient | null;
  let billing: BillingService;
  let patients: PatientsService;

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
    const comm = {
      queueInvoiceNotification: vi.fn().mockResolvedValue(undefined),
      queuePaymentReceipt: vi.fn().mockResolvedValue(undefined),
    };
    billing = new BillingService(prisma, audit, comm as any);
    patients = new PatientsService(prisma, audit);
  });

  it('creates an invoice with line totals and PENDING status', async () => {
    if (!prisma) return;
    const tenant = await createTestTenant(prisma);
    const patient = await createTestPatient(prisma, tenant.clinic.id);
    const invoice = await billing.createInvoice({
      clinicId: tenant.clinic.id,
      patientId: patient.id,
      createdBy: tenant.adminUser.id,
      notes: 'OP consult',
      items: [
        {
          billableType: 'OP_VISIT',
          description: 'Consultation',
          quantity: 1,
          unitPrice: 500,
          tax: 0,
        },
      ],
    });
    expect(invoice.status).toBe('PENDING');
    expect(Number(invoice.grandTotal)).toBe(500);
    expect(invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
    expect(invoice.outstanding).toBe(500);
  });

  it('records a partial payment then a remaining payment to PAID', async () => {
    if (!prisma) return;
    const tenant = await createTestTenant(prisma);
    const patient = await patients.create({
      clinicId: tenant.clinic.id,
      name: 'Pay Patient',
      createdBy: tenant.adminUser.id,
    });
    const invoice = await billing.createInvoice({
      clinicId: tenant.clinic.id,
      patientId: patient.id,
      createdBy: tenant.adminUser.id,
      items: [{ billableType: 'OTHER', description: 'Session', unitPrice: 1000, quantity: 1 }],
    });
    const p1 = await billing.recordPayment({
      invoiceId: invoice.id,
      clinicId: tenant.clinic.id,
      amount: 400,
      method: 'CASH',
      createdBy: tenant.adminUser.id,
    });
    expect(p1).toBeTruthy();
    const afterPartial = await billing.findInvoiceById(invoice.id, tenant.clinic.id);
    expect(afterPartial.status).toBe('PARTIALLY_PAID');
    expect(afterPartial.outstanding).toBe(600);

    await billing.recordPayment({
      invoiceId: invoice.id,
      clinicId: tenant.clinic.id,
      amount: 600,
      method: 'UPI',
      createdBy: tenant.adminUser.id,
    });
    const afterPaid = await billing.findInvoiceById(invoice.id, tenant.clinic.id);
    expect(afterPaid.status).toBe('PAID');
    expect(afterPaid.outstanding).toBe(0);
  });

  it('rejects overpayment', async () => {
    if (!prisma) return;
    const tenant = await createTestTenant(prisma);
    const patient = await createTestPatient(prisma, tenant.clinic.id);
    const invoice = await billing.createInvoice({
      clinicId: tenant.clinic.id,
      patientId: patient.id,
      items: [{ billableType: 'OTHER', description: 'Fee', unitPrice: 100, quantity: 1 }],
    });
    await expect(
      billing.recordPayment({
        invoiceId: invoice.id,
        clinicId: tenant.clinic.id,
        amount: 150,
        method: 'CASH',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
