import { Injectable, Inject, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { resolveRange } from '../dashboard/dashboard.service';

const DEPARTMENTS = [
  'Audiology',
  'Vestibular',
  'Hematology',
  'Biochemistry',
  'Microbiology',
  'Pathology',
] as const;

const SAMPLE_TYPES = ['NONE', 'BLOOD', 'SERUM', 'URINE', 'SWAB', 'SPUTUM', 'OTHER'] as const;

export type LabSampleType = (typeof SAMPLE_TYPES)[number];

function money(value: unknown) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function serialize(procedure: any) {
  if (!procedure) return procedure;
  return { ...procedure, price: money(procedure.price) };
}

@Injectable()
export class LabService {
  constructor(
    @Inject('PRISMA_CLIENT') private prisma: any,
    private auditService: AuditService,
  ) {}

  departments() {
    return [...DEPARTMENTS];
  }

  sampleTypes() {
    return [...SAMPLE_TYPES];
  }

  async dashboard(clinicId: string) {
    const today = resolveRange('daily');
    const month = resolveRange('monthly');
    const weekTo = today.to;
    const weekFrom = new Date(today.from);
    weekFrom.setDate(weekFrom.getDate() - 6);

    const labItemWhere = (from: Date, to: Date): Prisma.InvoiceItemWhereInput => ({
      billableType: 'LAB_TEST',
      invoice: {
        clinicId,
        issueDate: { gte: from, lte: to },
        status: { not: 'CANCELLED' },
      },
    });

    const sumExecuted = async (from: Date, to: Date) => {
      const result = await this.prisma.invoiceItem.aggregate({
        where: labItemWhere(from, to),
        _sum: { quantity: true, lineTotal: true },
        _count: { _all: true },
      });
      return {
        tests: Number(result._sum.quantity || 0),
        invoices: result._count._all,
        revenue: money(result._sum.lineTotal),
      };
    };

    const [total, active, byDepartment, recent, executedToday, executedWeek, executedMonth, recentBilled, monthItems] =
      await Promise.all([
        this.prisma.labProcedure.count({ where: { clinicId } }),
        this.prisma.labProcedure.count({ where: { clinicId, isActive: true } }),
        this.prisma.labProcedure.groupBy({
          by: ['department'],
          where: { clinicId },
          _count: { _all: true },
          orderBy: { department: 'asc' },
        }),
        this.prisma.labProcedure.findMany({
          where: { clinicId },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        sumExecuted(today.from, today.to),
        sumExecuted(weekFrom, weekTo),
        sumExecuted(month.from, month.to),
        this.prisma.invoiceItem.findMany({
          where: {
            billableType: 'LAB_TEST',
            invoice: { clinicId, status: { not: 'CANCELLED' } },
          },
          orderBy: { invoice: { issueDate: 'desc' } },
          take: 12,
          include: {
            invoice: {
              select: {
                invoiceNumber: true,
                issueDate: true,
                patient: { select: { name: true, patientNumber: true } },
              },
            },
          },
        }),
        this.prisma.invoiceItem.findMany({
          where: labItemWhere(month.from, month.to),
          select: { quantity: true, lineTotal: true, description: true, referenceId: true },
        }),
      ]);

    const procedureIds = [...new Set(monthItems.map((row: { referenceId?: string }) => row.referenceId).filter(Boolean))];
    const procedures = procedureIds.length
      ? await this.prisma.labProcedure.findMany({
          where: { clinicId, id: { in: procedureIds } },
          select: { id: true, name: true, department: true, code: true },
        })
      : [];
    const procedureMap = new Map<string, { id: string; name: string; department: string; code: string }>(
      procedures.map((p: { id: string; name: string; department: string; code: string }) => [p.id, p]),
    );

    const topMap = new Map<string, { name: string; department: string; tests: number; revenue: number }>();
    const deptExec = new Map<string, number>();
    for (const item of monthItems) {
      const proc = item.referenceId ? procedureMap.get(item.referenceId) : undefined;
      const name = proc?.name || item.description;
      const department = proc?.department || 'Unspecified';
      const current = topMap.get(name) || { name, department, tests: 0, revenue: 0 };
      current.tests += Number(item.quantity || 0);
      current.revenue = money(current.revenue + Number(item.lineTotal || 0));
      topMap.set(name, current);
      deptExec.set(department, (deptExec.get(department) || 0) + Number(item.quantity || 0));
    }

    return {
      total,
      active,
      inactive: total - active,
      byDepartment: byDepartment.map((row: { department: string; _count: { _all: number } }) => ({
        department: row.department,
        count: row._count._all,
      })),
      recent: recent.map(serialize),
      executed: {
        today: executedToday,
        week: executedWeek,
        month: executedMonth,
      },
      executedByDepartment: [...deptExec.entries()]
        .map(([department, tests]) => ({ department, tests }))
        .sort((a, b) => b.tests - a.tests),
      topProcedures: [...topMap.values()].sort((a, b) => b.tests - a.tests).slice(0, 8),
      recentBilled: recentBilled.map((item: any) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        lineTotal: money(item.lineTotal),
        invoiceNumber: item.invoice?.invoiceNumber,
        issueDate: item.invoice?.issueDate,
        patientName: item.invoice?.patient?.name,
        patientNumber: item.invoice?.patient?.patientNumber,
      })),
    };
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    department?: string;
    activeOnly?: boolean;
    clinicId: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;
    const where: Prisma.LabProcedureWhereInput = { clinicId: params.clinicId };
    if (params.department) where.department = params.department;
    if (params.activeOnly) where.isActive = true;
    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { department: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.labProcedure.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ department: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.labProcedure.count({ where }),
    ]);

    return {
      data: data.map(serialize),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string, clinicId: string) {
    const procedure = await this.prisma.labProcedure.findFirst({ where: { id, clinicId } });
    if (!procedure) throw new NotFoundException('Lab procedure not found');
    return serialize(procedure);
  }

  async create(data: {
    code: string;
    name: string;
    department: string;
    sampleType?: LabSampleType;
    price: number;
    tatHours?: number;
    instructions?: string;
    isActive?: boolean;
    createdBy?: string;
    clinicId: string;
  }) {
    const code = data.code?.trim().toUpperCase();
    const name = data.name?.trim();
    const department = data.department?.trim();
    if (!code) throw new BadRequestException('code is required');
    if (!name) throw new BadRequestException('name is required');
    if (!department) throw new BadRequestException('department is required');
    if (data.price == null || Number(data.price) < 0) {
      throw new BadRequestException('price must be 0 or greater');
    }
    const sampleType = data.sampleType || 'NONE';
    if (!SAMPLE_TYPES.includes(sampleType)) {
      throw new BadRequestException('Invalid sample type');
    }

    const existing = await this.prisma.labProcedure.findUnique({ where: { clinicId_code: { clinicId: data.clinicId, code } } });
    if (existing) throw new ConflictException(`Procedure code ${code} already exists`);

    const procedure = await this.prisma.labProcedure.create({
      data: {
        clinicId: data.clinicId,
        code,
        name,
        department,
        sampleType,
        price: money(data.price),
        tatHours: data.tatHours && data.tatHours > 0 ? Math.round(data.tatHours) : 24,
        instructions: data.instructions?.trim() || null,
        isActive: data.isActive !== false,
        createdBy: data.createdBy,
      },
    });

    await this.auditService.log({
      clinicId: data.clinicId,
      actorId: data.createdBy,
      actorType: 'user',
      action: 'LAB_PROCEDURE_CREATED',
      entityType: 'LabProcedure',
      entityId: procedure.id,
      result: 'SUCCESS',
      metadata: { code, name, department },
    });

    return serialize(procedure);
  }

  async update(
    id: string,
    clinicId: string,
    data: {
      name?: string;
      department?: string;
      sampleType?: LabSampleType;
      price?: number;
      tatHours?: number;
      instructions?: string;
      isActive?: boolean;
      updatedBy?: string;
    },
  ) {
    await this.findById(id, clinicId);
    if (data.sampleType && !SAMPLE_TYPES.includes(data.sampleType)) {
      throw new BadRequestException('Invalid sample type');
    }
    const procedure = await this.prisma.labProcedure.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        department: data.department?.trim(),
        sampleType: data.sampleType,
        price: data.price == null ? undefined : money(data.price),
        tatHours: data.tatHours == null ? undefined : Math.round(data.tatHours),
        instructions: data.instructions === undefined ? undefined : data.instructions.trim() || null,
        isActive: data.isActive,
      },
    });

    await this.auditService.log({
      clinicId,
      actorId: data.updatedBy,
      actorType: 'user',
      action: 'LAB_PROCEDURE_UPDATED',
      entityType: 'LabProcedure',
      entityId: id,
      result: 'SUCCESS',
      metadata: { name: procedure.name },
    });

    return serialize(procedure);
  }
}
