import { createHmac } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RazorpayService } from './razorpay.service';
import { SAAS_ERROR } from './razorpay.errors';

describe('RazorpayService', () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env = { ...prev };
    process.env.RAZORPAY_KEY_ID = 'rzp_test_abc123';
    process.env.RAZORPAY_KEY_SECRET = 'test_secret_key';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';
    process.env.RAZORPAY_MONTHLY_PLAN_ID = 'plan_test_standard';
    process.env.RAZORPAY_YEARLY_PLAN_ID = 'plan_test_yearly';
    process.env.RAZORPAY_PLAN_ID = 'plan_test_standard';
    process.env.RAZORPAY_TRIAL_DAYS = '7';
  });

  it('reports test mode from key id prefix', () => {
    const svc = new RazorpayService();
    expect(svc.getMode()).toBe('test');
    process.env.RAZORPAY_KEY_ID = 'rzp_live_xyz';
    expect(svc.getMode()).toBe('live');
  });

  it('exposes public key id only when configured', () => {
    const svc = new RazorpayService();
    expect(svc.getPublicKeyId()).toBe('rzp_test_abc123');
    delete process.env.RAZORPAY_KEY_SECRET;
    expect(() => svc.getPublicKeyId()).toThrow();
  });

  it('creates customer and subscription via client', async () => {
    const svc = new RazorpayService();
    const createCustomer = vi.fn().mockResolvedValue({ id: 'cust_1' });
    const createSub = vi.fn().mockResolvedValue({ id: 'sub_1', status: 'created' });
    svc.setClientForTests({
      customers: { create: createCustomer },
      orders: { create: vi.fn() },
      subscriptions: {
        create: createSub,
        fetch: vi.fn(),
        cancel: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
      },
    });

    const customer = await svc.createCustomer({
      name: 'Clinic A',
      email: 'a@example.com',
      notes: { clinicId: 'cl1' },
    });
    expect(customer.id).toBe('cust_1');
    expect(createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Clinic A', email: 'a@example.com' }),
    );

    const sub = await svc.createSubscription({
      planId: 'plan_test_standard',
      totalCount: 120,
      customerId: 'cust_1',
      startAt: 1_800_000_000,
      notes: { clinicId: 'cl1' },
    });
    expect(sub.id).toBe('sub_1');
    expect(createSub).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: 'plan_test_standard',
        total_count: 120,
        customer_id: 'cust_1',
        start_at: 1_800_000_000,
      }),
    );
  });

  it('resolves MONTHLY / YEARLY plan ids and trial start_at', () => {
    const svc = new RazorpayService();
    expect(svc.getProviderPlanId('MONTHLY')).toBe('plan_test_standard');
    expect(svc.getProviderPlanId('YEARLY')).toBe('plan_test_yearly');
    expect(svc.getCheckoutTrialDays()).toBe(7);
    const startAt = svc.getTrialStartAtUnix(7);
    const expected = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    expect(Math.abs(startAt - expected)).toBeLessThanOrEqual(2);
  });

  it('verifies order payment signature', () => {
    const svc = new RazorpayService();
    const orderId = 'order_1';
    const paymentId = 'pay_1';
    const signature = createHmac('sha256', 'test_secret_key')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    expect(svc.verifyPayment(orderId, paymentId, signature)).toBe(true);
    expect(svc.verifyPayment(orderId, paymentId, 'deadbeef')).toBe(false);
  });

  it('verifies subscription payment signature', () => {
    const svc = new RazorpayService();
    const paymentId = 'pay_1';
    const subscriptionId = 'sub_1';
    const signature = createHmac('sha256', 'test_secret_key')
      .update(`${paymentId}|${subscriptionId}`)
      .digest('hex');
    expect(svc.verifySubscriptionPayment(paymentId, subscriptionId, signature)).toBe(true);
    expect(svc.verifySubscriptionPayment(paymentId, subscriptionId, 'nope')).toBe(false);
  });

  it('verifies webhook signature from raw body', () => {
    const svc = new RazorpayService();
    const raw = '{"event":"subscription.activated"}';
    const signature = createHmac('sha256', 'whsec_test').update(raw).digest('hex');
    expect(svc.verifyWebhook(raw, signature)).toBe(true);
    expect(svc.verifyWebhook(raw, 'bad')).toBe(false);
  });

  it('throws typed error when plan id missing', () => {
    delete process.env.RAZORPAY_PLAN_ID;
    delete process.env.RAZORPAY_MONTHLY_PLAN_ID;
    delete process.env.RAZORPAY_YEARLY_PLAN_ID;
    delete process.env.RAZORPAY_PLAN_ID_YEARLY;
    const svc = new RazorpayService();
    try {
      svc.getProviderPlanId();
      expect.unreachable();
    } catch (e: any) {
      expect(e.getResponse().error.code).toBe(SAAS_ERROR.RAZORPAY_PLAN_MISSING);
    }
  });

  it('cancel / pause / resume call client', async () => {
    const svc = new RazorpayService();
    const cancel = vi.fn().mockResolvedValue({ id: 'sub_1', status: 'cancelled' });
    const pause = vi.fn().mockResolvedValue({ id: 'sub_1', status: 'paused' });
    const resume = vi.fn().mockResolvedValue({ id: 'sub_1', status: 'active' });
    const fetch = vi.fn().mockResolvedValue({ id: 'sub_1', status: 'active' });
    svc.setClientForTests({
      customers: { create: vi.fn() },
      orders: { create: vi.fn() },
      subscriptions: { create: vi.fn(), fetch, cancel, pause, resume },
    });

    await svc.cancelSubscription('sub_1', true);
    expect(cancel).toHaveBeenCalledWith('sub_1', true);
    await svc.pauseSubscription('sub_1');
    expect(pause).toHaveBeenCalledWith('sub_1', 'now');
    await svc.resumeSubscription('sub_1');
    expect(resume).toHaveBeenCalledWith('sub_1', 'now');
    await svc.fetchSubscription('sub_1');
    expect(fetch).toHaveBeenCalledWith('sub_1');
  });

  it('creates standard checkout orders and rejects amounts under 100 paise', async () => {
    const svc = new RazorpayService();
    const create = vi.fn().mockResolvedValue({
      id: 'order_1',
      amount: 180000,
      currency: 'INR',
    });
    svc.setClientForTests({
      customers: { create: vi.fn() },
      orders: { create },
      subscriptions: {
        create: vi.fn(),
        fetch: vi.fn(),
        cancel: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
      },
    });

    const order = await svc.createOrder({ amount: 180000, currency: 'INR', receipt: 'rcpt_1' });
    expect(order.id).toBe('order_1');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 180000, currency: 'INR', receipt: 'rcpt_1' }),
    );

    await expect(svc.createOrder({ amount: 50 })).rejects.toMatchObject({
      response: expect.objectContaining({
        error: expect.objectContaining({ code: SAAS_ERROR.PAYMENT_REQUIRED }),
      }),
    });
  });
});
