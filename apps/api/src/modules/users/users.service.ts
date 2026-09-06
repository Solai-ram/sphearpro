import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma, PrismaClient, UserStatus, StaffType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { SubscriptionService } from '../subscription/subscription.service';

const SENSITIVE_USER_FIELDS = [
  'passwordHash',
  'refreshTokenHash',
  'refreshTokenId',
  'resetTokenHash',
  'resetTokenId',
  'resetTokenExpiresAt',
  'supportPasswordEnc',
] as const;

@Injectable()
export class UsersService {
  constructor(
    @Inject('PRISMA_CLIENT') private prisma: PrismaClient,
    private auditService: AuditService,
    private subscriptionService: SubscriptionService,
  ) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } },
            },
          },
        },
        userPermissions: { include: { permission: true } },
      },
    });
    if (!user) return null;
    return this.sanitizeUser(user);
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } },
            },
          },
        },
        userPermissions: { include: { permission: true } },
      },
    });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      include: {
        roles: { include: { role: true } },
      },
    });
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    clinicId: string;
  }) {
    const { page = 1, limit = 20, search, status, clinicId } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = { clinicId, isSystemSupport: false };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search } },
      ];
    }

    if (status) {
      where.status = status as UserStatus;
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          roles: { include: { role: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data.map((u: any) => this.sanitizeUser(u)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(data: {
    email: string;
    password: string;
    name: string;
    username?: string;
    mobile?: string;
    staffType?: string;
    roleIds?: string[];
    clinicId: string;
  }) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already in use');

    await this.subscriptionService.assertClinicUserSeatAvailable(data.clinicId, {
      staffType: data.staffType,
      roleIds: data.roleIds,
    });

    const passwordHash = await argon2.hash(data.password);
    const roleIds = data.roleIds || [];

    const user = await this.prisma.user.create({
      data: {
        clinicId: data.clinicId,
        email: data.email,
        username: data.username,
        mobile: data.mobile,
        name: data.name,
        passwordHash,
        staffType: data.staffType as any,
        roles: roleIds.length
          ? { create: roleIds.map((roleId) => ({ roleId })) }
          : undefined,
      },
      include: { roles: { include: { role: true } } },
    });

    return this.sanitizeUser(user);
  }

  async findByIdInClinic(id: string, clinicId: string) {
    const user = await this.findById(id);
    if (!user || user.clinicId !== clinicId) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(
    id: string,
    data: {
      name?: string;
      mobile?: string;
      email?: string;
      username?: string;
      staffType?: StaffType;
      status?: UserStatus;
    },
    clinicId: string,
  ) {
    const user = await this.prisma.user.findFirst({ where: { id, clinicId } });
    if (!user) throw new NotFoundException('User not found');

    if (data.email && data.email !== user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
      if (existing) throw new ConflictException('Email already in use');
    }
    if (data.username && data.username !== user.username) {
      const existing = await this.prisma.user.findUnique({ where: { username: data.username } });
      if (existing) throw new ConflictException('Username already in use');
    }

    const wasAdmin =
      user.staffType === 'ADMIN' ||
      (await this.prisma.userRole.findFirst({
        where: { userId: id, role: { name: 'ADMIN' } },
      }));
    if (
      data.staffType === 'ADMIN' &&
      user.staffType !== 'ADMIN' &&
      !wasAdmin &&
      user.clinicId
    ) {
      await this.subscriptionService.assertClinicUserSeatAvailable(user.clinicId, {
        staffType: 'ADMIN',
      });
    }
    if (
      data.status === 'ACTIVE' &&
      user.status === 'INACTIVE' &&
      user.clinicId
    ) {
      await this.subscriptionService.assertClinicUserSeatAvailable(user.clinicId, {
        staffType: user.staffType ?? undefined,
        roleIds: (
          await this.prisma.userRole.findMany({
            where: { userId: id },
            select: { roleId: true },
          })
        ).map((r) => r.roleId),
      });
    }

    // Explicit allowlist — never spread request body into Prisma
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.mobile !== undefined ? { mobile: data.mobile } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.username !== undefined ? { username: data.username } : {}),
        ...(data.staffType !== undefined ? { staffType: data.staffType } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: { roles: { include: { role: true } } },
    });

    return this.sanitizeUser(updated);
  }

  async assignRoles(userId: string, roleIds: string[], actorId: string | undefined, clinicId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, clinicId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.clinicId && user.status !== 'INACTIVE') {
      const adminRole = await this.prisma.role.findUnique({ where: { name: 'ADMIN' } });
      const wasAdmin =
        user.staffType === 'ADMIN' ||
        (await this.prisma.userRole.findFirst({
          where: { userId, role: { name: 'ADMIN' } },
        }));
      const willBeAdmin =
        user.staffType === 'ADMIN' ||
        (adminRole ? roleIds.includes(adminRole.id) : false);
      if (!wasAdmin && willBeAdmin) {
        await this.subscriptionService.assertClinicUserSeatAvailable(user.clinicId, {
          staffType: user.staffType ?? undefined,
          roleIds,
        });
      }
    }

    const before = await this.prisma.userRole.findMany({
      where: { userId },
      select: { roleId: true },
    });

    await this.prisma.userRole.deleteMany({ where: { userId } });
    await this.prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({ userId, roleId })),
      skipDuplicates: true,
    });

    await this.auditService.log({
      action: 'PERMISSION_CHANGED',
      entityType: 'user',
      entityId: userId,
      result: 'SUCCESS',
      actorId,
      metadata: {
        change: 'assign_roles',
        before: before.map((b) => b.roleId),
        after: roleIds,
      },
    });

    return this.findById(userId);
  }

  async removeRole(userId: string, roleId: string, actorId: string | undefined, clinicId: string) {
    await this.findByIdInClinic(userId, clinicId);
    await this.prisma.userRole.deleteMany({ where: { userId, roleId } });
    await this.auditService.log({
      action: 'PERMISSION_CHANGED',
      entityType: 'user',
      entityId: userId,
      result: 'SUCCESS',
      actorId,
      metadata: { change: 'remove_role', roleId },
    });
  }

  async setPermission(
    userId: string,
    permissionId: string,
    granted: boolean,
    actorId: string | undefined,
    clinicId: string,
  ) {
    await this.findByIdInClinic(userId, clinicId);
    await this.prisma.userPermission.upsert({
      where: { userId_permissionId: { userId, permissionId } },
      update: { granted },
      create: { userId, permissionId, granted },
    });
    await this.auditService.log({
      action: 'PERMISSION_CHANGED',
      entityType: 'user',
      entityId: userId,
      result: 'SUCCESS',
      actorId,
      metadata: { change: 'set_permission', permissionId, granted },
    });
  }

  async removePermission(
    userId: string,
    permissionId: string,
    actorId: string | undefined,
    clinicId: string,
  ) {
    await this.findByIdInClinic(userId, clinicId);
    await this.prisma.userPermission.deleteMany({ where: { userId, permissionId } });
    await this.auditService.log({
      action: 'PERMISSION_CHANGED',
      entityType: 'user',
      entityId: userId,
      result: 'SUCCESS',
      actorId,
      metadata: { change: 'remove_permission', permissionId },
    });
  }

  async disable(id: string, clinicId: string) {
    return this.update(id, { status: 'INACTIVE' }, clinicId);
  }

  private sanitizeUser(user: any) {
    const sanitized = { ...user };
    for (const key of SENSITIVE_USER_FIELDS) {
      delete sanitized[key];
    }
    return sanitized;
  }
}
