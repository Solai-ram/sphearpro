import { Controller, Get, Post, Patch, Param, Body, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ServiceMasterCategory } from '@prisma/client';
import { ServicesService } from './services.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Authenticated } from '../../common/decorators/auth.decorator';
import { requireClinicId } from '../../common/tenant/clinic-context';

@ApiTags('Services')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  constructor(private servicesService: ServicesService) {}

  @Get('categories')
  @Authenticated('patients.view')
  @ApiOperation({ summary: 'List service master categories' })
  categories() {
    return this.servicesService.categories();
  }

  @Get()
  @Authenticated('patients.view')
  @ApiOperation({ summary: 'List clinic service masters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'activeOnly', required: false })
  findAll(
    @CurrentUser() user: { clinicId?: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('category') category?: ServiceMasterCategory,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.servicesService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 100,
      search,
      category,
      activeOnly: activeOnly === 'true',
      clinicId: requireClinicId(user),
    });
  }

  @Post()
  @Authenticated('patients.create')
  @ApiOperation({ summary: 'Create a service master' })
  create(
    @Body()
    body: {
      code?: string;
      name: string;
      category?: ServiceMasterCategory;
      price: number;
      description?: string;
      isActive?: boolean;
      clinicId?: string;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    if (!body?.name) {
      throw new BadRequestException('name is required');
    }
    if (body.price == null) {
      throw new BadRequestException('price is required');
    }
    const { clinicId: _ignored, ...rest } = body;
    return this.servicesService.create({
      ...rest,
      createdBy: user.sub,
      clinicId: requireClinicId(user),
    });
  }

  @Get(':id')
  @Authenticated('patients.view')
  @ApiOperation({ summary: 'Get a service master' })
  findById(@Param('id') id: string, @CurrentUser() user: { clinicId?: string }) {
    return this.servicesService.findById(id, requireClinicId(user));
  }

  @Patch(':id')
  @Authenticated('patients.create')
  @ApiOperation({ summary: 'Update a service master' })
  update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      category?: ServiceMasterCategory;
      price?: number;
      description?: string;
      isActive?: boolean;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.servicesService.update(id, requireClinicId(user), {
      ...body,
      updatedBy: user.sub,
    });
  }
}
