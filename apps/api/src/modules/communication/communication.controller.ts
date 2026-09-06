import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CommunicationService } from './communication.service';
import { WhatsAppQueueService } from './whatsapp-queue.service';
import { Authenticated } from '../../common/decorators/auth.decorator';
import { requireClinicId } from '../../common/tenant/clinic-context';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Communication')
@Controller('communication')
export class CommunicationController {
  constructor(
    private communicationService: CommunicationService,
    private whatsAppQueueService: WhatsAppQueueService,
  ) {}

  @Get('webhook/whatsapp')
  @ApiOperation({ summary: 'Meta WhatsApp webhook verification' })
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    return this.communicationService.verifyWebhookChallenge(mode, token, challenge);
  }

  @Post('webhook/whatsapp')
  @ApiOperation({ summary: 'WhatsApp delivery status webhook' })
  handleWebhook(
    @Body() body: any,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Headers('x-whatsapp-signature') altSignature: string | undefined,
  ) {
    return this.communicationService.handleWebhook(body, signature || altSignature);
  }

  @Get('messages')
  @ApiBearerAuth()
  @Authenticated('communication.view')
  @ApiOperation({ summary: 'List all communication messages' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'patientId', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('patientId') patientId?: string,
    @Query('type') type?: string,
  ) {
    return this.communicationService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      status,
      patientId,
      type,
    });
  }

  @Get('messages/:id')
  @ApiBearerAuth()
  @Authenticated('communication.view')
  async findById(@Param('id') id: string) {
    return this.communicationService.findById(id);
  }

  @Post('messages/:id/resend')
  @ApiBearerAuth()
  @Authenticated('communication.send')
  async resend(@Param('id') id: string) {
    return this.communicationService.resend(id);
  }

  @Post('invoices/:id/send')
  @ApiBearerAuth()
  @Authenticated('communication.send')
  @ApiOperation({ summary: 'Send invoice notification over WhatsApp' })
  sendInvoice(@Param('id') id: string) {
    return this.communicationService.queueInvoiceNotification(id, { force: true });
  }

  @Get('templates')
  @ApiBearerAuth()
  @Authenticated('communication.view')
  listTemplates() {
    return this.communicationService.listTemplates();
  }

  @Post('templates')
  @ApiBearerAuth()
  @Authenticated('communication.send')
  saveTemplate(
    @Body() body: { name: string; type: 'APPOINTMENT_REMINDER' | 'THERAPY_REMINDER' | 'PAYMENT_RECEIPT' | 'INVOICE' | 'GENERIC'; language?: string; body: string; isActive?: boolean },
    @CurrentUser('sub') userId: string,
  ) {
    return this.communicationService.upsertTemplate(body, userId);
  }

  @Patch('templates/:name')
  @ApiBearerAuth()
  @Authenticated('communication.send')
  updateTemplate(
    @Param('name') name: string,
    @Body() body: { type?: 'APPOINTMENT_REMINDER' | 'THERAPY_REMINDER' | 'PAYMENT_RECEIPT' | 'INVOICE' | 'GENERIC'; language?: string; body?: string; isActive?: boolean },
    @CurrentUser('sub') userId: string,
  ) {
    return this.communicationService.upsertTemplate({
      name,
      type: body.type || 'GENERIC',
      language: body.language,
      body: body.body || '',
      isActive: body.isActive,
    }, userId);
  }

  @Get('queue/metrics')
  @ApiBearerAuth()
  @Authenticated('communication.send')
  getQueueMetrics() {
    return this.whatsAppQueueService.getMetrics();
  }

  @Get('queue/jobs')
  @ApiBearerAuth()
  @Authenticated('communication.send')
  getQueueJobs(@Query('types') types?: string) {
    const typeArray = types ? types.split(',') as ('waiting' | 'active' | 'completed' | 'failed')[] : undefined;
    return this.whatsAppQueueService.getJobs(typeArray);
  }

  @Post('queue/pause')
  @ApiBearerAuth()
  @Authenticated('communication.send')
  pauseQueue() {
    return this.whatsAppQueueService.pause();
  }

  @Post('queue/resume')
  @ApiBearerAuth()
  @Authenticated('communication.send')
  resumeQueue() {
    return this.whatsAppQueueService.resume();
  }

  @Post('queue/clean')
  @ApiBearerAuth()
  @Authenticated('communication.send')
  cleanQueue(@Body() body?: { gracePeriodMs?: number; limit?: number }) {
    return this.whatsAppQueueService.clean(body?.gracePeriodMs, body?.limit);
  }
}
