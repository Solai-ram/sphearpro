import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { startOfDay, endOfDay, money } from './dashboard.service';

@Injectable()
export class ReportsService {
  constructor(@Inject('PRISMA_CLIENT') private prisma: any) {}

  private range(startDate?: string, endDate?: string) {
    const from = startDate ? startOfDay(new Date(startDate)) : startOfDay(new Date(Date.now() - 29 * 86400000));
    const to = endDate ? endOfDay(new Date(endDate)) : endOfDay();
    if (from > to) throw new BadRequestException('startDate must be before endDate');
    return { from, to };
  }

  async clinical(clinicId: string, startDate?: string, endDate?: string) {
    const { from, to } = this.range(startDate, endDate);
    const [opCases, diagnoses, followUps, prescriptions] = await Promise.all([
      this.prisma.opCase.count({ where: { clinicId, createdAt: { gte: from, lte: to } } }),
      this.prisma.diagnosis.findMany({
        where: { opCase: { clinicId, createdAt: { gte: from, lte: to } } },
        select: { code: true, description: true },
      }),
      this.prisma.followUp.count({ where: { dueDate: { gte: from, lte: to }, opCase: { clinicId } } }),
      this.prisma.prescription.count({ where: { createdAt: { gte: from, lte: to }, opCase: { clinicId } } }),
    ]);
    const counts = new Map<string, { code: string | null; description: string; count: number }>();
    for (const d of diagnoses) {
      const key = `${d.code || ''}|${d.description}`;
      const current = counts.get(key) || { code: d.code, description: d.description, count: 0 };
      current.count += 1;
      counts.set(key, current);
    }
    return {
      from, to,
      opCases,
      followUps,
      prescriptions,
      topDiagnoses: [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 10),
    };
  }

  async therapy(clinicId: string, startDate?: string, endDate?: string) {
    const { from, to } = this.range(startDate, endDate);
    const [activeCases, sessions, attendance, packages] = await Promise.all([
      this.prisma.therapyCase.count({ where: { clinicId, status: 'ACTIVE' } }),
      this.prisma.therapySession.count({ where: { clinicId, scheduledAt: { gte: from, lte: to } } }),
      this.prisma.therapyAttendance.groupBy({
        by: ['status'],
        where: { markedAt: { gte: from, lte: to } },
        _count: { _all: true },
      }).catch(() => []),
      this.prisma.patientPackage.findMany({
        where: { clinicId, purchasedAt: { gte: from, lte: to } },
        select: { totalSessions: true, usedSessions: true },
      }),
    ]);
    const attendanceByStatus: Record<string, number> = {};
    for (const row of attendance) {
      attendanceByStatus[row.status] = row._count?._all ?? 0;
    }
    const packageSessions = packages.reduce((s: number, p: any) => s + p.totalSessions, 0);
    const usedSessions = packages.reduce((s: number, p: any) => s + p.usedSessions, 0);
    return {
      from, to,
      activeCases,
      sessions,
      missed: attendanceByStatus.ABSENT || 0,
      attendanceByStatus,
      packagesSold: packages.length,
      packageUtilization: packageSessions ? Math.round((usedSessions / packageSessions) * 100) : 0,
    };
  }

