import { Injectable, Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface AuditLogInput {
  actorId?: string;
  actorType?: string; // "user" | "system" | "ai"
  patientId?: string;
  clinicId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  result?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditService {
  constructor(@Inject('PRISMA_CLIENT') private prisma: any) {}

  async log(input: AuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        clinicId: input.clinicId,
        actorId: input.actorId,
        actorType: input.actorType || 'user',
        patientId: input.patientId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        result: input.result || 'SUCCESS',
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: input.metadata ?? null,
      },
    });
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    userId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    clinicId?: string;
  }) {
    const { page = 1, limit = 50, userId, action, entityType, entityId, startDate, endDate, clinicId } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};
    if (clinicId) where.clinicId = clinicId;

    if (userId) where.actorId = userId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: data.map((log: any) => ({
        ...log,
        metadata: this.parseJson(log.metadata),
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string, clinicId?: string) {
    const log = await this.prisma.auditLog.findFirst({
      where: clinicId ? { id, clinicId } : { id },
    });
    if (!log) return null;
    return {
      ...log,
      metadata: this.parseJson(log.metadata),
    };
  }

  async getStats(params: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    clinicId?: string;
  }) {
    const { startDate, endDate, userId, clinicId } = params;
    const where: Prisma.AuditLogWhereInput = {};
    if (clinicId) where.clinicId = clinicId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }
    if (userId) where.actorId = userId;

    const [total, byAction, byEntityType, byUser] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),
      this.prisma.auditLog.groupBy({
        by: ['entityType'],
        where,
        _count: { entityType: true },
        orderBy: { _count: { entityType: 'desc' } },
        take: 10,
      }),
      this.prisma.auditLog.groupBy({
        by: ['actorId'],
        where,
        _count: { actorId: true },
        orderBy: { _count: { actorId: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      total,
      topActions: byAction.map((a: any) => ({ action: a.action, count: a._count.action })),
      topEntities: byEntityType.map((e: any) => ({ entityType: e.entityType, count: e._count.entityType })),
      topUsers: byUser.map((u: any) => ({ userId: u.actorId, count: u._count.actorId })),
    };
  }

  private parseJson(value: unknown) {
    if (value == null) return null;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }
}
