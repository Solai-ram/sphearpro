import { Controller, Get, Post, Patch, Param, Body, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LabService, type LabSampleType } from './lab.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Authenticated } from '../../common/decorators/auth.decorator';
import { requireClinicId } from '../../common/tenant/clinic-context';

@ApiTags('Lab')
@ApiBearerAuth()
@Controller('lab')
export class LabController {
  constructor(private labService: LabService) {}

  @Get('dashboard')
  @Authenticated('lab.view')
  @ApiOperation({ summary: 'Lab dashboard metrics' })
  dashboard(@CurrentUser() user: { clinicId?: string }) {
    return this.labService.dashboard(requireClinicId(user));
  }

  @Get('departments')
  @Authenticated('lab.view')
  @ApiOperation({ summary: 'List lab departments' })
  departments() {
    return this.labService.departments();
  }

  @Get('sample-types')
  @Authenticated('lab.view')
  @ApiOperation({ summary: 'List sample types' })
  sampleTypes() {
    return this.labService.sampleTypes();
  }

  @Get('procedures')
  @Authenticated('lab.view')
  @ApiOperation({ summary: 'List lab procedures' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'department', required: false, type: String })
  @ApiQuery({ name: 'activeOnly', required: false })
  findAll(
    @CurrentUser() user: { clinicId?: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('department') department?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.labService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      search,
      department,
      activeOnly: activeOnly === 'true',
      clinicId: requireClinicId(user),
    });
  }

  @Post('procedures')
  @Authenticated('lab.procedure.create')
  @ApiOperation({ summary: 'Create a lab procedure' })
  create(
    @Body()
    body: {
      code: string;
      name: string;
      department: string;
      sampleType?: LabSampleType;
      price: number;
      tatHours?: number;
      instructions?: string;
      isActive?: boolean;
      clinicId?: string;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    if (!body?.code || !body?.name || !body?.department) {
      throw new BadRequestException('code, name, and department are required');
    }
    const { clinicId: _ignored, ...rest } = body;
    return this.labService.create({ ...rest, createdBy: user.sub, clinicId: requireClinicId(user) });
  }

  @Get('procedures/:id')
  @Authenticated('lab.view')
  @ApiOperation({ summary: 'Get a lab procedure' })
  findById(@Param('id') id: string, @CurrentUser() user: { clinicId?: string }) {
    return this.labService.findById(id, requireClinicId(user));
  }

  @Patch('procedures/:id')
  @Authenticated('lab.procedure.edit')
  @ApiOperation({ summary: 'Update a lab procedure' })
  update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      department?: string;
      sampleType?: LabSampleType;
      price?: number;
      tatHours?: number;
      instructions?: string;
      isActive?: boolean;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.labService.update(id, requireClinicId(user), { ...body, updatedBy: user.sub });
  }
}
