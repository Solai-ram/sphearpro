import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { PrismaClient, SubscriptionStatus, Prisma } from '@prisma/client';
import { statfs } from 'fs/promises';
import * as os from 'os';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import {
  SUBSCRIPTION_EVENT,
  addDays,
  addMonths,
  assertTransition,
} from './subscription-state';

@Injectable()
export class PlatformAdminService {
  private readonly logger = new Logger(PlatformAdminService.name);

  constructor(
    @Inject('PRISMA_CLIENT') private prisma: PrismaClient,
    private audit: AuditService,
    @Inject(forwardRef(() => AuthService)) private auth: AuthService,
  ) {}

  async listSubscriptions(params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(100, Math.max(1, params?.limit || 25));
    const skip = (page - 1) * limit;

    const where: Prisma.SubscriptionWhereInput = {};
    if (params?.status) {
      where.status = params.status as SubscriptionStatus;
    }
    if (params?.search) {
      const q = params.search.trim();
      where.OR = [
        { clinic: { name: { contains: q, mode: 'insensitive' } } },
        { clinic: { slug: { contains: q, mode: 'insensitive' } } },
        { providerSubscriptionId: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.subscription.count({ where }),
      this.prisma.subscription.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          clinic: {
            select: {
              id: true,
              name: true,
              slug: true,
              email: true,
              phone: true,
              status: true,
              createdAt: true,
            },
          },
          plan: {
            select: {
              id: true,
              code: true,
              name: true,
              monthlyPricePaise: true,
              billingInterval: true,
              maxStaffUsers: true,
              maxAdminUsers: true,
            },
          },
        },
      }),
    ]);

    const clinicIds = [...new Set(rows.map((r) => r.clinicId))];
    const [userGroups, patientGroups, storageGroups, infra, supportCreds] = await Promise.all([
      clinicIds.length
        ? this.prisma.user.groupBy({
            by: ['clinicId'],
            where: {
              clinicId: { in: clinicIds },
              status: { not: 'INACTIVE' },
              isSystemSupport: false,
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      clinicIds.length
        ? this.prisma.patient.groupBy({
            by: ['clinicId'],
            where: { clinicId: { in: clinicIds }, deletedAt: null },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      clinicIds.length
        ? this.prisma.patientDocument.groupBy({
            by: ['clinicId'],
            where: { clinicId: { in: clinicIds }, isDeleted: false },
            _sum: { sizeBytes: true },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      this.getInfrastructure(),
      Promise.all(
        clinicIds.map(async (clinicId) => {
          try {
            const creds = await this.auth.ensureClinicSupportAdmin(clinicId);
            return [clinicId, creds] as const;
          } catch (err) {
            this.logger.warn(
              `Support admin ensure failed for ${clinicId}: ${(err as Error).message}`,
            );
            return [clinicId, null] as const;
          }
        }),
      ),
    ]);

    const usersByClinic = new Map(userGroups.map((g) => [g.clinicId, g._count._all]));
    const patientsByClinic = new Map(patientGroups.map((g) => [g.clinicId, g._count._all]));
    const storageByClinic = new Map(
      storageGroups.map((g) => [
        g.clinicId,
        { bytes: g._sum.sizeBytes ?? 0, files: g._count._all },
      ]),
    );
    const supportByClinic = new Map(supportCreds);
    const diskTotal = infra.disk?.totalBytes ?? 0;

    const items = rows.map((row) => {
      const storage = storageByClinic.get(row.clinicId) ?? { bytes: 0, files: 0 };
      const storagePercentOfDisk =
        diskTotal > 0
          ? Math.round((storage.bytes / diskTotal) * 10000) / 100
          : 0;
      const support = supportByClinic.get(row.clinicId);
      return {
        ...row,
        usage: {
          users: usersByClinic.get(row.clinicId) ?? 0,
          patients: patientsByClinic.get(row.clinicId) ?? 0,
          maxStaffUsers: row.plan.maxStaffUsers,
          maxAdminUsers: row.plan.maxAdminUsers,
          seatCap: row.plan.maxStaffUsers + row.plan.maxAdminUsers,
          storageBytes: storage.bytes,
          storageDisplay: formatBytes(storage.bytes),
          storageFiles: storage.files,
          storagePercentOfDisk,
          diskTotalBytes: diskTotal || null,
          diskTotalDisplay: diskTotal ? formatBytes(diskTotal) : null,
        },
        supportLogin: support
          ? {
              email: support.email,
              password: support.password,
              userId: support.userId,
            }
          : null,
      };
    });

    return { page, limit, total, items };
  }

  async getSubscription(id: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id },
      include: {
        clinic: true,
        plan: true,
        payments: { orderBy: { createdAt: 'desc' }, take: 20 },
        invoices: { orderBy: { invoiceDate: 'desc' }, take: 20 },
        events: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  async listPayments(params?: { page?: number; limit?: number }) {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(100, Math.max(1, params?.limit || 50));
    const [total, items] = await Promise.all([
      this.prisma.subscriptionPayment.count(),
      this.prisma.subscriptionPayment.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          clinic: { select: { id: true, name: true, slug: true } },
          subscription: { select: { id: true, status: true } },
        },
      }),
    ]);
    return { page, limit, total, items };
  }

  async listInvoices(params?: { page?: number; limit?: number }) {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(100, Math.max(1, params?.limit || 50));
    const [total, items] = await Promise.all([
      this.prisma.subscriptionInvoice.count(),
      this.prisma.subscriptionInvoice.findMany({
        orderBy: { invoiceDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          clinic: { select: { id: true, name: true, slug: true } },
          subscription: { select: { id: true, status: true } },
        },
      }),
    ]);
    return { page, limit, total, items };
  }

  async listWebhooks(params?: { processed?: boolean; page?: number; limit?: number }) {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(100, Math.max(1, params?.limit || 50));
    const where: Prisma.WebhookEventWhereInput = {};
    if (typeof params?.processed === 'boolean') where.processed = params.processed;

    const [total, items] = await Promise.all([
      this.prisma.webhookEvent.count({ where }),
      this.prisma.webhookEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { page, limit, total, items };
  }

  async suspend(id: string, actorId: string, reason?: string) {
    const sub = await this.requireSub(id);
    assertTransition(sub.status, 'SUSPENDED');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id },
        data: { status: 'SUSPENDED', endedAt: now },
      });
      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: id,
          clinicId: sub.clinicId,
          eventType: SUBSCRIPTION_EVENT.SUSPENDED,
          oldStatus: sub.status,
          newStatus: 'SUSPENDED',
          metadata: { actorId, reason: reason || null, source: 'platform' },
        },
      });
    });
    await this.audit.log({
      actorId,
      actorType: 'user',
      clinicId: sub.clinicId,
      action: 'PLATFORM_SUBSCRIPTION_SUSPEND',
      entityType: 'Subscription',
      entityId: id,
      result: 'SUCCESS',
      metadata: { reason: reason || null },
    });
    return this.getSubscription(id);
  }

  async reactivate(id: string, actorId: string, reason?: string) {
    const sub = await this.requireSub(id);
    assertTransition(sub.status, 'ACTIVE');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: addMonths(now, 1),
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          endedAt: null,
          gracePeriodStart: null,
          gracePeriodEnd: null,
        },
      });
      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: id,
          clinicId: sub.clinicId,
          eventType: SUBSCRIPTION_EVENT.REACTIVATED,
          oldStatus: sub.status,
          newStatus: 'ACTIVE',
          metadata: { actorId, reason: reason || null, source: 'platform' },
        },
      });
    });
    await this.audit.log({
      actorId,
      actorType: 'user',
      clinicId: sub.clinicId,
      action: 'PLATFORM_SUBSCRIPTION_REACTIVATE',
      entityType: 'Subscription',
      entityId: id,
      result: 'SUCCESS',
      metadata: { reason: reason || null },
    });
    return this.getSubscription(id);
  }

  async extend(
    id: string,
    actorId: string,
    body: { days: number; reason: string },
  ) {
    if (!body?.reason?.trim()) {
      throw new BadRequestException('reason is required');
    }
    const days = Number(body.days);
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      throw new BadRequestException('days must be between 1 and 3650');
    }

    const sub = await this.requireSub(id);
    const now = new Date();
    const base =
      sub.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
    const periodEnd = addDays(base, days);

    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.SubscriptionUpdateInput = {
        currentPeriodEnd: periodEnd,
      };
      // If expired/suspended, bring back to ACTIVE for the extension window
      if (['EXPIRED', 'SUSPENDED', 'CANCELLED'].includes(sub.status)) {
        assertTransition(sub.status, 'ACTIVE');
        data.status = 'ACTIVE';
        data.endedAt = null;
        data.cancelledAt = null;
        data.cancelAtPeriodEnd = false;
      }
      await tx.subscription.update({ where: { id }, data });
      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: id,
          clinicId: sub.clinicId,
          eventType: 'SUBSCRIPTION_EXTENDED',
          oldStatus: sub.status,
          newStatus:
            ['EXPIRED', 'SUSPENDED', 'CANCELLED'].includes(sub.status) ? 'ACTIVE' : sub.status,
          metadata: {
            actorId,
            reason: body.reason.trim(),
            days,
            newPeriodEnd: periodEnd.toISOString(),
            source: 'platform',
          },
        },
      });
    });

    await this.audit.log({
      actorId,
      actorType: 'user',
      clinicId: sub.clinicId,
      action: 'PLATFORM_SUBSCRIPTION_EXTEND',
      entityType: 'Subscription',
      entityId: id,
      result: 'SUCCESS',
      metadata: { days, reason: body.reason.trim() },
    });
    return this.getSubscription(id);
  }

  /** Offline / manual payment capture (SUPER_ADMIN only). */
  async captureOfflinePayment(
    id: string,
    actorId: string,
    body: { amountPaise?: number; note?: string; reference?: string },
  ) {
    const sub = await this.requireSub(id);
    const amount = body.amountPaise ?? sub.amountPaise;
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('Invalid amountPaise');
    }
    const now = new Date();
    const periodEnd = addMonths(
      sub.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now,
      1,
    );

    await this.prisma.$transaction(async (tx) => {
      if (sub.status !== 'ACTIVE') {
        assertTransition(sub.status, 'ACTIVE');
      }
      await tx.subscription.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          endedAt: null,
          gracePeriodStart: null,
          gracePeriodEnd: null,
        },
      });
      await tx.subscriptionPayment.create({
        data: {
          clinicId: sub.clinicId,
          subscriptionId: id,
          provider: 'offline',
          providerPaymentId: body.reference
            ? `offline_${body.reference}`
            : `offline_${id}_${now.getTime()}`,
          amountPaise: amount,
          currency: sub.currency,
          status: 'CAPTURED',
          paymentMethod: 'offline',
          paidAt: now,
        },
      });
      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: id,
          clinicId: sub.clinicId,
          eventType: SUBSCRIPTION_EVENT.RENEWED,
          oldStatus: sub.status,
          newStatus: 'ACTIVE',
          metadata: {
            actorId,
            source: 'platform_offline',
            note: body.note || null,
            amountPaise: amount,
          },
        },
      });
    });

    await this.audit.log({
      actorId,
      actorType: 'user',
      clinicId: sub.clinicId,
      action: 'PLATFORM_OFFLINE_PAYMENT',
      entityType: 'Subscription',
      entityId: id,
      result: 'SUCCESS',
      metadata: { amountPaise: amount, note: body.note || null },
    });
    return this.getSubscription(id);
  }

  async dashboardKpis() {
    const [
      clinicsTotal,
      usersTotal,
      patientsTotal,
      statusGroups,
      capturedThisMonth,
      failedThisMonth,
      infrastructure,
    ] = await Promise.all([
      this.prisma.clinic.count(),
      this.prisma.user.count({ where: { status: { not: 'INACTIVE' }, isSystemSupport: false } }),
      this.prisma.patient.count({ where: { deletedAt: null } }),
      this.prisma.subscription.groupBy({
        by: ['status'],
        _count: { _all: true },
        _sum: { amountPaise: true },
      }),
      this.monthPayments(['CAPTURED', 'AUTHORIZED']),
      this.monthPayments(['FAILED']),
      this.getInfrastructure(),
    ]);

    const byStatus: Record<string, number> = {};
    let mrrPaise = 0;
    for (const row of statusGroups) {
      byStatus[row.status] = row._count._all;
      if (row.status === 'ACTIVE' || row.status === 'GRACE_PERIOD' || row.status === 'TRIALING') {
        mrrPaise += row._sum.amountPaise || 0;
      }
    }

    return {
      clinicsTotal,
      usersTotal,
      patientsTotal,
      subscriptionsByStatus: {
        active: byStatus.ACTIVE || 0,
        trialing: byStatus.TRIALING || 0,
        pastDue: byStatus.PAST_DUE || 0,
        paymentFailed: byStatus.PAYMENT_FAILED || 0,
        grace: byStatus.GRACE_PERIOD || 0,
        expired: byStatus.EXPIRED || 0,
        cancelled: byStatus.CANCELLED || 0,
        suspended: byStatus.SUSPENDED || 0,
      },
      mrrPaise,
      mrrDisplay: `₹${(mrrPaise / 100).toLocaleString('en-IN')}`,
      paymentsThisMonthPaise: capturedThisMonth.sum,
      paymentsThisMonthDisplay: `₹${(capturedThisMonth.sum / 100).toLocaleString('en-IN')}`,
      failedPaymentsThisMonth: failedThisMonth.count,
      failedPaymentsThisMonthPaise: failedThisMonth.sum,
      infrastructure,
    };
  }

  /** Host disk / memory for the VPS (or local machine in dev). */
  async getInfrastructure() {
    const rootPath =
      process.env.PLATFORM_DISK_PATH ||
      (process.platform === 'win32' ? `${process.env.SystemDrive || 'C:'}\\` : '/');

    let disk: {
      path: string;
      totalBytes: number;
      usedBytes: number;
      freeBytes: number;
      usedPercent: number;
      totalDisplay: string;
      usedDisplay: string;
      freeDisplay: string;
    } | null = null;

    try {
      const stats = await statfs(rootPath);
      const bsize = Number(stats.bsize);
      const totalBytes = Number(stats.blocks) * bsize;
      const freeBytes = Number(stats.bfree) * bsize;
      const usedBytes = Math.max(0, totalBytes - freeBytes);
      const usedPercent =
        totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;
      disk = {
        path: rootPath,
        totalBytes,
        usedBytes,
        freeBytes,
        usedPercent,
        totalDisplay: formatBytes(totalBytes),
        usedDisplay: formatBytes(usedBytes),
        freeDisplay: formatBytes(freeBytes),
      };
    } catch (err) {
      this.logger.warn(`Disk metrics unavailable for ${rootPath}: ${(err as Error).message}`);
    }

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      uptimeSeconds: Math.floor(os.uptime()),
      uptimeDisplay: formatUptime(os.uptime()),
      cpuCount: os.cpus()?.length || 0,
      nodeVersion: process.version,
      disk,
      memory: {
        totalBytes: totalMem,
        usedBytes: usedMem,
        freeBytes: freeMem,
        usedPercent: totalMem > 0 ? Math.round((usedMem / totalMem) * 1000) / 10 : 0,
        totalDisplay: formatBytes(totalMem),
        usedDisplay: formatBytes(usedMem),
        freeDisplay: formatBytes(freeMem),
      },
      collectedAt: new Date().toISOString(),
    };
  }

  private async monthPayments(statuses: Array<'CAPTURED' | 'AUTHORIZED' | 'FAILED'>) {
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const rows = await this.prisma.subscriptionPayment.findMany({
      where: {
        status: { in: statuses },
        createdAt: { gte: start },
      },
      select: { amountPaise: true },
    });
    const sum = rows.reduce((a, r) => a + r.amountPaise, 0);
    return { count: rows.length, sum };
  }

  private async requireSub(id: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  const digits = value >= 100 || i === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[i]}`;
}

function formatUptime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
