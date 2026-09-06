import { Controller, Get, Query, Param, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { Authenticated } from '../../common/decorators/auth.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { requireClinicId } from '../../common/tenant/clinic-context';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('clinical')
  @Authenticated('reports.view')
  clinical(
    @CurrentUser() user: { clinicId?: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.clinical(requireClinicId(user), startDate, endDate);
  }

  @Get('therapy')
  @Authenticated('reports.view')
  therapy(
    @CurrentUser() user: { clinicId?: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.therapy(requireClinicId(user), startDate, endDate);
  }

  @Get('financial')
  @Authenticated('reports.view')
  financial(
    @CurrentUser() user: { clinicId?: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.financial(requireClinicId(user), startDate, endDate);
  }

  @Get('inventory')
  @Authenticated('reports.view')
  inventory(@CurrentUser() user: { clinicId?: string }) {
    return this.reportsService.inventory(requireClinicId(user));
  }

  @Get('ai')
  @Authenticated('reports.view')
  ai(
    @CurrentUser() user: { clinicId?: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.aiUsage(requireClinicId(user), startDate, endDate);
  }

  @Get('export/:type')
  @Authenticated('reports.export')
  @ApiOperation({ summary: 'Export a report as CSV' })
  async export(
    @Param('type') typeParam: string,
    @CurrentUser() user: { clinicId?: string },
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Res() res: Response,
  ) {
    const clinicId = requireClinicId(user);
    const type = (typeParam || 'financial').toLowerCase();
    let payload: any;
    if (type === 'clinical') payload = await this.reportsService.clinical(clinicId, startDate, endDate);
    else if (type === 'therapy') payload = await this.reportsService.therapy(clinicId, startDate, endDate);
    else if (type === 'inventory') payload = await this.reportsService.inventory(clinicId);
    else if (type === 'ai') payload = await this.reportsService.aiUsage(clinicId, startDate, endDate);
    else payload = await this.reportsService.financial(clinicId, startDate, endDate);
    const csv = this.reportsService.toCsv(type, payload);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-report.csv`);
    res.send(csv);
  }
}
