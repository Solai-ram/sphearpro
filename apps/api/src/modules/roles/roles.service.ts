import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class RolesService {
  constructor(@Inject('PRISMA_CLIENT') private prisma: any) {}

  async findById(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { rolePermissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async findByName(name: string) {
    return this.prisma.role.findUnique({
      where: { name },
      include: { rolePermissions: { include: { permission: true } } },
    });
  }

  async findAll(params: { page?: number; limit?: number; search?: string }) {
    const { page = 1, limit = 50, search } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.RoleWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: { rolePermissions: { include: { permission: true } } },
      }),
      this.prisma.role.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(data: {
    name: string;
    description?: string;
    permissionIds?: string[];
    isSystem?: boolean;
  }) {
    const existing = await this.prisma.role.findUnique({ where: { name: data.name } });
    if (existing) throw new ConflictException('Role name already exists');

    return this.prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
        // Clients cannot create system roles
        isSystem: false,
        rolePermissions: data.permissionIds?.length
          ? { create: data.permissionIds.map(permissionId => ({ permissionId })) }
          : undefined,
      },
      include: { rolePermissions: { include: { permission: true } } },
    });
  }

  async update(id: string, data: {
    name?: string;
    description?: string;
    permissionIds?: string[];
    isSystem?: boolean;
  }) {
    const role = await this.findById(id);
    if (role.isSystem) {
      throw new ConflictException('Cannot modify system roles');
    }

    if (data.name && data.name !== role.name) {
      const existing = await this.prisma.role.findUnique({ where: { name: data.name } });
      if (existing) throw new ConflictException('Role name already exists');
    }

    // Update permissions if provided
    if (data.permissionIds !== undefined) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      await this.prisma.rolePermission.createMany({
        data: data.permissionIds.map(permissionId => ({ roleId: id, permissionId })),
        skipDuplicates: true,
      });
    }

    return this.prisma.role.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        // Ignore client isSystem
      },
      include: { rolePermissions: { include: { permission: true } } },
    });
  }

  async delete(id: string) {
    const role = await this.findById(id);
    if (role.isSystem) {
      throw new ConflictException('Cannot delete system roles');
    }
    await this.prisma.role.delete({ where: { id } });
  }

  async assignPermissions(roleId: string, permissionIds: string[]) {
    await this.findById(roleId);
    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    await this.prisma.rolePermission.createMany({
      data: permissionIds.map(permissionId => ({ roleId, permissionId })),
      skipDuplicates: true,
    });
    return this.findById(roleId);
  }

  async removePermission(roleId: string, permissionId: string) {
    await this.prisma.rolePermission.deleteMany({ where: { roleId, permissionId } });
    return this.findById(roleId);
  }
}