import { Injectable, Inject, BadRequestException } from '@nestjs/common';

export type DashboardPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function money(value: unknown) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export function resolveRange(period?: string, startDate?: string, endDate?: string) {
  const mode = (period || 'daily').toLowerCase() as DashboardPeriod;
  const now = new Date();

  if (mode === 'weekly') {
    const from = startOfDay(now);
    const mondayOffset = (from.getDay() + 6) % 7;
    from.setDate(from.getDate() - mondayOffset);
    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    return { period: 'weekly' as const, from, to: endOfDay(to) };
  }

  if (mode === 'monthly') {
    const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const to = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    return { period: 'monthly' as const, from, to };
  }

  if (mode === 'custom') {
    if (!startDate || !endDate) {
      throw new BadRequestException('Custom range requires startDate and endDate (YYYY-MM-DD)');
    }
    const from = startOfDay(new Date(`${startDate}T00:00:00`));
    const to = endOfDay(new Date(`${endDate}T00:00:00`));
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      throw new BadRequestException('Invalid custom date range');
    }
    return { period: 'custom' as const, from, to };
  }

  return { period: 'daily' as const, from: startOfDay(now), to: endOfDay(now) };
}

@Injectable()
export class DashboardService {
  constructor(@Inject('PRISMA_CLIENT') private prisma: any) {}

