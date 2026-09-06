import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  BadRequestException,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Response, Request } from 'express';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAdmin } from '../../common/decorators/platform-admin.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SubscriptionJobsService, SUB_JOB } from './subscription-jobs.service';
import { AuthService } from '../auth/auth.service';

@ApiTags('Platform Admin')
@Controller('admin')
export class PlatformAdminController {
  constructor(
    private platform: PlatformAdminService,
    private jobs: SubscriptionJobsService,
    private auth: AuthService,
  ) {}

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api',
    });
  }

  @Get('subscriptions/kpis')
  @PlatformAdmin()
  @ApiOperation({ summary: 'Platform subscription KPIs (MRR, status counts)' })
  kpis() {
    return this.platform.dashboardKpis();
  }

  @Get('infrastructure')
  @PlatformAdmin()
  @ApiOperation({ summary: 'VPS / host disk, memory, and runtime metrics' })
  infrastructure() {
    return this.platform.getInfrastructure();
  }

  @Get('subscriptions')
  @PlatformAdmin()
  @ApiOperation({ summary: 'List all clinic subscriptions' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  list(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.platform.listSubscriptions({
      status,
      search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 25,
    });
  }

  @Get('subscriptions/:id')
  @PlatformAdmin()
  @ApiOperation({ summary: 'Get subscription detail' })
  get(@Param('id') id: string) {
    return this.platform.getSubscription(id);
  }

  @Post('subscriptions/:id/suspend')
  @PlatformAdmin()
  @ApiOperation({ summary: 'Suspend clinic subscription' })
  suspend(
    @Param('id') id: string,
    @CurrentUser() user: { sub?: string },
    @Body() body: { reason?: string },
  ) {
    return this.platform.suspend(id, user.sub!, body?.reason);
  }

  @Post('subscriptions/:id/reactivate')
  @PlatformAdmin()
  @ApiOperation({ summary: 'Reactivate clinic subscription' })
  reactivate(
    @Param('id') id: string,
    @CurrentUser() user: { sub?: string },
    @Body() body: { reason?: string },
  ) {
    return this.platform.reactivate(id, user.sub!, body?.reason);
  }

  @Post('subscriptions/:id/extend')
  @PlatformAdmin()
  @ApiOperation({ summary: 'Extend subscription period (reason required)' })
  extend(
    @Param('id') id: string,
    @CurrentUser() user: { sub?: string },
    @Body() body: { days: number; reason: string },
  ) {
    if (!body?.reason) throw new BadRequestException('reason is required');
    return this.platform.extend(id, user.sub!, body);
  }

  @Post('subscriptions/:id/offline-payment')
  @PlatformAdmin()
  @ApiOperation({ summary: 'Record offline payment and activate/renew' })
  offlinePayment(
    @Param('id') id: string,
    @CurrentUser() user: { sub?: string },
    @Body() body: { amountPaise?: number; note?: string; reference?: string },
  ) {
    return this.platform.captureOfflinePayment(id, user.sub!, body || {});
  }

  @Get('payments')
  @PlatformAdmin()
  @ApiOperation({ summary: 'List all SaaS payments' })
  payments(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.platform.listPayments({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Get('invoices')
  @PlatformAdmin()
  @ApiOperation({ summary: 'List all SaaS invoices' })
  invoices(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.platform.listInvoices({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Get('webhooks')
  @PlatformAdmin()
  @ApiOperation({ summary: 'List Razorpay webhook events' })
  @ApiQuery({ name: 'processed', required: false })
  webhooks(
    @Query('processed') processed?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.platform.listWebhooks({
      processed:
        processed === 'true' ? true : processed === 'false' ? false : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Post('jobs/:name/run')
  @PlatformAdmin()
  @ApiOperation({
    summary: 'Manually run a subscription scheduled job (expiry, reminders, reconcile, …)',
  })
  runJob(@Param('name') name: string) {
    const allowed = Object.values(SUB_JOB) as string[];
    if (!allowed.includes(name)) {
      throw new BadRequestException(`Unknown job. Allowed: ${allowed.join(', ')}`);
    }
    return this.jobs.runJob(name);
  }

  @Get('clinics/:clinicId/support-login')
  @PlatformAdmin()
  @ApiOperation({ summary: 'Get or create clinic support admin credentials' })
  supportCredentials(@Param('clinicId') clinicId: string) {
    return this.auth.ensureClinicSupportAdmin(clinicId);
  }

  @Post('clinics/:clinicId/support-login')
  @PlatformAdmin()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Issue a clinic HIS session as the support ADMIN (for platform support)',
  })
  async supportLogin(
    @Param('clinicId') clinicId: string,
    @CurrentUser() user: { sub?: string; id?: string },
    @Req() req: Request,
  ) {
    const result = await this.auth.loginAsClinicSupport(
      clinicId,
      user.sub || user.id!,
      req.ip,
      req.get('user-agent'),
    );
    const res = (req as Request & { res?: Response }).res;
    if (res) this.setRefreshCookie(res, result.refreshToken);
    return {
      accessToken: result.accessToken,
      clinic: result.clinic,
      user: result.user,
      supportLogin: result.supportLogin,
    };
  }

  @Post('clinics/:clinicId/support-login/rotate')
  @PlatformAdmin()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate clinic support admin password' })
  rotateSupportPassword(@Param('clinicId') clinicId: string) {
    return this.auth.ensureClinicSupportAdmin(clinicId, { rotatePassword: true });
  }
}
