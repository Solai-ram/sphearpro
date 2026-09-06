import { createHmac } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { RazorpayService } from './razorpay.service';
import { RazorpayWebhookService } from './razorpay-webhook.service';
import { SAAS_ERROR } from './razorpay.errors';

function sign(body: string, secret: string) {
  return createHmac('sha256', secret).update(body).digest('hex');
}

describe('RazorpayWebhookService', () => {
  const prev = { ...process.env };
  let prisma: any;
  let razorpay: RazorpayService;
  let subscriptions: any;
  let queue: { add: ReturnType<typeof vi.fn> };
  let svc: RazorpayWebhookService;

  beforeEach(() => {
    process.env = { ...prev };
    process.env.RAZORPAY_KEY_ID = 'rzp_test_x';
    process.env.RAZORPAY_KEY_SECRET = 'key_secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';
    process.env.RAZORPAY_WEBHOOK_SYNC = 'true';

    prisma = {
      webhookEvent: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    razorpay = new RazorpayService();
    subscriptions = {
      applyProviderActivated: vi.fn(),
      applyProviderCharged: vi.fn(),
      applyProviderPaymentFailed: vi.fn(),
      applyProviderHalted: vi.fn(),
      applyProviderCancelled: vi.fn(),
    };
    queue = { add: vi.fn().mockResolvedValue({ id: 'job1' }) };
    svc = new RazorpayWebhookService(
      prisma as any,
      razorpay,
      subscriptions,
      queue as any,
    );
  });

  it('rejects invalid signature with 401', async () => {
    await expect(svc.ingest('{"event":"subscription.activated"}', 'bad-sig')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects missing signature', async () => {
    await expect(svc.ingest('{}', undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('skips already-processed duplicate event_id', async () => {
    const body = JSON.stringify({
      id: 'evt_dup_1',
      event: 'subscription.activated',
      payload: { subscription: { entity: { id: 'sub_1' } } },
    });
    const signature = sign(body, 'whsec_test');
    prisma.webhookEvent.findUnique.mockResolvedValue({
      id: 'wh_1',
      eventId: 'evt_dup_1',
      processed: true,
    });

    const result = await svc.ingest(body, signature);
    expect(result.duplicate).toBe(true);
    expect(result.processed).toBe(true);
    expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
    expect(subscriptions.applyProviderActivated).not.toHaveBeenCalled();
  });

  it('processes subscription.activated fixture and marks webhook processed', async () => {
    const body = JSON.stringify({
      id: 'evt_act_1',
      event: 'subscription.activated',
      payload: {
        subscription: { entity: { id: 'sub_rzp_1' } },
        payment: { entity: { id: 'pay_1', amount: 180000, currency: 'INR' } },
      },
    });
    const signature = sign(body, 'whsec_test');

    prisma.webhookEvent.findUnique
      .mockResolvedValueOnce(null) // ingest lookup
      .mockResolvedValueOnce({
        // processStoredEvent load
        id: 'wh_new',
        eventId: 'evt_act_1',
        eventType: 'subscription.activated',
        processed: false,
        payload: JSON.parse(body),
      });
    prisma.webhookEvent.create.mockResolvedValue({
      id: 'wh_new',
      eventId: 'evt_act_1',
      eventType: 'subscription.activated',
      processed: false,
    });
    prisma.webhookEvent.update.mockResolvedValue({});

    const result = await svc.ingest(body, signature);
    expect(result.processed).toBe(true);
    expect(subscriptions.applyProviderActivated).toHaveBeenCalledWith(
      'sub_rzp_1',
      expect.objectContaining({ providerPaymentId: 'pay_1', amountPaise: 180000 }),
    );
    expect(prisma.webhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'wh_new' },
        data: expect.objectContaining({ processed: true }),
      }),
    );
  });

  it('does not double-apply when processStoredEvent called twice', async () => {
    prisma.webhookEvent.findUnique.mockResolvedValue({
      id: 'wh_1',
      processed: true,
      eventType: 'subscription.charged',
      payload: {},
    });
    await svc.processStoredEvent('wh_1');
    expect(subscriptions.applyProviderCharged).not.toHaveBeenCalled();
  });

  it('maps payment.failed to applyProviderPaymentFailed', async () => {
    await svc.applyPayload('payment.failed', {
      event: 'payment.failed',
      payload: {
        subscription: { entity: { id: 'sub_x' } },
        payment: {
          entity: {
            id: 'pay_f',
            amount: 180000,
            error_description: 'insufficient funds',
          },
        },
      },
    });
    expect(subscriptions.applyProviderPaymentFailed).toHaveBeenCalledWith(
      'sub_x',
      expect.objectContaining({ failureReason: 'insufficient funds' }),
    );
  });

  it('maps halted / cancelled / charged', async () => {
    await svc.applyPayload('subscription.halted', {
      payload: { subscription: { entity: { id: 'sub_h' } } },
    });
    expect(subscriptions.applyProviderHalted).toHaveBeenCalledWith(
      'sub_h',
      expect.any(Object),
    );

    await svc.applyPayload('subscription.cancelled', {
      payload: { subscription: { entity: { id: 'sub_c' } } },
    });
    expect(subscriptions.applyProviderCancelled).toHaveBeenCalledWith(
      'sub_c',
      expect.objectContaining({ completed: false }),
    );

    await svc.applyPayload('subscription.charged', {
      payload: {
        subscription: { entity: { id: 'sub_ch' } },
        payment: { entity: { id: 'pay_2', amount: 180000 } },
      },
    });
    expect(subscriptions.applyProviderCharged).toHaveBeenCalled();
  });

  it('stores error_message on processing failure and rethrows for retry', async () => {
    prisma.webhookEvent.findUnique.mockResolvedValue({
      id: 'wh_err',
      eventId: 'evt_err',
      eventType: 'subscription.activated',
      processed: false,
      payload: { payload: { subscription: { entity: { id: 'missing' } } } },
    });
    subscriptions.applyProviderActivated.mockRejectedValue(new Error('No local subscription'));
    prisma.webhookEvent.update.mockResolvedValue({});

    await expect(svc.processStoredEvent('wh_err')).rejects.toThrow('No local subscription');
    expect(prisma.webhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ errorMessage: 'No local subscription' }),
      }),
    );
  });

  it('exposes INVALID_WEBHOOK_SIGNATURE code on bad sig response', async () => {
    try {
      await svc.ingest('{"event":"x"}', 'nope');
      expect.unreachable();
    } catch (e: any) {
      const body = e.getResponse?.() || e.response;
      expect(body.error?.code || body.message?.error?.code).toBe(
        SAAS_ERROR.INVALID_WEBHOOK_SIGNATURE,
      );
    }
  });
});
