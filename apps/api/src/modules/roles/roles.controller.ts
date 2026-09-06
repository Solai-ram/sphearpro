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
import { RolesService } from './roles.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Authenticated } from '../../common/decorators/auth.decorator';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get()
  @Authenticated('roles.view')
  @ApiOperation({ summary: 'List all roles' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.rolesService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      search,
    });
  }

  @Get(':id')
  @Authenticated('roles.view')
  @ApiOperation({ summary: 'Get role by ID' })
  async findById(@Param('id') id: string) {
    return this.rolesService.findById(id);
  }

  @Post()
  @Authenticated('roles.manage')
  @ApiOperation({ summary: 'Create new role' })
  async create(@Body() body: { name: string; description?: string; permissionIds?: string[]; isSystem?: boolean }) {
    return this.rolesService.create(body);
  }

  @Patch(':id')
  @Authenticated('roles.manage')
  @ApiOperation({ summary: 'Update role' })
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; permissionIds?: string[]; isSystem?: boolean },
  ) {
    return this.rolesService.update(id, body);
  }

  @Delete(':id')
  @Authenticated('roles.manage')
  @ApiOperation({ summary: 'Delete role' })
  async delete(@Param('id') id: string) {
    await this.rolesService.delete(id);
    return { message: 'Role deleted' };
  }

  @Post(':id/permissions')
  @Authenticated('roles.manage')
  @ApiOperation({ summary: 'Assign permissions to role' })
  async assignPermissions(@Param('id') id: string, @Body() body: { permissionIds: string[] }) {
    return this.rolesService.assignPermissions(id, body.permissionIds);
  }

  @Delete(':id/permissions/:permissionId')
  @Authenticated('roles.manage')
  @ApiOperation({ summary: 'Remove permission from role' })
  async removePermission(@Param('id') id: string, @Param('permissionId') permissionId: string) {
    return this.rolesService.removePermission(id, permissionId);
  }
}
