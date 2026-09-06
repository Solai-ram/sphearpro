import { Global, Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private ready = false;

  onModuleInit() {
    this.assertProductionSmtp();
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST || 'localhost',
      port: Number(process.env.MAIL_PORT || 1025),
      secure: process.env.MAIL_SECURE === 'true',
      auth:
        process.env.MAIL_USER && process.env.MAIL_PASS
          ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
          : undefined,
    });
    this.ready = true;
    this.logger.log(
      `SMTP ready host=${process.env.MAIL_HOST || 'localhost'}:${process.env.MAIL_PORT || 1025}`,
    );
  }

  /** Production must not use Mailpit / localhost SMTP. */
  assertProductionSmtp() {
    if (process.env.NODE_ENV !== 'production') return;
    const host = (process.env.MAIL_HOST || '').toLowerCase();
    if (!host) {
      throw new Error('MAIL_HOST is required when NODE_ENV=production');
    }
    if (
      host.includes('mailpit') ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1'
    ) {
      throw new Error(
        'Mailpit/localhost SMTP is forbidden in production. Configure a real MAIL_HOST.',
      );
    }
  }

  isConfigured() {
    return this.ready && Boolean(this.transporter);
  }

  async send(input: SendMailInput) {
    if (!this.transporter) {
      this.logger.warn(`Mail skipped (no transporter): ${input.subject} → ${input.to}`);
      return { skipped: true as const };
    }
    const from = process.env.MAIL_FROM || 'noreply@hislite.local';
    try {
      const info = await this.transporter.sendMail({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html || undefined,
      });
      this.logger.log(`Mail sent to=${input.to} subject="${input.subject}" id=${info.messageId}`);
      return { skipped: false as const, messageId: info.messageId };
    } catch (err) {
      this.logger.error(
        `Mail failed to=${input.to} subject="${input.subject}": ${
          err instanceof Error ? err.message : err
        }`,
      );
      throw err;
    }
  }
}

@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
