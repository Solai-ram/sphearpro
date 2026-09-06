import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { createHttpApp, http } from '../../test/http-app';

describe('BillingController (HTTP)', () => {
  let app: INestApplication;
  const billingService = {
    createInvoice: vi.fn().mockImplementation(async (data: any) => ({
      id: 'inv_1',
      clinicId: data.clinicId,
      patientId: data.patientId,
      status: 'PENDING',
      grandTotal: 500,
    })),
  };

  beforeAll(async () => {
    app = await createHttpApp({
      controllers: [BillingController],
      providers: [{ provide: BillingService, useValue: billingService }],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /billing/invoices binds clinicId from the session', async () => {
    const res = await http(app)
      .post('/billing/invoices')
      .send({
        patientId: 'pat_1',
        items: [{ billableType: 'OP_VISIT', description: 'Consult', unitPrice: 500 }],
      });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(billingService.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'pat_1',
        clinicId: 'clinic_a',
      }),
    );
  });
});
