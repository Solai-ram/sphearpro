import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { StaffService } from './staff.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Authenticated } from '../../common/decorators/auth.decorator';
import { requireClinicId } from '../../common/tenant/clinic-context';

@ApiTags('Staff')
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  constructor(private staffService: StaffService) {}

  @Get()
  @Authenticated('staff.view')
  @ApiOperation({ summary: 'List all staff profiles' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'staffType', required: false, type: String })
  @ApiQuery({ name: 'isProvider', required: false, type: Boolean })
  async findAll(
    @CurrentUser() user: { clinicId?: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('staffType') staffType?: string,
    @Query('isProvider') isProvider?: string,
  ) {
    return this.staffService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      staffType,
      isProvider: isProvider === 'true' ? true : isProvider === 'false' ? false : undefined,
      clinicId: requireClinicId(user),
    });
  }

  @Get(':id')
  @Authenticated('staff.view')
  @ApiOperation({ summary: 'Get staff profile by ID' })
  async findById(@Param('id') id: string, @CurrentUser() user: { clinicId?: string }) {
    return this.staffService.findById(id, requireClinicId(user));
  }

  @Get(':id/schedule')
  @Authenticated('staff.view')
  @ApiOperation({ summary: 'Get provider schedule' })
  async getSchedule(@Param('id') id: string, @CurrentUser() user: { clinicId?: string }) {
    return this.staffService.getSchedule(id, requireClinicId(user));
  }

  @Post()
  @Authenticated('staff.create')
  @ApiOperation({ summary: 'Create staff profile' })
  async create(
    @Body() body: {
      userId?: string;
      name: string;
      staffType: string;
      specialization?: string;
      department?: string;
      phone?: string;
      email?: string;
      isProvider?: boolean;
      clinicId?: string;
    },
    @CurrentUser() user: { clinicId?: string },
  ) {
    const { clinicId: _ignored, ...rest } = body;
    return this.staffService.create({
      ...rest,
      clinicId: requireClinicId(user),
    });
  }

  @Patch(':id')
  @Authenticated('staff.edit')
  @ApiOperation({ summary: 'Update staff profile' })
  async update(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      staffType?: string;
      specialization?: string;
      department?: string;
      phone?: string;
      email?: string;
      isProvider?: boolean;
    },
    @CurrentUser() user: { clinicId?: string },
  ) {
    return this.staffService.update(id, requireClinicId(user), body);
  }

  @Patch(':id/schedule')
  @Authenticated('staff.edit')
  @ApiOperation({ summary: 'Update provider schedule' })
  async setSchedule(
    @Param('id') id: string,
    @Body() body: { schedules: { dayOfWeek: number; startTime: string; endTime: string; isAvailable?: boolean }[] },
    @CurrentUser() user: { clinicId?: string },
  ) {
    return this.staffService.setSchedule(id, requireClinicId(user), body.schedules);
  }

  @Delete(':id')
  @Authenticated('staff.delete')
  @ApiOperation({ summary: 'Delete staff profile' })
  async delete(@Param('id') id: string, @CurrentUser() user: { clinicId?: string }) {
    return this.staffService.delete(id, requireClinicId(user));
  }
}
