import { Controller, Get, Patch, Body, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { Authenticated } from '../../common/decorators/auth.decorator';
import { requireClinicId } from '../../common/tenant/clinic-context';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('stats')
  @Authenticated('dashboard.view')
  @ApiOperation({ summary: 'Clinic operational metrics' })
  stats(
    @CurrentUser() user: { clinicId?: string },
    @Query('period') period?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getMetrics(requireClinicId(user), period, startDate, endDate);
  }

  @Get('metrics')
  @Authenticated('dashboard.view')
  metrics(
    @CurrentUser() user: { clinicId?: string },
    @Query('period') period?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getMetrics(requireClinicId(user), period, startDate, endDate);
  }

  @Get('today')
  @Authenticated('dashboard.view')
  today(
    @CurrentUser() user: { clinicId?: string },
    @Query('period') period?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getTodaySchedule(requireClinicId(user), period, startDate, endDate);
  }

  @Get('charts')
  @Authenticated('dashboard.view')
  @ApiOperation({ summary: 'Dashboard chart series and breakdowns' })
  charts(
    @CurrentUser() user: { clinicId?: string },
    @Query('period') period?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getCharts(requireClinicId(user), period, startDate, endDate);
  }

  @Get('widgets')
  @Authenticated('dashboard.view')
  widgets() {
    return this.dashboardService.listWidgets();
  }

  @Get('layout')
  @Authenticated('dashboard.view')
  layout(@CurrentUser('sub') userId: string) {
    return this.dashboardService.getLayout(userId);
  }

  @Patch('layout')
  @Authenticated('dashboard.view')
  saveLayout(
    @CurrentUser('sub') userId: string,
    @Body() body: { widgets: Array<{ widgetId: string; positionX: number; positionY: number; width?: number; height?: number; isVisible?: boolean }> },
  ) {
    return this.dashboardService.saveLayout(userId, body.widgets || []);
  }
}
