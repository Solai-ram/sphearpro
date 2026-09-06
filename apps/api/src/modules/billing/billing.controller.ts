import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Authenticated } from '../../common/decorators/auth.decorator';
import { requireClinicId } from '../../common/tenant/clinic-context';
import type { Response } from 'express';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Get('reports/revenue')
  @Authenticated('billing.invoice.view')
  @ApiOperation({ summary: 'Revenue report' })
  @ApiQuery({ name: 'period', required: false })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async revenueReport(
    @CurrentUser() user: { clinicId?: string },
    @Query('period') period?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.billingService.revenueReport({
      clinicId: requireClinicId(user),
      period,
      startDate,
      endDate,
    });
  }

  @Get('reports/billing')
  @Authenticated('billing.invoice.view')
  @ApiOperation({ summary: 'Billing report of invoices issued' })
  @ApiQuery({ name: 'period', required: false })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async billingReport(
    @CurrentUser() user: { clinicId?: string },
    @Query('period') period?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.billingService.billingReport({
      clinicId: requireClinicId(user),
      period,
      startDate,
      endDate,
    });
  }

  @Get('reports/outstanding')
  @Authenticated('billing.invoice.view')
  @ApiOperation({ summary: 'Outstanding invoices report' })
  async outstandingReport(@CurrentUser() user: { clinicId?: string }) {
    return this.billingService.outstandingReport(requireClinicId(user));
  }

  @Get('patients/:patientId/outstanding')
  @Authenticated('billing.invoice.view')
  @ApiOperation({ summary: 'Outstanding balance for a patient' })
  async patientOutstanding(
    @Param('patientId') patientId: string,
    @CurrentUser() user: { clinicId?: string },
  ) {
    return this.billingService.patientOutstanding(patientId, requireClinicId(user));
  }

  @Get('invoices')
  @Authenticated('billing.invoice.view')
  @ApiOperation({ summary: 'List invoices' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'patientId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async findAllInvoices(
    @CurrentUser() user: { clinicId?: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('patientId') patientId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.billingService.findAllInvoices({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      patientId,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      clinicId: requireClinicId(user),
    });
  }

  @Post('invoices')
  @Authenticated('billing.invoice.create')
  @ApiOperation({ summary: 'Create invoice' })
  async createInvoice(
    @Body() body: {
      patientId: string;
      dueDate?: string;
      notes?: string;
      items: {
        billableType: 'OP_VISIT' | 'THERAPY_PACKAGE' | 'THERAPY_SESSION' | 'PRODUCT' | 'LAB_TEST' | 'OTHER';
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
      }[];
      payment?: { method: 'CASH' | 'CARD' | 'UPI' | 'NET_BANKING' | 'WALLET' | 'OTHER'; amount?: number; reference?: string };
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.billingService.createInvoice({ ...body, createdBy: user.sub, clinicId: requireClinicId(user) });
  }

  @Get('invoices/:id')
  @Authenticated('billing.invoice.view')
  @ApiOperation({ summary: 'Get invoice' })
  async findInvoiceById(@Param('id') id: string, @CurrentUser() user: { clinicId?: string }) {
    return this.billingService.findInvoiceById(id, requireClinicId(user));
  }

  @Get('invoices/:id/pdf')
  @Authenticated('billing.invoice.view')
  @ApiOperation({ summary: 'Download invoice PDF' })
  async invoicePdf(
    @Param('id') id: string,
    @CurrentUser() user: { sub?: string; clinicId?: string },
    @Res() res: Response,
  ) {
    const { fileName, buffer } = await this.billingService.invoicePdf(
      id,
      requireClinicId(user),
      user.sub,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Patch('invoices/:id')
  @Authenticated('billing.invoice.create')
  @ApiOperation({ summary: 'Update invoice notes or due date' })
  async updateInvoice(
    @Param('id') id: string,
    @Body() body: { notes?: string; dueDate?: string },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.billingService.updateInvoice(id, requireClinicId(user), {
      ...body,
      updatedBy: user.sub,
    });
  }

  @Post('invoices/:id/cancel')
  @Authenticated('billing.invoice.create')
  @ApiOperation({ summary: 'Cancel a pending invoice' })
  async cancelInvoice(
    @Param('id') id: string,
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.billingService.cancelInvoice(id, requireClinicId(user), user.sub);
  }

  @Get('payments')
  @Authenticated('billing.payment.view')
  @ApiOperation({ summary: 'List payments' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'patientId', required: false, type: String })
  @ApiQuery({ name: 'invoiceId', required: false, type: String })
  async findAllPayments(
    @CurrentUser() user: { clinicId?: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('patientId') patientId?: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('method') method?: string,
  ) {
    return this.billingService.findAllPayments({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      patientId,
      invoiceId,
      method,
      clinicId: requireClinicId(user),
    });
  }

  @Post('payments')
  @Authenticated('billing.payment.create')
  @ApiOperation({ summary: 'Record a payment' })
  async recordPayment(
    @Body() body: {
      invoiceId: string;
      amount: number;
      method: 'CASH' | 'CARD' | 'UPI' | 'NET_BANKING' | 'WALLET' | 'OTHER';
      reference?: string;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.billingService.recordPayment({ ...body, createdBy: user.sub, clinicId: requireClinicId(user) });
  }

  @Get('payments/:id')
  @Authenticated('billing.payment.view')
  @ApiOperation({ summary: 'Get payment' })
  async findPaymentById(@Param('id') id: string, @CurrentUser() user: { clinicId?: string }) {
    return this.billingService.findPaymentById(id, requireClinicId(user));
  }

  @Get('payments/:id/receipt')
  @Authenticated('billing.payment.view')
  @ApiOperation({ summary: 'Download payment receipt PDF' })
  async paymentReceipt(
    @Param('id') id: string,
    @CurrentUser() user: { sub?: string; clinicId?: string },
    @Res() res: Response,
  ) {
    const { fileName, buffer } = await this.billingService.paymentReceiptPdf(
      id,
      requireClinicId(user),
      user.sub,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Post('refunds')
  @Authenticated('billing.refund')
  @ApiOperation({ summary: 'Process a refund' })
  async createRefund(
    @Body() body: {
      invoiceId: string;
      paymentId?: string;
      amount: number;
      reason?: string;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.billingService.createRefund({
      ...body,
      createdBy: user.sub,
      clinicId: requireClinicId(user),
    });
  }

  @Get('refunds/:id')
  @Authenticated('billing.refund')
  @ApiOperation({ summary: 'Get refund' })
  async findRefundById(
    @Param('id') id: string,
    @CurrentUser() user: { clinicId?: string },
  ) {
    return this.billingService.findRefundById(id, requireClinicId(user));
  }
}
