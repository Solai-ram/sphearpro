import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MailService } from '../mail/mail.module';
import { __test } from './subscription-jobs.service';
import { SubscriptionMailService } from './subscription-mail.service';

describe('MailService production SMTP guard', () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env = { ...prev };
  });

  it('allows Mailpit in non-production', () => {
    process.env.NODE_ENV = 'development';
    process.env.MAIL_HOST = 'mailpit';
    const mail = new MailService();
    expect(() => mail.assertProductionSmtp()).not.toThrow();
  });

  it('forbids Mailpit/localhost in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.MAIL_HOST = 'mailpit';
    const mail = new MailService();
    expect(() => mail.assertProductionSmtp()).toThrow(/Mailpit/);

    process.env.MAIL_HOST = 'localhost';
    expect(() => mail.assertProductionSmtp()).toThrow(/Mailpit/);
  });

  it('allows real SMTP host in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.MAIL_HOST = 'email-smtp.ap-south-1.amazonaws.com';
    const mail = new MailService();
    expect(() => mail.assertProductionSmtp()).not.toThrow();
  });
});

describe('mapRazorpayStatus', () => {
  it('maps provider statuses for reconciliation', () => {
    expect(__test.mapRazorpayStatus('active')).toBe('ACTIVE');
    expect(__test.mapRazorpayStatus('cancelled')).toBe('CANCELLED');
    expect(__test.mapRazorpayStatus('completed')).toBe('EXPIRED');
    expect(__test.mapRazorpayStatus('halted')).toBe('SUSPENDED');
    expect(__test.mapRazorpayStatus('pending')).toBeNull();
  });
});

describe('SubscriptionMailService templates', () => {
  it('sends payment_failed through mailer', async () => {
    const send = vi.fn().mockResolvedValue({ skipped: false, messageId: '1' });
    const mail = { send } as any;
    const svc = new SubscriptionMailService(mail);
    await svc.paymentFailed({
      to: 'clinic@example.com',
      clinicName: 'Sunrise',
      planName: 'Standard',
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'clinic@example.com',
        subject: expect.stringContaining('payment failed'),
      }),
    );
  });

  it('skips when recipient missing', async () => {
    const send = vi.fn();
    const svc = new SubscriptionMailService({ send } as any);
    await svc.expired({ to: '', clinicName: 'X', planName: 'Y' });
    expect(send).not.toHaveBeenCalled();
  });
});
