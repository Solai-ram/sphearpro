import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CommunicationService } from '../communication/communication.service';
import { buildTextPdf } from './pdf';
import { amountInWordsInr } from './inr-words';
import { resolveRange } from '../dashboard/dashboard.service';

export type BillableType = 'OP_VISIT' | 'THERAPY_PACKAGE' | 'THERAPY_SESSION' | 'PRODUCT' | 'LAB_TEST' | 'OTHER';
export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'NET_BANKING' | 'WALLET' | 'OTHER';

export interface InvoiceItemInput {
  billableType: BillableType;
  referenceId?: string;
  productId?: string;
  description: string;
  quantity?: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
  model?: string;
  serialNo?: string;
  warranty?: string;
  colour?: string;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function money(value: unknown): number {
  return roundMoney(Number(value || 0));
}

function lineTotal(item: InvoiceItemInput): number {
  const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;
  const base = item.unitPrice * quantity;
  const afterDiscount = base - (item.discount || 0);
  return roundMoney(afterDiscount + (item.tax || 0));
}

@Injectable()
export class BillingService {
  constructor(
    @Inject('PRISMA_CLIENT') private prisma: any,
    private auditService: AuditService,
    private communicationService: CommunicationService,
  ) {}

  async createInvoice(data: {
    patientId: string;
    dueDate?: Date | string;
    notes?: string;
    items: InvoiceItemInput[];
    createdBy?: string;
    payment?: { method: PaymentMethod; amount?: number; reference?: string };
    clinicId: string;
  }) {
    if (!data.items?.length) throw new BadRequestException('At least one invoice item is required');

    const patient = await this.prisma.patient.findFirst({
      where: { id: data.patientId, clinicId: data.clinicId, deletedAt: null },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const normalized = data.items.map((item) => {
      if (item.unitPrice < 0) throw new BadRequestException('unitPrice cannot be negative');
      const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;
      const discount = item.discount || 0;
      const tax = item.tax || 0;
      return {
        billableType: item.billableType,
        referenceId: item.referenceId,
        productId: item.productId,
        description: item.description,
        quantity,
        unitPrice: roundMoney(item.unitPrice),
        discount: roundMoney(discount),
        tax: roundMoney(tax),
        lineTotal: lineTotal(item),
        model: item.model || null,
        serialNo: item.serialNo || null,
        warranty: item.warranty || null,
        colour: item.colour || null,
      };
    });

    const subtotal = roundMoney(normalized.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
    const discountTotal = roundMoney(normalized.reduce((sum, item) => sum + item.discount, 0));
    const taxTotal = roundMoney(normalized.reduce((sum, item) => sum + item.tax, 0));
    const grandTotal = roundMoney(normalized.reduce((sum, item) => sum + item.lineTotal, 0));

    const invoiceNumber = await this.nextInvoiceNumber(data.clinicId);
    const dueDate = data.dueDate ? new Date(data.dueDate) : addDays(new Date(), 14);

    const invoice = await this.prisma.invoice.create({
      data: {
        clinicId: data.clinicId,
        patientId: data.patientId,
        invoiceNumber,
        dueDate,
        status: 'PENDING',
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
        notes: data.notes,
        items: { create: normalized },
      },
      include: this.invoiceInclude(),
    });

    await this.auditService.log({
      clinicId: data.clinicId,
      actorId: data.createdBy,
      actorType: 'user',
      patientId: data.patientId,
      action: 'INVOICE_CREATED',
      entityType: 'Invoice',
      entityId: invoice.id,
      result: 'SUCCESS',
      metadata: { invoiceNumber, grandTotal, itemCount: normalized.length },
    });

    await this.addTimelineEvent({
      patientId: data.patientId,
      eventType: 'INVOICE',
      referenceId: invoice.id,
      title: `Invoice ${invoiceNumber}`,
      description: `Issued for ₹${grandTotal.toFixed(2)}`,
      metadata: { invoiceId: invoice.id, grandTotal },
    });

    try {
      await this.communicationService.queueInvoiceNotification(invoice.id);
    } catch (error) {
      console.error('Failed to queue invoice WhatsApp:', error);
    }

    if (data.payment?.method) {
      const payAmount = data.payment.amount == null ? grandTotal : roundMoney(data.payment.amount);
      if (payAmount > 0) {
        await this.recordPayment({
          invoiceId: invoice.id,
          clinicId: data.clinicId,
          amount: payAmount,
          method: data.payment.method,
          reference: data.payment.reference,
          createdBy: data.createdBy,
        });
        return this.findInvoiceById(invoice.id, data.clinicId);
      }
    }

    return this.withBalance(invoice);
  }

  async findAllInvoices(params: {
    page?: number;
    limit?: number;
    search?: string;
    patientId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
      clinicId: string;
  }) {
    const { page = 1, limit = 20, search, patientId, status, startDate, endDate } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.InvoiceWhereInput = { clinicId: params.clinicId };
    if (patientId) where.patientId = patientId;
    if (status) where.status = status as any;
    if (startDate || endDate) {
      where.issueDate = {};
      if (startDate) where.issueDate.gte = startDate;
      if (endDate) where.issueDate.lte = endDate;
    }
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { patient: { name: { contains: search, mode: 'insensitive' } } },
        { patient: { patientNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { issueDate: 'desc' },
        include: {
          patient: { select: { id: true, name: true, patientNumber: true, phone: true } },
          items: true,
          payments: true,
          refunds: true,
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: data.map((invoice: any) => this.withBalance(invoice)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findInvoiceById(id: string, clinicId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, clinicId },
      include: this.invoiceInclude(),
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.withBalance(invoice);
  }

  async updateInvoice(
    id: string,
    clinicId: string,
    data: { notes?: string; dueDate?: Date | string; updatedBy?: string },
  ) {
    const invoice = await this.findInvoiceById(id, clinicId);
    if (invoice.status === 'CANCELLED') {
      throw new BadRequestException('Cannot update a cancelled invoice');
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        notes: data.notes,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
      include: this.invoiceInclude(),
    });

    await this.auditService.log({
      actorId: data.updatedBy,
      actorType: 'user',
      patientId: invoice.patientId,
      action: 'INVOICE_UPDATED',
      entityType: 'Invoice',
      entityId: id,
      result: 'SUCCESS',
    });

    return this.withBalance(updated);
  }

  async cancelInvoice(id: string, clinicId: string, cancelledBy?: string) {
    const invoice = await this.findInvoiceById(id, clinicId);
    if (invoice.status !== 'PENDING') {
      throw new BadRequestException('Only pending invoices with no payments can be cancelled');
    }
    if (money(invoice.paidAmount) > 0) {
      throw new BadRequestException('Cannot cancel an invoice that has payments');
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: this.invoiceInclude(),
    });

    await this.auditService.log({
      actorId: cancelledBy,
      actorType: 'user',
      patientId: invoice.patientId,
      action: 'INVOICE_CANCELLED',
      entityType: 'Invoice',
      entityId: id,
      result: 'SUCCESS',
    });

    return this.withBalance(updated);
  }

  async recordPayment(data: {
    invoiceId: string;
    clinicId: string;
    amount: number;
    method: PaymentMethod;
    reference?: string;
    createdBy?: string;
  }) {
    if (data.amount <= 0) throw new BadRequestException('Payment amount must be greater than 0');

    const invoice = await this.findInvoiceById(data.invoiceId, data.clinicId);
    if (['CANCELLED', 'REFUNDED'].includes(invoice.status)) {
      throw new BadRequestException(`Cannot pay a ${invoice.status} invoice`);
    }

    const outstanding = money(invoice.outstanding);
    if (data.amount > outstanding) {
      throw new BadRequestException(`Payment exceeds outstanding balance of ${outstanding.toFixed(2)}`);
    }

    const payment = await this.prisma.$transaction(async (tx: any) => {
      const created = await tx.payment.create({
        data: {
          clinicId: invoice.clinicId,
          invoiceId: invoice.id,
          patientId: invoice.patientId,
          amount: roundMoney(data.amount),
          method: data.method,
          status: 'SUCCESS',
          reference: data.reference,
          createdBy: data.createdBy,
        },
      });

      await tx.paymentAllocation.create({
        data: {
          paymentId: created.id,
          invoiceId: invoice.id,
          amount: roundMoney(data.amount),
        },
      });

      const paidAmount = roundMoney(money(invoice.paidAmount) + data.amount);
      const grandTotal = money(invoice.grandTotal);
      const status = paidAmount >= grandTotal ? 'PAID' : 'PARTIALLY_PAID';

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status },
      });

      return created;
    });

    await this.auditService.log({
      actorId: data.createdBy,
      actorType: 'user',
      patientId: invoice.patientId,
      action: 'PAYMENT_RECORDED',
      entityType: 'Payment',
      entityId: payment.id,
      result: 'SUCCESS',
      metadata: { invoiceId: invoice.id, amount: data.amount, method: data.method },
    });

    await this.addTimelineEvent({
      patientId: invoice.patientId,
      eventType: 'PAYMENT',
      referenceId: payment.id,
      title: 'Payment Received',
      description: `₹${roundMoney(data.amount).toFixed(2)} toward ${invoice.invoiceNumber}`,
      metadata: { invoiceId: invoice.id, paymentId: payment.id },
    });

    try {
      await this.communicationService.queuePaymentReceipt(payment.id);
    } catch (error) {
      console.error('Failed to queue payment receipt:', error);
    }

    return this.findPaymentById(payment.id, data.clinicId);
  }

  async findAllPayments(params: {
    page?: number;
    limit?: number;
    patientId?: string;
    invoiceId?: string;
    method?: string;
    clinicId: string;
  }) {
    const { page = 1, limit = 20, patientId, invoiceId, method, clinicId } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.PaymentWhereInput = { clinicId };
    if (patientId) where.patientId = patientId;
    if (invoiceId) where.invoiceId = invoiceId;
    if (method) where.method = method as any;

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paidAt: 'desc' },
        include: {
          patient: { select: { id: true, name: true, patientNumber: true } },
          invoice: { select: { id: true, invoiceNumber: true, grandTotal: true, status: true } },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findPaymentById(id: string, clinicId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, clinicId },
      include: {
        patient: { select: { id: true, name: true, patientNumber: true, phone: true } },
        invoice: { select: { id: true, invoiceNumber: true, grandTotal: true, status: true } },
        allocations: true,
        refunds: true,
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async invoicePdf(id: string, clinicId: string, actorId?: string) {
    const invoice = await this.findInvoiceById(id, clinicId);
    const clinic = await this.clinicSettings();
    const paid = money(invoice.paidAmount);
    const balance = money(invoice.outstanding);
    const qtyTotal = (invoice.items || []).reduce((s: number, i: any) => s + Number(i.quantity || 0), 0);
    const discountTotal = money(invoice.discountTotal);
    const amountTotal = money(invoice.grandTotal);
    const lastPay = (invoice.payments || []).find((p: any) => p.status === 'SUCCESS');
    const paymentMode = lastPay?.method || (paid > 0 ? 'Mixed' : 'Credit');
    const billAddress = this.formatAddress(invoice.patient?.address);

    const lines = [
      clinic.title,
      clinic.name,
      clinic.logoText ? `Logo: ${clinic.logoText}` : '',
      clinic.address,
      clinic.phone ? `Phone No.: ${clinic.phone}` : '',
      clinic.email ? `Email: ${clinic.email}` : '',
      clinic.gstin ? `GSTIN: ${clinic.gstin}` : '',
      clinic.state ? `State: ${clinic.state}` : '',
      '',
      'Bill To',
      invoice.patient?.name || '',
      billAddress,
      invoice.patient?.phone ? `Contact No.: ${invoice.patient.phone}` : '',
      '',
      `Invoice No.: ${invoice.invoiceNumber}`,
      `Date: ${new Date(invoice.issueDate).toLocaleDateString('en-IN')}`,
      '',
      '# | Product Name | Hearing Aid Model | Serial No. | Warranty | Colour | Qty | Price/Unit | Discount | Amount',
      ...(invoice.items || []).map((item: any, index: number) =>
        [
          index + 1,
          item.description,
          item.model || '-',
          item.serialNo || '-',
          item.warranty || '-',
          item.colour || '-',
          item.quantity,
          `Rs ${money(item.unitPrice).toFixed(2)}`,
          `Rs ${money(item.discount).toFixed(2)}`,
          `Rs ${money(item.lineTotal).toFixed(2)}`,
        ].join(' | '),
      ),
      `Total Qty ${qtyTotal}  Discount Rs ${discountTotal.toFixed(2)}  Amount Rs ${amountTotal.toFixed(2)}`,
      '',
      `Invoice Amount In Words: ${amountInWordsInr(amountTotal)}`,
      '',
      'Terms and Conditions',
      ...clinic.terms,
      '',
      `Sub Total: Rs ${money(invoice.subtotal).toFixed(2)}`,
      `Discount: Rs ${discountTotal.toFixed(2)}`,
      `Total: Rs ${amountTotal.toFixed(2)}`,
      `Received: Rs ${paid.toFixed(2)}`,
      `Balance: Rs ${balance.toFixed(2)}`,
      `Payment mode: ${paymentMode}`,
    ].filter((line) => line !== '');

    await this.auditService.log({
      actorId,
      actorType: 'user',
      patientId: invoice.patientId,
      action: 'INVOICE_PDF_DOWNLOADED',
      entityType: 'Invoice',
      entityId: id,
      result: 'SUCCESS',
    });

    return {
      fileName: `${invoice.invoiceNumber}.pdf`,
      buffer: buildTextPdf(clinic.title, lines),
    };
  }

  async paymentReceiptPdf(id: string, clinicId: string, actorId?: string) {
    const payment = await this.findPaymentById(id, clinicId);
    const clinic = await this.clinicSettings();
    const lines = [
      clinic.name,
      clinic.address,
      clinic.phone ? `Phone: ${clinic.phone}` : '',
      '',
      `Receipt for payment ${payment.id.slice(-8).toUpperCase()}`,
      `Date: ${new Date(payment.paidAt).toLocaleString('en-IN')}`,
      `Patient: ${payment.patient?.name || ''} (${payment.patient?.patientNumber || ''})`,
      `Invoice: ${payment.invoice?.invoiceNumber || payment.invoiceId}`,
      `Method: ${payment.method}`,
      payment.reference ? `Reference: ${payment.reference}` : '',
      `Amount received: Rs ${money(payment.amount).toFixed(2)}`,
      `Status: ${payment.status}`,
    ].filter((line) => line !== '');

    await this.auditService.log({
      actorId,
      actorType: 'user',
      patientId: payment.patientId,
      action: 'PAYMENT_RECEIPT_DOWNLOADED',
      entityType: 'Payment',
      entityId: id,
      result: 'SUCCESS',
    });

    return {
      fileName: `receipt-${payment.invoice?.invoiceNumber || payment.id}.pdf`,
      buffer: buildTextPdf('Payment receipt', lines),
    };
  }

  private async clinicSettings() {
    const rows = await this.prisma.setting.findMany({
      where: {
        key: {
          in: [
            'clinic.name',
            'clinic.address',
            'clinic.phone',
            'clinic.email',
            'clinic.gstin',
            'clinic.state',
            'clinic.logoText',
            'invoice.title',
            'invoice.terms',
          ],
        },
      },
    });
    const map = Object.fromEntries(
      rows.map((row: any) => [row.key, typeof row.value === 'string' ? row.value : row.value == null ? '' : String(row.value)]),
    );
    const termsRaw = map['invoice.terms'] || 'Exempted from Sales Tax.\nReceived the above goods in sound condition & correct quantity.\nGoods once sold cannot be taken back.';
    return {
      name: map['clinic.name'] || process.env.PRODUCT_NAME || 'SPHEAR',
      address: map['clinic.address'] || '',
      phone: map['clinic.phone'] || '',
      email: map['clinic.email'] || '',
      gstin: map['clinic.gstin'] || '',
      state: map['clinic.state'] || '',
      logoText: map['clinic.logoText'] || '',
      title: map['invoice.title'] || 'Tax Invoice',
      terms: String(termsRaw).split('\n').map((t) => t.trim()).filter(Boolean),
    };
  }

  private formatAddress(address: unknown) {
    if (!address) return '';
    if (typeof address === 'string') return address;
    if (typeof address === 'object') {
      const a = address as Record<string, string>;
      return [a.street, a.area, a.city, a.state, a.pincode, a.country].filter(Boolean).join(', ');
    }
    return '';
  }

  async createRefund(data: {
    invoiceId: string;
    clinicId: string;
    paymentId?: string;
    amount: number;
    reason?: string;
    createdBy?: string;
  }) {
    if (data.amount <= 0) throw new BadRequestException('Refund amount must be greater than 0');

    const invoice = await this.findInvoiceById(data.invoiceId, data.clinicId);
    if (!['PAID', 'PARTIALLY_PAID'].includes(invoice.status)) {
      throw new BadRequestException('Refunds are only allowed on paid or partially paid invoices');
    }

    const refundable = money(invoice.paidAmount) - money(invoice.refundedAmount);
    if (data.amount > refundable) {
      throw new BadRequestException(`Refund exceeds refundable amount of ${refundable.toFixed(2)}`);
    }

    if (data.paymentId) {
      const payment = await this.findPaymentById(data.paymentId, data.clinicId);
      if (payment.invoiceId !== invoice.id) {
        throw new BadRequestException('Payment does not belong to this invoice');
      }
    }

    const refund = await this.prisma.$transaction(async (tx: any) => {
      const created = await tx.refund.create({
        data: {
          invoiceId: invoice.id,
          paymentId: data.paymentId,
          amount: roundMoney(data.amount),
          reason: data.reason,
          status: 'PROCESSED',
          createdBy: data.createdBy,
        },
      });

      const newRefunded = roundMoney(money(invoice.refundedAmount) + data.amount);
      const netPaid = roundMoney(money(invoice.paidAmount) - newRefunded);
      const status = netPaid <= 0 ? 'REFUNDED' : 'PARTIALLY_PAID';

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status },
      });

      if (data.paymentId && netPaid <= 0) {
        await tx.payment.update({
          where: { id: data.paymentId },
          data: { status: 'REFUNDED' },
        });
      }

      return created;
    });

    await this.auditService.log({
      actorId: data.createdBy,
      actorType: 'user',
      patientId: invoice.patientId,
      action: 'PAYMENT_REFUNDED',
      entityType: 'Refund',
      entityId: refund.id,
      result: 'SUCCESS',
      metadata: { invoiceId: invoice.id, amount: data.amount, reason: data.reason },
    });

    return refund;
  }

  async findRefundById(id: string, clinicId: string) {
    const refund = await this.prisma.refund.findFirst({
      where: { id, invoice: { clinicId } },
      include: {
        invoice: { select: { id: true, invoiceNumber: true, patientId: true } },
        payment: true,
      },
    });
    if (!refund) throw new NotFoundException('Refund not found');
    return refund;
  }

  async revenueReport(params: {
    clinicId: string; period?: string; startDate?: string; endDate?: string }) {
    const ranged = Boolean(params.period || params.startDate);
    const range = ranged
      ? resolveRange(params.period || 'custom', params.startDate, params.endDate)
      : null;
    const where: Prisma.PaymentWhereInput = { clinicId: params.clinicId, status: 'SUCCESS' };
    if (range) {
      where.paidAt = { gte: range.from, lte: range.to };
    }

    const payments = await this.prisma.payment.findMany({
      where,
      orderBy: { paidAt: 'desc' },
      include: {
        patient: { select: { name: true, patientNumber: true } },
        invoice: { select: { invoiceNumber: true, items: { select: { billableType: true, lineTotal: true } } } },
      },
    });
    const refunds = await this.prisma.refund.findMany({
      where: {
        invoice: { clinicId: params.clinicId },
        status: 'PROCESSED',
        ...(range
          ? { refundedAt: { gte: range.from, lte: range.to } }
          : {}),
      },
      select: { amount: true },
    });

    const collected = roundMoney(payments.reduce((sum: number, p: any) => sum + money(p.amount), 0));
    const refunded = roundMoney(refunds.reduce((sum: number, r: any) => sum + money(r.amount), 0));
    const byMethod: Record<string, number> = {};
    const byDayMap = new Map<string, { date: string; collected: number; count: number }>();
    const byType: Record<string, number> = {};
    for (const payment of payments) {
      byMethod[payment.method] = roundMoney((byMethod[payment.method] || 0) + money(payment.amount));
      const day = new Date(payment.paidAt);
      const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      const row = byDayMap.get(dateKey) || { date: dateKey, collected: 0, count: 0 };
      row.collected = roundMoney(row.collected + money(payment.amount));
      row.count += 1;
      byDayMap.set(dateKey, row);
      for (const item of payment.invoice?.items || []) {
        byType[item.billableType] = roundMoney((byType[item.billableType] || 0) + money(item.lineTotal));
      }
    }

    return {
      period: range?.period || 'all',
      from: range?.from,
      to: range?.to,
      collected,
      refunded,
      net: roundMoney(collected - refunded),
      paymentCount: payments.length,
      byMethod,
      byBillableType: byType,
      byDay: [...byDayMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      payments: payments.slice(0, 50).map((p: any) => ({
        id: p.id,
        amount: money(p.amount),
        method: p.method,
        paidAt: p.paidAt,
        invoiceNumber: p.invoice?.invoiceNumber,
        patientName: p.patient?.name,
        patientNumber: p.patient?.patientNumber,
      })),
    };
  }

  async billingReport(params: {
    clinicId: string; period?: string; startDate?: string; endDate?: string }) {
    const range = resolveRange(params.period || 'daily', params.startDate, params.endDate);
    const invoices = await this.prisma.invoice.findMany({
      where: {
        clinicId: params.clinicId,
        issueDate: { gte: range.from, lte: range.to },
      },
      orderBy: { issueDate: 'desc' },
      include: {
        patient: { select: { id: true, name: true, patientNumber: true } },
        items: true,
        payments: { where: { status: 'SUCCESS' } },
        refunds: { where: { status: 'PROCESSED' } },
      },
    });
    const rows = invoices.map((invoice: any) => this.withBalance(invoice));
    const open = rows.filter((inv: any) => inv.status !== 'CANCELLED');
    const billed = roundMoney(open.reduce((s: number, inv: any) => s + money(inv.grandTotal), 0));
    const collected = roundMoney(open.reduce((s: number, inv: any) => s + money(inv.paidAmount), 0));
    const outstanding = roundMoney(open.reduce((s: number, inv: any) => s + money(inv.outstanding), 0));
    const byStatus: Record<string, { count: number; amount: number }> = {};
    const byType: Record<string, { count: number; amount: number }> = {};
    for (const inv of open) {
      const st = inv.status || 'PENDING';
      byStatus[st] = byStatus[st] || { count: 0, amount: 0 };
      byStatus[st].count += 1;
      byStatus[st].amount = roundMoney(byStatus[st].amount + money(inv.grandTotal));
      for (const item of inv.items || []) {
        const t = item.billableType;
        byType[t] = byType[t] || { count: 0, amount: 0 };
        byType[t].count += Number(item.quantity || 1);
        byType[t].amount = roundMoney(byType[t].amount + money(item.lineTotal));
      }
    }
    return {
      period: range.period,
      from: range.from,
      to: range.to,
      summary: {
        invoices: open.length,
        billed,
        collected,
        outstanding,
        cancelled: rows.filter((inv: any) => inv.status === 'CANCELLED').length,
      },
      byStatus,
      byBillableType: byType,
      invoices: rows.slice(0, 80),
    };
  }

  async outstandingReport(clinicId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { clinicId, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
      include: {
        patient: { select: { id: true, name: true, patientNumber: true } },
        payments: { where: { status: 'SUCCESS' }, select: { amount: true } },
        refunds: { where: { status: 'PROCESSED' }, select: { amount: true } },
      },
      orderBy: { issueDate: 'asc' },
    });

    const rows = invoices.map((invoice: any) => this.withBalance(invoice));
    const totalOutstanding = roundMoney(rows.reduce((sum: number, inv: any) => sum + money(inv.outstanding), 0));

    return { data: rows, totalOutstanding, count: rows.length };
  }

  async patientOutstanding(patientId: string, clinicId: string) {
    const result = await this.findAllInvoices({
      patientId,
      page: 1,
      limit: 100,
      clinicId,
    });
    const open = result.data.filter((inv: any) => ['PENDING', 'PARTIALLY_PAID'].includes(inv.status));
    const totalOutstanding = roundMoney(open.reduce((sum: number, inv: any) => sum + money(inv.outstanding), 0));
    return { data: open, totalOutstanding };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private withBalance(invoice: any) {
    const paidAmount = roundMoney(
      (invoice.payments || [])
        .filter((p: any) => p.status === 'SUCCESS' || p.status === 'REFUNDED')
        .reduce((sum: number, p: any) => sum + money(p.amount), 0),
    );
    const refundedAmount = roundMoney(
      (invoice.refunds || [])
        .filter((r: any) => r.status === 'PROCESSED')
        .reduce((sum: number, r: any) => sum + money(r.amount), 0),
    );
    const netPaid = roundMoney(paidAmount - refundedAmount);
    const outstanding = Math.max(0, roundMoney(money(invoice.grandTotal) - netPaid));
    return { ...invoice, paidAmount: netPaid, refundedAmount, outstanding };
  }

  private invoiceInclude() {
    return {
      patient: { select: { id: true, name: true, patientNumber: true, phone: true, email: true, address: true } },
      items: true,
      payments: { orderBy: { paidAt: 'desc' } },
      refunds: { orderBy: { refundedAt: 'desc' } },
    };
  }

  private async nextInvoiceNumber(clinicId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const last = await this.prisma.invoice.findFirst({
      where: { clinicId, invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });
    const seq = last ? parseInt(last.invoiceNumber.slice(prefix.length), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(6, '0')}`;
  }

  private async addTimelineEvent(data: {
    patientId: string;
    eventType: string;
    referenceId: string;
    title: string;
    description?: string;
    metadata?: Record<string, any>;
  }) {
    return this.prisma.patientTimelineEvent.create({
      data: {
        patientId: data.patientId,
        eventType: data.eventType as any,
        referenceId: data.referenceId,
        title: data.title,
        description: data.description,
        occurredAt: new Date(),
        metadata: data.metadata,
      },
    });
  }
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