  async getMetrics(clinicId: string, period?: string, startDate?: string, endDate?: string) {
    const range = resolveRange(period, startDate, endDate);
    const { from, to } = range;

    const [
      totalPatients,
      newPatients,
      waitingQueue,
      todayOpCases,
      activeTherapyCases,
      todayTherapySessions,
      todayPresent,
      periodRevenue,
      pendingInvoices,
      failedMessages,
      queuedMessages,
      aiToday,
      products,
    ] = await Promise.all([
      this.prisma.patient.count({ where: { clinicId, deletedAt: null } }),
      this.prisma.patient.count({ where: { clinicId, deletedAt: null, createdAt: { gte: from, lte: to } } }),
      this.prisma.queueItem.count({ where: { clinicId, status: 'WAITING' } }),
      this.prisma.opCase.count({ where: { clinicId, createdAt: { gte: from, lte: to } } }),
      this.prisma.therapyCase.count({ where: { clinicId, status: 'ACTIVE' } }),
      this.prisma.therapySession.count({ where: { clinicId, scheduledAt: { gte: from, lte: to } } }),
      this.prisma.therapyAttendance.count({
        where: {
          markedAt: { gte: from, lte: to },
          status: { in: ['PRESENT', 'LATE'] },
          session: { clinicId },
        },
      }),
      this.prisma.payment.aggregate({
        where: { clinicId, paidAt: { gte: from, lte: to }, status: 'SUCCESS' },
        _sum: { amount: true },
      }),
      this.prisma.invoice.findMany({
        where: { clinicId, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
        include: { payments: true, refunds: true },
      }),
      this.prisma.communicationMessage.count({ where: { clinicId, status: 'FAILED' } }),
      this.prisma.communicationMessage.count({ where: { clinicId, status: 'QUEUED' } }),
      this.prisma.aiUsage.aggregate({
        where: { clinicId, recordedAt: { gte: from, lte: to } },
        _sum: { promptTokens: true, completionTokens: true },
        _count: true,
      }),
      this.prisma.product.findMany({
        where: { clinicId, isActive: true },
        include: { transactions: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
    ]);

    const invoiceRows = Array.isArray(pendingInvoices) ? pendingInvoices : [];
    const todayRevenue = money(periodRevenue?._sum?.amount || 0);
    const outstanding = invoiceRows.reduce((sum: number, inv: any) => {
      const paid = (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
      const refunded = (inv.refunds || []).reduce((s: number, r: any) => s + Number(r.amount), 0);
      return sum + Math.max(0, Number(inv.grandTotal) - paid + refunded);
    }, 0);
    const productRows = Array.isArray(products) ? products : [];
    const lowStockCount = productRows.filter((p: any) => {
      const stock = p.transactions?.[0]?.balance ?? 0;
      return stock <= p.lowStockThreshold;
    }).length;

    return {
      totalPatients,
      newPatients,
      waitingQueue,
      todayOpCases,
      activeTherapyCases,
      todayTherapySessions,
      todayPresent,
      todayRevenue,
      pendingInvoices: invoiceRows.length,
      outstanding: money(outstanding),
      lowStockCount,
      whatsappFailed: failedMessages,
      whatsappQueued: queuedMessages,
      aiRequestsToday: aiToday._count || 0,
      aiTokensToday: (aiToday._sum?.promptTokens || 0) + (aiToday._sum?.completionTokens || 0),
      range: {
        period: range.period,
        startDate: ymd(from),
        endDate: ymd(to),
      },
    };
  }

  async getTodaySchedule(clinicId: string, period?: string, startDate?: string, endDate?: string) {
    const range = resolveRange(period, startDate, endDate);
    const { from, to } = range;
    const limit = range.period === 'daily' ? 12 : 40;
    const sessions = await this.prisma.therapySession.findMany({
      where: { clinicId, scheduledAt: { gte: from, lte: to } },
      orderBy: { scheduledAt: 'asc' },
      take: Math.min(limit, 20),
      include: {
        therapyCase: {
          include: { patient: { select: { id: true, name: true } } },
        },
      },
    });
    return { sessions, range: { period: range.period, startDate: ymd(from), endDate: ymd(to) } };
  }

  /** Time-series + breakdowns for dashboard charts. */
  async getCharts(clinicId: string, period?: string, startDate?: string, endDate?: string) {
    const range = resolveRange(period, startDate, endDate);
    let { from, to } = range;

    // Daily view: show a 7-day trend ending today for readable charts
    if (range.period === 'daily') {
      from = startOfDay(new Date());
      from.setDate(from.getDate() - 6);
      to = endOfDay(new Date());
    }

    const days: string[] = [];
    const cursor = startOfDay(from);
    const last = startOfDay(to);
    // Cap series length for custom ranges
    let guard = 0;
    while (cursor <= last && guard < 62) {
      days.push(ymd(cursor));
      cursor.setDate(cursor.getDate() + 1);
      guard += 1;
    }

    const [payments, sessions, opCases, attendance, invoiceItems] = await Promise.all([
      this.prisma.payment.findMany({
        where: { clinicId, paidAt: { gte: from, lte: to }, status: 'SUCCESS' },
        select: { amount: true, paidAt: true },
      }),
      this.prisma.therapySession.findMany({
        where: { clinicId, scheduledAt: { gte: from, lte: to } },
        select: { scheduledAt: true, status: true },
      }),
      this.prisma.opCase.findMany({
        where: { clinicId, createdAt: { gte: from, lte: to } },
        select: { createdAt: true },
      }),
      this.prisma.therapyAttendance.groupBy({
        by: ['status'],
        where: { markedAt: { gte: from, lte: to }, session: { clinicId } },
        _count: { _all: true },
      }).catch(() => []),
      this.prisma.invoiceItem.findMany({
        where: { invoice: { clinicId, issueDate: { gte: from, lte: to } } },
        select: { billableType: true, lineTotal: true },
      }),
    ]);

    const revenueByDay: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
    for (const payment of payments) {
      const key = ymd(new Date(payment.paidAt));
      if (key in revenueByDay) revenueByDay[key] = money(revenueByDay[key] + Number(payment.amount || 0));
    }

    const sessionsByDay: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
    for (const session of sessions) {
      const key = ymd(new Date(session.scheduledAt));
      if (key in sessionsByDay) sessionsByDay[key] += 1;
    }

    const opByDay: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
    for (const op of opCases) {
      const key = ymd(new Date(op.createdAt));
      if (key in opByDay) opByDay[key] += 1;
    }

    const attendanceBreakdown = (Array.isArray(attendance) ? attendance : []).map((row: any) => ({
      status: row.status as string,
      count: row._count?._all ?? 0,
    }));

    const revenueByType: Record<string, number> = {};
    for (const item of invoiceItems) {
      const type = item.billableType || 'OTHER';
      revenueByType[type] = money((revenueByType[type] || 0) + Number(item.lineTotal || 0));
    }

    const series = days.map((date) => ({
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      revenue: revenueByDay[date] || 0,
      sessions: sessionsByDay[date] || 0,
      opCases: opByDay[date] || 0,
    }));

    return {
      range: {
        period: range.period,
        startDate: ymd(from),
        endDate: ymd(to),
      },
      series,
      attendanceBreakdown,
      revenueByType: Object.entries(revenueByType).map(([type, amount]) => ({ type, amount })),
      totals: {
        revenue: money(series.reduce((s, row) => s + row.revenue, 0)),
        sessions: series.reduce((s, row) => s + row.sessions, 0),
        opCases: series.reduce((s, row) => s + row.opCases, 0),
      },
    };
  }

  async listWidgets() {
    return this.prisma.dashboardWidget.findMany({ orderBy: { title: 'asc' } });
  }

  async getLayout(userId: string) {
    const widgets = await this.listWidgets();
    const layouts = await this.prisma.dashboardLayout.findMany({
      where: { userId },
      include: { widget: true },
    });
    const byWidget = new Map<string, any>(layouts.map((row: any) => [row.widgetId, row]));
    return widgets.map((widget: any, index: number) => {
      const row = byWidget.get(widget.id);
      if (!row) {
        return {
          widgetId: widget.id,
          key: widget.key,
          title: widget.title,
          category: widget.category,
          positionX: index % 4,
          positionY: Math.floor(index / 4),
          width: 1,
          height: 1,
          isVisible: true,
        };
      }
      return {
        widgetId: row.widgetId,
        key: widget.key,
        title: widget.title,
        category: widget.category,
        positionX: row.positionX,
        positionY: row.positionY,
        width: row.width,
        height: row.height,
        isVisible: row.isVisible,
      };
    }).sort((a: any, b: any) => a.positionY - b.positionY || a.positionX - b.positionX);
  }

  async saveLayout(
    userId: string,
    items: Array<{ widgetId: string; positionX: number; positionY: number; width?: number; height?: number; isVisible?: boolean }>,
  ) {
    await this.prisma.$transaction(async (tx: any) => {
      await tx.dashboardLayout.deleteMany({ where: { userId } });
      await tx.dashboardLayout.createMany({
        data: items.map((item) => ({
          userId,
          widgetId: item.widgetId,
          positionX: item.positionX,
          positionY: item.positionY,
          width: item.width ?? 1,
          height: item.height ?? 1,
          isVisible: item.isVisible ?? true,
        })),
      });
    });
    return this.getLayout(userId);
  }
}

export { startOfDay, endOfDay, money, ymd };




