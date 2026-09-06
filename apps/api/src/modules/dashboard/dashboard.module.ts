import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { ReportsController } from './reports.controller';
import { DashboardService } from './dashboard.service';
import { ReportsService } from './reports.service';

@Module({
  controllers: [DashboardController, ReportsController],
  providers: [DashboardService, ReportsService],
})
export class DashboardModule {}
