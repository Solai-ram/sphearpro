import {
  Controller,
  Get,
  Query,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { Authenticated } from '../../common/decorators/auth.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { requireClinicId } from '../../common/tenant/clinic-context';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @Authenticated('audit.view')
  @ApiOperation({ summary: 'List audit logs' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'entityType', required: false, type: String })
  @ApiQuery({ name: 'entityId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async findAll(
    @CurrentUser() user: { clinicId?: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      userId,
      action,
      entityType,
      entityId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      clinicId: requireClinicId(user),
    });
  }

  @Get('stats')
  @Authenticated('audit.view')
  @ApiOperation({ summary: 'Get audit log statistics' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  async getStats(
    @CurrentUser() user: { clinicId?: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userId') userId?: string,
  ) {
    return this.auditService.getStats({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      userId,
      clinicId: requireClinicId(user),
    });
  }

  @Get(':id')
  @Authenticated('audit.view')
  @ApiOperation({ summary: 'Get audit log by ID' })
  async findById(@Param('id') id: string, @CurrentUser() user: { clinicId?: string }) {
    return this.auditService.findById(id, requireClinicId(user));
  }
}
