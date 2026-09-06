import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { Authenticated } from '../../common/decorators/auth.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { requireClinicId } from '../../common/tenant/clinic-context';
import { SkipSubscription } from '../../common/decorators/subscription.decorator';

type Authed = { sub?: string; clinicId?: string; roles?: string[] };

@ApiTags('Subscription')
@Controller('subscription')
@SkipSubscription()
export class SubscriptionController {
  constructor(private subscriptionService: SubscriptionService) {}

  @Get('plans')
  @ApiOperation({ summary: 'List active SaaS subscription plans (public)' })
  async listPlans() {
    return this.subscriptionService.listPlans();
  }

  @Get('plans/:code')
  @ApiOperation({ summary: 'Get one plan by code (public)' })
  async getPlan(@Param('code') code: string) {
    const plan = await this.subscriptionService.getPlanByCode(code.toUpperCase());
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  @Get()
  @ApiBearerAuth()
  @Authenticated()
  @ApiOperation({ summary: 'Current clinic subscription' })
  async getCurrent(@CurrentUser() user: Authed) {
    const clinicId = requireClinicId(user);
    const sub = await this.subscriptionService.getSubscription(clinicId);
    const access = await this.subscriptionService.checkAccess(clinicId);
    const seats = await this.subscriptionService.getClinicSeatUsage(clinicId);
    return { subscription: sub, access, seats };
  }

  @Get('access')
  @ApiBearerAuth()
  @Authenticated()
  @ApiOperation({ summary: 'Check whether clinic may use HIS features' })
  async checkAccess(@CurrentUser() user: Authed) {
    return this.subscriptionService.checkAccess(requireClinicId(user));
  }

  @Post('create')
  @ApiBearerAuth()
  @Authenticated()
  @ApiOperation({ summary: 'Create subscription for clinic (admin)' })
  async create(
    @CurrentUser() user: Authed,
    @Body() body: { planCode?: string },
  ) {
    this.subscriptionService.assertClinicBillingAdmin(user.roles);
    const planCode = body.planCode || process.env.SAAS_DEFAULT_PLAN_CODE || 'STANDARD';
    return this.subscriptionService.createSubscription(
      requireClinicId(user),
      planCode,
      user.sub,
    );
  }

  @Post('checkout')
  @ApiBearerAuth()
  @Authenticated()
  @ApiOperation({
    summary: 'Start Razorpay Checkout (creates provider subscription; does not activate)',
  })
  async checkout(
    @CurrentUser() user: Authed,
    @Body() body: { planCode?: string },
  ) {
    this.subscriptionService.assertClinicBillingAdmin(user.roles);
    return this.subscriptionService.startCheckout(requireClinicId(user), {
      planCode: body.planCode,
      actorId: user.sub,
    });
  }

  @Post('checkout/confirm')
  @ApiBearerAuth()
  @Authenticated()
  @ApiOperation({
    summary:
      'Verify Razorpay Checkout signature (order or subscription) and record payment',
  })
  async confirmCheckout(
    @CurrentUser() user: Authed,
    @Body()
    body: {
      razorpay_payment_id: string;
      razorpay_signature: string;
      razorpay_order_id?: string;
      razorpay_subscription_id?: string;
    },
  ) {
    this.subscriptionService.assertClinicBillingAdmin(user.roles);
    if (!body?.razorpay_payment_id || !body?.razorpay_signature) {
      throw new BadRequestException('razorpay_payment_id and razorpay_signature are required');
    }
    if (!body.razorpay_order_id && !body.razorpay_subscription_id) {
      throw new BadRequestException(
        'razorpay_order_id or razorpay_subscription_id is required',
      );
    }
    return this.subscriptionService.confirmCheckout(requireClinicId(user), body, {
      actorId: user.sub,
    });
  }

  @Post('activate')
  @ApiBearerAuth()
  @Authenticated()
  @ApiOperation({ summary: 'Manually activate subscription (dev/staging only)' })
  async activate(@CurrentUser() user: Authed) {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.ALLOW_MANUAL_SUBSCRIPTION_ACTIVATE !== 'true'
    ) {
      throw new ForbiddenException(
        'Manual activation is disabled in production. Subscriptions activate via Razorpay webhooks.',
      );
    }
    this.subscriptionService.assertClinicBillingAdmin(user.roles);
    return this.subscriptionService.activateSubscription(requireClinicId(user), {
      actorId: user.sub,
    });
  }

  @Post('change-plan')
  @ApiBearerAuth()
  @Authenticated()
  @ApiOperation({ summary: 'Change subscription plan (admin)' })
  async changePlan(
    @CurrentUser() user: Authed,
    @Body() body: { planCode: string },
  ) {
    this.subscriptionService.assertClinicBillingAdmin(user.roles);
    if (!body.planCode) throw new NotFoundException('planCode required');
    return this.subscriptionService.changePlan(requireClinicId(user), body.planCode, {
      actorId: user.sub,
    });
  }

  @Post('cancel')
  @ApiBearerAuth()
  @Authenticated()
  @ApiOperation({ summary: 'Cancel subscription (default: at period end)' })
  async cancel(
    @CurrentUser() user: Authed,
    @Body() body: { atPeriodEnd?: boolean; immediate?: boolean },
  ) {
    this.subscriptionService.assertClinicBillingAdmin(user.roles);
    return this.subscriptionService.cancelSubscription(requireClinicId(user), {
      atPeriodEnd: body.atPeriodEnd,
      immediate: body.immediate,
      actorId: user.sub,
    });
  }

  @Post('reactivate')
  @ApiBearerAuth()
  @Authenticated()
  @ApiOperation({ summary: 'Reactivate cancelled or expired subscription' })
  async reactivate(@CurrentUser() user: Authed) {
    this.subscriptionService.assertClinicBillingAdmin(user.roles);
    return this.subscriptionService.reactivateSubscription(requireClinicId(user), {
      actorId: user.sub,
    });
  }

  @Post('renew')
  @ApiBearerAuth()
  @Authenticated()
  @ApiOperation({ summary: 'Renew / extend current period (manual until Razorpay)' })
  async renew(@CurrentUser() user: Authed) {
    this.subscriptionService.assertClinicBillingAdmin(user.roles);
    return this.subscriptionService.renewSubscription(requireClinicId(user), {
      actorId: user.sub,
    });
  }

  @Get('payments')
  @ApiBearerAuth()
  @Authenticated()
  @ApiOperation({ summary: 'List SaaS subscription payments' })
  async payments(@CurrentUser() user: Authed) {
    this.subscriptionService.assertClinicBillingAdmin(user.roles);
    return this.subscriptionService.listPayments(requireClinicId(user));
  }

  @Get('invoices')
  @ApiBearerAuth()
  @Authenticated()
  @ApiOperation({ summary: 'List SaaS subscription invoices' })
  async invoices(@CurrentUser() user: Authed) {
    this.subscriptionService.assertClinicBillingAdmin(user.roles);
    return this.subscriptionService.listInvoices(requireClinicId(user));
  }

  @Get('invoices/:id')
  @ApiBearerAuth()
  @Authenticated()
  @ApiOperation({ summary: 'Get one SaaS subscription invoice' })
  async invoice(@CurrentUser() user: Authed, @Param('id') id: string) {
    this.subscriptionService.assertClinicBillingAdmin(user.roles);
    return this.subscriptionService.getInvoice(requireClinicId(user), id);
  }
}
