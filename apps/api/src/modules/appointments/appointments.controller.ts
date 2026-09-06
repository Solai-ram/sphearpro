import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { Authenticated } from '../../common/decorators/auth.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { requireClinicId } from '../../common/tenant/clinic-context';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private appointmentsService: AppointmentsService) {}

  @Get('slots')
  @Authenticated('therapy.session.view')
  @ApiOperation({ summary: 'List clinic appointment slot templates' })
  @ApiQuery({ name: 'activeOnly', required: false })
  async listSlots(
    @CurrentUser() user: { clinicId?: string },
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.appointmentsService.listSlotTemplates(requireClinicId(user), activeOnly === 'true');
  }

  @Post('slots')
  @Authenticated('therapy.session.create')
  @ApiOperation({ summary: 'Create a clinic slot template' })
  async createSlot(
    @Body() body: { label?: string; startTime: string; endTime: string; sortOrder?: number; isActive?: boolean; clinicId?: string },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    const { clinicId: _ignored, ...rest } = body;
    return this.appointmentsService.createSlotTemplate({
      ...rest,
      createdBy: user.sub,
      clinicId: requireClinicId(user),
    });
  }

  @Patch('slots/:id')
  @Authenticated('therapy.session.create')
  @ApiOperation({ summary: 'Update a clinic slot template' })
  async updateSlot(
    @Param('id') id: string,
    @Body() body: { label?: string; startTime?: string; endTime?: string; sortOrder?: number; isActive?: boolean },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.appointmentsService.updateSlotTemplate(id, requireClinicId(user), { ...body, updatedBy: user.sub });
  }

  @Delete('slots/:id')
  @Authenticated('therapy.session.create')
  @ApiOperation({ summary: 'Delete a clinic slot template' })
  async deleteSlot(
    @Param('id') id: string,
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.appointmentsService.deleteSlotTemplate(id, requireClinicId(user), user.sub);
  }

  @Get('availability')
  @Authenticated('therapy.session.view')
  @ApiOperation({ summary: 'List available slots for a doctor on a date' })
  @ApiQuery({ name: 'doctorId', required: true })
  @ApiQuery({ name: 'date', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'excludeSessionId', required: false })
  async availability(
    @CurrentUser() user: { clinicId?: string },
    @Query('doctorId') doctorId: string,
    @Query('date') date: string,
    @Query('excludeSessionId') excludeSessionId?: string,
  ) {
    return this.appointmentsService.getDoctorAvailability(
      doctorId,
      date,
      requireClinicId(user),
      excludeSessionId,
    );
  }

  @Get('day-board')
  @Authenticated('therapy.session.view')
  @ApiOperation({ summary: 'Day scheduler board: doctors × slots × sessions' })
  @ApiQuery({ name: 'date', required: true })
  async dayBoard(@Query('date') date: string, @CurrentUser() user: { clinicId?: string }) {
    return this.appointmentsService.getDayBoard(date, requireClinicId(user));
  }
}
