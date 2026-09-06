import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { RazorpayWebhookService } from './razorpay-webhook.service';

@ApiTags('Webhooks')
@Controller({ path: 'webhooks', version: '1' })
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private webhooks: RazorpayWebhookService) {}

  @Post('razorpay')
  @SkipThrottle()
  @HttpCode(200)
  @ApiOperation({ summary: 'Razorpay subscription/payment webhooks (signature required)' })
  async razorpay(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Headers('x-razorpay-event-id') eventId: string | undefined,
  ) {
    const raw = req.rawBody;
    if (!raw || (Buffer.isBuffer(raw) && raw.length === 0)) {
      this.logger.warn('Razorpay webhook missing raw body — enable Nest rawBody');
      throw new BadRequestException('Raw body required for signature verification');
    }

    return this.webhooks.ingest(raw, signature, eventId);
  }
}
