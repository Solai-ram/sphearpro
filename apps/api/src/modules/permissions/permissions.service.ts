import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PermissionsService {
  constructor(@Inject('PRISMA_CLIENT') private prisma: PrismaClient) {}

  async findById(id: string) {
    const permission = await this.prisma.permission.findUnique({ where: { id } });
    if (!permission) throw new NotFoundException('Permission not found');
    return permission;
  }

  async findByName(name: string) {
    return this.prisma.permission.findUnique({ where: { name } });
  }

  async findAll(params: { page?: number; limit?: number; search?: string; module?: string }) {
    const { page = 1, limit = 100, search, module } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.PermissionWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (module) {
      where.module = module;
    }

    const [data, total] = await (async () => {
      const [d, t] = await Promise.all([
        this.prisma.permission.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ module: 'asc' }, { name: 'asc' }],
        }),
        this.prisma.permission.count({ where }),
      ]);
      return [d, t] as const;
    })();

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getModules() {
    const permissions = await this.prisma.permission.findMany({
      select: { module: true },
      distinct: ['module'],
    });
    return permissions.map((p: { module: string }) => p.module);
  }

  async create(data: {
    name: string;
    description?: string;
    module: string;
    action: string;
  }) {
    const existing = await this.prisma.permission.findUnique({ where: { name: data.name } });
    if (existing) throw new ConflictException('Permission name already exists');

    return this.prisma.permission.create({ data });
  }

  async update(id: string, data: {
    name?: string;
    description?: string;
    module?: string;
    action?: string;
  }) {
    const permission = await this.findById(id);
    if (data.name && data.name !== permission.name) {
      const existing = await this.prisma.permission.findUnique({ where: { name: data.name } });
      if (existing) throw new ConflictException('Permission name already exists');
    }

    return this.prisma.permission.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    await this.findById(id);
    // Check if permission is used by any role or user
    const [roleCount, userCount] = await Promise.all([
      this.prisma.rolePermission.count({ where: { permissionId: id } }),
      this.prisma.userPermission.count({ where: { permissionId: id } }),
    ]);
    if (roleCount > 0 || userCount > 0) {
      throw new ConflictException('Permission is assigned to roles or users');
    }
    await this.prisma.permission.delete({ where: { id } });
  }
}
