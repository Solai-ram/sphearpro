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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Authenticated } from '../../common/decorators/auth.decorator';

@ApiTags('Permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private permissionsService: PermissionsService) {}

  @Get()
  @Authenticated('permissions.view')
  @ApiOperation({ summary: 'List all permissions' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('module') module?: string,
  ) {
    return this.permissionsService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 200,
      search,
      module,
    });
  }

  @Get('modules')
  @Authenticated('permissions.view')
  @ApiOperation({ summary: 'Get all permission modules' })
  async getModules() {
    return this.permissionsService.getModules();
  }

  @Get(':id')
  @Authenticated('permissions.view')
  @ApiOperation({ summary: 'Get permission by ID' })
  async findById(@Param('id') id: string) {
    return this.permissionsService.findById(id);
  }

  @Post()
  @Authenticated('permissions.manage')
  @ApiOperation({ summary: 'Create new permission' })
  async create(@Body() body: { name: string; description?: string; module: string; action: string }) {
    return this.permissionsService.create(body);
  }

  @Patch(':id')
  @Authenticated('permissions.manage')
  @ApiOperation({ summary: 'Update permission' })
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; module?: string; action?: string },
  ) {
    return this.permissionsService.update(id, body);
  }

  @Delete(':id')
  @Authenticated('permissions.manage')
  @ApiOperation({ summary: 'Delete permission' })
  async delete(@Param('id') id: string) {
    await this.permissionsService.delete(id);
    return { message: 'Permission deleted' };
  }
}
