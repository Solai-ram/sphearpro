import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserStatus, StaffType } from '@prisma/client';
import { UsersService } from './users.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Authenticated } from '../../common/decorators/auth.decorator';
import { requireClinicId } from '../../common/tenant/clinic-context';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Authenticated('users.view')
  @ApiOperation({ summary: 'List all users' })
  async findAll(
    @CurrentUser() user: { clinicId?: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.usersService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      status,
      clinicId: requireClinicId(user),
    });
  }

  @Get('me')
  @Authenticated()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser('sub') userId: string) {
    return this.usersService.findById(userId);
  }

  @Get(':id')
  @Authenticated('users.view')
  @ApiOperation({ summary: 'Get user by ID' })
  async findById(@Param('id') id: string, @CurrentUser() user: { clinicId?: string }) {
    return this.usersService.findByIdInClinic(id, requireClinicId(user));
  }

  @Post()
  @Authenticated('users.create')
  @ApiOperation({ summary: 'Create new user' })
  async create(
    @CurrentUser() user: { clinicId?: string },
    @Body() body: {
      email: string;
      password: string;
      name: string;
      username?: string;
      mobile?: string;
      staffType?: string;
      roleIds?: string[];
      clinicId?: string; // ignored if present
    },
  ) {
    const { clinicId: _ignored, ...rest } = body;
    return this.usersService.create({ ...rest, clinicId: requireClinicId(user) });
  }

  @Patch(':id')
  @Authenticated('users.edit')
  @ApiOperation({ summary: 'Update user' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: { clinicId?: string },
    @Body() body: {
      name?: string;
      mobile?: string;
      email?: string;
      username?: string;
      staffType?: StaffType;
      status?: UserStatus;
    },
  ) {
    return this.usersService.update(id, body, requireClinicId(user));
  }

  @Delete(':id')
  @Authenticated('users.disable')
  @ApiOperation({ summary: 'Disable user (soft delete)' })
  async disable(@Param('id') id: string) {
    await this.usersService.disable(id);
    return { message: 'User disabled' };
  }

  @Post(':id/roles')
  @Authenticated('users.edit')
  @ApiOperation({ summary: 'Assign roles to user' })
  async assignRoles(
    @Param('id') id: string,
    @Body() body: { roleIds: string[] },
    @CurrentUser('sub') actorId: string,
  ) {
    return this.usersService.assignRoles(id, body.roleIds, actorId);
  }

  @Delete(':id/roles/:roleId')
  @Authenticated('users.edit')
  @ApiOperation({ summary: 'Remove role from user' })
  async removeRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @CurrentUser('sub') actorId: string,
  ) {
    await this.usersService.removeRole(id, roleId, actorId);
    return { message: 'Role removed' };
  }

  @Post(':id/permissions')
  @Authenticated('users.edit')
  @ApiOperation({ summary: 'Set explicit permission for user' })
  async setPermission(
    @Param('id') id: string,
    @Body() body: { permissionId: string; granted: boolean },
    @CurrentUser('sub') actorId: string,
  ) {
    return this.usersService.setPermission(id, body.permissionId, body.granted, actorId);
  }

  @Delete(':id/permissions/:permissionId')
  @Authenticated('users.edit')
  @ApiOperation({ summary: 'Remove explicit permission from user' })
  async removePermission(
    @Param('id') id: string,
    @Param('permissionId') permissionId: string,
    @CurrentUser('sub') actorId: string,
  ) {
    await this.usersService.removePermission(id, permissionId, actorId);
    return { message: 'Permission removed' };
  }
}
