import { Global, Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { RazorpayService } from './razorpay.service';
import { RazorpayWebhookService, SUBSCRIPTION_QUEUE } from './razorpay-webhook.service';
import { RazorpayWebhookProcessor } from './razorpay-webhook.processor';
import { WebhooksController } from './webhooks.controller';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAdminController } from './platform-admin.controller';
import { RazorpayPaymentsController } from './razorpay-payments.controller';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { FeatureGuard } from '../../common/guards/feature.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionMailService } from './subscription-mail.service';
import {
  SubscriptionJobsService,
  SUBSCRIPTION_JOBS_QUEUE,
} from './subscription-jobs.service';
import { SubscriptionJobsProcessor } from './subscription-jobs.processor';

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      { name: SUBSCRIPTION_QUEUE },
      { name: SUBSCRIPTION_JOBS_QUEUE },
    ),
    AuditModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [
    SubscriptionController,
    WebhooksController,
    PlatformAdminController,
    RazorpayPaymentsController,
  ],
  providers: [
    SubscriptionService,
    RazorpayService,
    RazorpayWebhookService,
    RazorpayWebhookProcessor,
    PlatformAdminService,
    SubscriptionMailService,
    SubscriptionJobsService,
    SubscriptionJobsProcessor,
    SubscriptionGuard,
    FeatureGuard,
    SuperAdminGuard,
  ],
  exports: [
    SubscriptionService,
    RazorpayService,
    RazorpayWebhookService,
    PlatformAdminService,
    SubscriptionMailService,
    SubscriptionJobsService,
    SubscriptionGuard,
    FeatureGuard,
    SuperAdminGuard,
  ],
})
export class SubscriptionModule {}