  async financial(clinicId: string, startDate?: string, endDate?: string) {
    const { from, to } = this.range(startDate, endDate);
    const [payments, refunds, invoices, items] = await Promise.all([
      this.prisma.payment.findMany({ where: { clinicId, paidAt: { gte: from, lte: to }, status: 'SUCCESS' } }),
      this.prisma.refund.findMany({ where: { refundedAt: { gte: from, lte: to }, status: 'PROCESSED' } }),
      this.prisma.invoice.findMany({
        where: { clinicId, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
        include: { payments: true, refunds: true },
      }),
      this.prisma.invoiceItem.findMany({
        where: { invoice: { clinicId, issueDate: { gte: from, lte: to } } },
        select: { billableType: true, lineTotal: true },
      }),
    ]);
    const collected = money(payments.reduce((s: number, p: any) => s + Number(p.amount), 0));
    const refunded = money(refunds.reduce((s: number, r: any) => s + Number(r.amount), 0));
    const outstanding = money(invoices.reduce((sum: number, inv: any) => {
      const paid = (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
      const ref = (inv.refunds || []).reduce((s: number, r: any) => s + Number(r.amount), 0);
      return sum + Math.max(0, Number(inv.grandTotal) - paid + ref);
    }, 0));
    const byType: Record<string, number> = {};
    for (const item of items) {
      byType[item.billableType] = money((byType[item.billableType] || 0) + Number(item.lineTotal));
    }
    return {
      from, to,
      collected,
      refunded,
      net: money(collected - refunded),
      outstanding,
      pendingInvoiceCount: invoices.length,
      byBillableType: byType,
    };
  }

  async inventory(clinicId: string) {
    const products = await this.prisma.product.findMany({
      where: { clinicId, isActive: true },
      include: {
        category: true,
        transactions: { orderBy: { createdAt: 'desc' }, take: 1 },
        sales: { select: { quantity: true, totalPrice: true } },
      },
    });
    const rows = products.map((p: any) => {
      const currentStock = p.transactions?.[0]?.balance ?? 0;
      const soldQty = (p.sales || []).reduce((s: number, sale: any) => s + sale.quantity, 0);
      const soldValue = money((p.sales || []).reduce((s: number, sale: any) => s + Number(sale.totalPrice), 0));
      return {
        sku: p.sku,
        name: p.name,
        category: p.category?.name,
        currentStock,
        lowStockThreshold: p.lowStockThreshold,
        isLowStock: currentStock <= p.lowStockThreshold,
        soldQty,
        soldValue,
      };
    });
    return {
      productCount: rows.length,
      lowStockCount: rows.filter((r: any) => r.isLowStock).length,
      products: rows,
    };
  }

  async aiUsage(clinicId: string, startDate?: string, endDate?: string) {
    const { from, to } = this.range(startDate, endDate);
    const rows = await this.prisma.aiUsage.groupBy({
      by: ['provider', 'requestType'],
      where: { recordedAt: { gte: from, lte: to } },
      _sum: { promptTokens: true, completionTokens: true },
      _count: { _all: true },
    }).catch(() => []);
    return {
      from, to,
      rows: rows.map((r: any) => ({
        provider: r.provider,
        requestType: r.requestType,
        requests: r._count?._all ?? 0,
        promptTokens: r._sum?.promptTokens || 0,
        completionTokens: r._sum?.completionTokens || 0,
      })),
    };
  }

  toCsv(type: string, payload: any): string {
    if (type === 'inventory') {
      const header = 'sku,name,category,stock,threshold,low_stock,sold_qty,sold_value';
      const lines = (payload.products || []).map((p: any) =>
        [p.sku, p.name, p.category, p.currentStock, p.lowStockThreshold, p.isLowStock, p.soldQty, p.soldValue].join(','),
      );
      return [header, ...lines].join('\n');
    }
    if (type === 'financial') {
      const header = 'metric,value';
      const lines = [
        `collected,${payload.collected}`,
        `refunded,${payload.refunded}`,
        `net,${payload.net}`,
        `outstanding,${payload.outstanding}`,
        ...Object.entries(payload.byBillableType || {}).map(([k, v]) => `${k},${v}`),
      ];
      return [header, ...lines].join('\n');
    }
    if (type === 'clinical') {
      const header = 'code,description,count';
      const lines = (payload.topDiagnoses || []).map((d: any) => `${d.code || ''},${(d.description || '').replace(/,/g, ' ')},${d.count}`);
      return [`op_cases,${payload.opCases}`, `follow_ups,${payload.followUps}`, header, ...lines].join('\n');
    }
    if (type === 'therapy') {
      const header = 'status,count';
      const lines = Object.entries(payload.attendanceByStatus || {}).map(([k, v]) => `${k},${v}`);
      return [`active_cases,${payload.activeCases}`, `sessions,${payload.sessions}`, header, ...lines].join('\n');
    }
    return JSON.stringify(payload);
  }
}
