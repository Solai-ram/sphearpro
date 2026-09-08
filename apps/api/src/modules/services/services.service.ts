import { Injectable, Inject, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, ServiceMasterCategory } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

const CATEGORIES: ServiceMasterCategory[] = ['CONSULTATION', 'REVIEW', 'OTHER'];

function money(value: unknown) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function serialize(row: any) {
  if (!row) return row;
  return { ...row, price: money(row.price) };
}

@Injectable()
export class ServicesService {
  constructor(
    @Inject('PRISMA_CLIENT') private prisma: any,
    private auditService: AuditService,
  ) {}

  categories() {
    return [...CATEGORIES];
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: ServiceMasterCategory;
    activeOnly?: boolean;
    clinicId: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 100;
    const skip = (page - 1) * limit;
    const where: Prisma.ServiceMasterWhereInput = { clinicId: params.clinicId };
    if (params.category) where.category = params.category;
    if (params.activeOnly) where.isActive = true;
    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.serviceMaster.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.serviceMaster.count({ where }),
    ]);

    return {
      data: data.map(serialize),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string, clinicId: string) {
    const row = await this.prisma.serviceMaster.findFirst({ where: { id, clinicId } });
    if (!row) throw new NotFoundException('Service not found');
    return serialize(row);
  }

  async create(data: {
    code: string;
    name: string;
    category?: ServiceMasterCategory;
    price: number;
    description?: string;
    isActive?: boolean;
    createdBy?: string;
    clinicId: string;
  }) {
    const code = data.code?.trim().toUpperCase();
    const name = data.name?.trim();
    if (!code) throw new BadRequestException('code is required');
    if (!name) throw new BadRequestException('name is required');
    if (data.price == null || Number(data.price) < 0) {
      throw new BadRequestException('price must be 0 or greater');
    }
    const category = data.category || 'CONSULTATION';
    if (!CATEGORIES.includes(category)) {
      throw new BadRequestException('Invalid category');
    }

    const existing = await this.prisma.serviceMaster.findUnique({
      where: { clinicId_code: { clinicId: data.clinicId, code } },
    });
    if (existing) throw new ConflictException(`Service code ${code} already exists`);

    const row = await this.prisma.serviceMaster.create({
      data: {
        clinicId: data.clinicId,
        code,
        name,
        category,
        price: money(data.price),
        description: data.description?.trim() || null,
        isActive: data.isActive !== false,
        createdBy: data.createdBy,
      },
    });

    await this.auditService.log({
      clinicId: data.clinicId,
      actorId: data.createdBy,
      actorType: 'user',
      action: 'SERVICE_MASTER_CREATED',
      entityType: 'ServiceMaster',
      entityId: row.id,
      result: 'SUCCESS',
      metadata: { code, name, category, price: money(data.price) },
    });

    return serialize(row);
  }

  async update(
    id: string,
    clinicId: string,
    data: {
      name?: string;
      category?: ServiceMasterCategory;
      price?: number;
      description?: string;
      isActive?: boolean;
      updatedBy?: string;
    },
  ) {
    await this.findById(id, clinicId);
    if (data.category && !CATEGORIES.includes(data.category)) {
      throw new BadRequestException('Invalid category');
    }
    const row = await this.prisma.serviceMaster.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        category: data.category,
        price: data.price == null ? undefined : money(data.price),
        description: data.description === undefined ? undefined : data.description.trim() || null,
        isActive: data.isActive,
      },
    });

    await this.auditService.log({
      clinicId,
      actorId: data.updatedBy,
      actorType: 'user',
      action: 'SERVICE_MASTER_UPDATED',
      entityType: 'ServiceMaster',
      entityId: id,
      result: 'SUCCESS',
      metadata: { name: row.name },
    });

    return serialize(row);
  }
}
