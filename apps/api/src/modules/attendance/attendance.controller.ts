import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StaffAttendanceStatus } from '@prisma/client';
import type { Response } from 'express';
import { AttendanceService } from './attendance.service';
import { Authenticated } from '../../common/decorators/auth.decorator';
import { RequireFeature } from '../../common/decorators/subscription.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { requireClinicId } from '../../common/tenant/clinic-context';

@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
@RequireFeature('STAFF_ATTENDANCE')
export class AttendanceController {
  constructor(private attendance: AttendanceService) {}

  @Get('settings')
  @Authenticated('attendance.manage_settings')
  @ApiOperation({ summary: 'Get clinic attendance settings' })
  getSettings(@CurrentUser() user: { clinicId?: string }) {
    return this.attendance.getSettings(requireClinicId(user));
  }

  @Patch('settings')
  @Authenticated('attendance.manage_settings')
  @ApiOperation({ summary: 'Update clinic attendance settings' })
  updateSettings(
    @Body()
    body: {
      enabled?: boolean;
      gpsEnabled?: boolean;
      deviceBindingEnabled?: boolean;
      biometricEnabled?: boolean;
      latitude?: number;
      longitude?: number;
      radiusMeters?: number;
      maxAccuracyMeters?: number;
      timezone?: string;
      weekOffDays?: number[];
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.attendance.updateSettings(requireClinicId(user), user.sub!, body);
  }

  @Get('today')
  @Authenticated('attendance.view_own')
  today(@CurrentUser() user: { sub?: string; clinicId?: string }) {
    return this.attendance.getToday(requireClinicId(user), user.sub!);
  }

  @Post('challenge')
  @Authenticated('attendance.check_in')
  createChallenge(@CurrentUser() user: { sub?: string; clinicId?: string }) {
    return this.attendance.createChallenge(requireClinicId(user), user.sub!);
  }

  @Post('webauthn/registration-options')
  @Authenticated('attendance.check_in')
  webauthnRegistrationOptions(
    @CurrentUser() user: { sub?: string; clinicId?: string; name?: string; email?: string },
  ) {
    return this.attendance.webauthnRegistrationOptions(
      requireClinicId(user),
      user.sub!,
      user.name || user.email || user.sub!,
    );
  }

  @Post('webauthn/authentication-options')
  @Authenticated('attendance.check_in')
  webauthnAuthenticationOptions(
    @Body() body: { deviceKey?: string },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    if (!body?.deviceKey) throw new BadRequestException('deviceKey is required');
    return this.attendance.webauthnAuthenticationOptions(
      requireClinicId(user),
      user.sub!,
      body.deviceKey,
    );
  }

  @Post('check-in')
  @Authenticated('attendance.check_in')
  checkIn(
    @Body()
    body: {
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      deviceKey?: string;
      challengeId?: string;
      biometricVerified?: boolean;
      webauthnCredentialId?: string;
      authenticationResponse?: Record<string, unknown>;
      employeeId?: string;
      clinicId?: string;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    // Ignore any client-supplied employeeId / clinicId / timestamps
    const { employeeId: _e, clinicId: _c, ...rest } = body || {};
    return this.attendance.checkIn(requireClinicId(user), user.sub!, rest as any);
  }

  @Post('check-out')
  @Authenticated('attendance.check_out')
  checkOut(
    @Body()
    body: {
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      deviceKey?: string;
      challengeId?: string;
      biometricVerified?: boolean;
      webauthnCredentialId?: string;
      authenticationResponse?: Record<string, unknown>;
      employeeId?: string;
      clinicId?: string;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    const { employeeId: _e, clinicId: _c, ...rest } = body || {};
    return this.attendance.checkOut(requireClinicId(user), user.sub!, rest as any);
  }

  @Get('me/history')
  @Authenticated('attendance.view_own')
  myHistory(
    @CurrentUser() user: { sub?: string; clinicId?: string },
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.attendance.myHistory(requireClinicId(user), user.sub!, {
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
    });
  }

  @Get('me/device')
  @Authenticated('attendance.view_own')
  myDevice(@CurrentUser() user: { sub?: string; clinicId?: string }) {
    return this.attendance.myDeviceStatus(requireClinicId(user), user.sub!);
  }

  @Get('dashboard')
  @Authenticated('attendance.view_all')
  dashboard(
    @CurrentUser() user: { clinicId?: string },
    @Query('date') date?: string,
  ) {
    return this.attendance.dashboard(requireClinicId(user), date);
  }

  @Get()
  @Authenticated('attendance.view_all')
  list(
    @CurrentUser() user: { clinicId?: string },
    @Query('date') date?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.attendance.listForClinic(requireClinicId(user), {
      date,
      search,
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Post('manual')
  @Authenticated('attendance.correct')
  manual(
    @Body()
    body: {
      userId: string;
      date: string;
      status: StaffAttendanceStatus;
      checkIn?: string;
      checkOut?: string;
      remarks?: string;
      clinicId?: string;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    if (!body?.userId || !body?.date || !body?.status) {
      throw new BadRequestException('userId, date, and status are required');
    }
    const { clinicId: _ignored, ...rest } = body;
    return this.attendance.manualUpsert(requireClinicId(user), user.sub!, rest);
  }

  @Get('reports/monthly')
  @Authenticated('attendance.reports')
  monthly(
    @CurrentUser() user: { clinicId?: string },
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const now = new Date();
    return this.attendance.monthlyReport(
      requireClinicId(user),
      year ? Number(year) : now.getFullYear(),
      month ? Number(month) : now.getMonth() + 1,
    );
  }

  @Get('reports/monthly.csv')
  @Authenticated('attendance.reports')
  @ApiOperation({ summary: 'Export monthly attendance report as CSV' })
  async monthlyCsv(
    @CurrentUser() user: { clinicId?: string },
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Res() res?: Response,
  ) {
    const now = new Date();
    const y = year ? Number(year) : now.getFullYear();
    const m = month ? Number(month) : now.getMonth() + 1;
    const csv = await this.attendance.monthlyReportCsv(requireClinicId(user), y, m);
    res!.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res!.setHeader('Content-Disposition', `attachment; filename=attendance-${y}-${String(m).padStart(2, '0')}.csv`);
    res!.send(csv);
  }

  @Post('devices/register')
  @Authenticated('attendance.check_in')
  registerDevice(
    @Body()
    body: {
      deviceKey: string;
      platform?: string;
      deviceName?: string;
      challengeId?: string;
      registrationResponse?: Record<string, unknown>;
      webauthnCredentialId?: string;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.attendance.registerDevice(requireClinicId(user), user.sub!, body as any);
  }

  @Get('devices')
  @Authenticated('attendance.manage_devices')
  listDevices(
    @CurrentUser() user: { clinicId?: string },
    @Query('userId') userId?: string,
  ) {
    return this.attendance.listDevices(requireClinicId(user), userId);
  }

  @Delete('devices/:id')
  @Authenticated('attendance.manage_devices')
  revokeDevice(
    @Param('id') id: string,
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.attendance.revokeDevice(requireClinicId(user), user.sub!, id);
  }

  @Get('shifts')
  @Authenticated('attendance.manage_settings')
  listShifts(@CurrentUser() user: { clinicId?: string }) {
    return this.attendance.listShifts(requireClinicId(user));
  }

  @Get('shifts/assignments')
  @Authenticated('attendance.manage_settings')
  listShiftAssignments(@CurrentUser() user: { clinicId?: string }) {
    return this.attendance.listShiftAssignments(requireClinicId(user));
  }

  @Post('shifts')
  @Authenticated('attendance.manage_settings')
  createShift(
    @Body() body: { name: string; startTime: string; endTime: string; graceMinutes?: number },
    @CurrentUser() user: { clinicId?: string },
  ) {
    if (!body?.name || !body?.startTime || !body?.endTime) {
      throw new BadRequestException('name, startTime, and endTime are required');
    }
    return this.attendance.createShift(requireClinicId(user), body);
  }

  @Post('shifts/assign')
  @Authenticated('attendance.manage_settings')
  assignShift(
    @Body() body: { userId: string; shiftId: string },
    @CurrentUser() user: { clinicId?: string },
  ) {
    if (!body?.userId || !body?.shiftId) {
      throw new BadRequestException('userId and shiftId are required');
    }
    return this.attendance.assignShift(requireClinicId(user), body.userId, body.shiftId);
  }

  @Get('holidays')
  @Authenticated('attendance.manage_settings')
  listHolidays(
    @CurrentUser() user: { clinicId?: string },
    @Query('year') year?: string,
  ) {
    return this.attendance.listHolidays(requireClinicId(user), year ? Number(year) : undefined);
  }

  @Post('holidays')
  @Authenticated('attendance.manage_settings')
  createHoliday(
    @Body() body: { date: string; name: string },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.attendance.createHoliday(requireClinicId(user), user.sub!, body);
  }

  @Delete('holidays/:id')
  @Authenticated('attendance.manage_settings')
  deleteHoliday(
    @Param('id') id: string,
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.attendance.deleteHoliday(requireClinicId(user), user.sub!, id);
  }

  @Post('leave')
  @Authenticated('attendance.request_leave')
  requestLeave(
    @Body() body: { startDate: string; endDate: string; reason?: string },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.attendance.requestLeave(requireClinicId(user), user.sub!, body);
  }

  @Get('leave/me')
  @Authenticated('attendance.request_leave')
  myLeave(@CurrentUser() user: { sub?: string; clinicId?: string }) {
    return this.attendance.myLeaveRequests(requireClinicId(user), user.sub!);
  }

  @Get('leave')
  @Authenticated('attendance.approve_leave')
  listLeave(
    @CurrentUser() user: { clinicId?: string },
    @Query('status') status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED',
  ) {
    return this.attendance.listLeaveRequests(requireClinicId(user), status as any);
  }

  @Post('leave/:id/review')
  @Authenticated('attendance.approve_leave')
  reviewLeave(
    @Param('id') id: string,
    @Body() body: { decision: 'APPROVED' | 'REJECTED'; reviewNote?: string },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    if (!body?.decision || !['APPROVED', 'REJECTED'].includes(body.decision)) {
      throw new BadRequestException('decision must be APPROVED or REJECTED');
    }
    return this.attendance.reviewLeave(
      requireClinicId(user),
      user.sub!,
      id,
      body.decision,
      body.reviewNote,
    );
  }

  @Post('leave/:id/cancel')
  @Authenticated('attendance.request_leave')
  cancelLeave(
    @Param('id') id: string,
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.attendance.cancelMyLeave(requireClinicId(user), user.sub!, id);
  }
}
