import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class StaffService {
  constructor(
    @Inject('PRISMA_CLIENT') private prisma: any,
    private auditService: AuditService,
  ) {}

  async findById(id: string, clinicId: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id, clinicId },
      include: {
        schedules: true,
        appointments: {
          take: 5,
          orderBy: { appointmentAt: 'desc' },
        },
        therapyCases: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!staff) throw new NotFoundException('Staff profile not found');
    return staff;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    staffType?: string;
    isProvider?: boolean;
    clinicId: string;
  }) {
    const { page = 1, limit = 20, search, staffType, isProvider, clinicId } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.StaffProfileWhereInput = { clinicId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { specialization: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (staffType) where.staffType = staffType as any;
    if (isProvider !== undefined) where.isProvider = isProvider;

    const [data, total] = await Promise.all([
      this.prisma.staffProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          schedules: true,
        },
      }),
      this.prisma.staffProfile.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(data: {
    userId?: string;
    name: string;
    staffType: string;
    specialization?: string;
    department?: string;
    phone?: string;
    email?: string;
    isProvider?: boolean;
    clinicId: string;
  }) {
    if (data.userId) {
      const existing = await this.prisma.staffProfile.findUnique({ where: { userId: data.userId } });
      if (existing) throw new ConflictException('Staff profile already exists for this user');
    }

    if (data.email) {
      const existingEmail = await this.prisma.staffProfile.findFirst({
        where: { clinicId: data.clinicId, email: data.email },
      });
      if (existingEmail) throw new ConflictException('Email already registered');
    }

    const staff = await this.prisma.staffProfile.create({
      data: {
        clinicId: data.clinicId,
        userId: data.userId,
        name: data.name,
        staffType: data.staffType as any,
        specialization: data.specialization,
        department: data.department,
        phone: data.phone,
        email: data.email,
        isProvider: data.isProvider ?? false,
      },
      include: { schedules: true },
    });

    await this.auditService.log({
      clinicId: data.clinicId,
      actorId: data.userId,
      action: 'STAFF_CREATED',
      entityType: 'StaffProfile',
      entityId: staff.id,
      result: 'SUCCESS',
      metadata: { name: staff.name, staffType: staff.staffType, isProvider: staff.isProvider },
    });

    return staff;
  }

  async update(id: string, clinicId: string, data: {
    name?: string;
    staffType?: string;
    specialization?: string;
    department?: string;
    phone?: string;
    email?: string;
    isProvider?: boolean;
  }) {
    const staff = await this.findById(id, clinicId);

    if (data.email && data.email !== staff.email) {
      const existing = await this.prisma.staffProfile.findFirst({
        where: { clinicId, email: data.email, NOT: { id } },
      });
      if (existing) throw new ConflictException('Email already registered');
    }

    const updated = await this.prisma.staffProfile.update({
      where: { id },
      data: {
        name: data.name,
        staffType: data.staffType as any,
        specialization: data.specialization,
        department: data.department,
        phone: data.phone,
        email: data.email,
        isProvider: data.isProvider,
      },
      include: { schedules: true },
    });

    await this.auditService.log({
      clinicId,
      actorId: undefined,
      action: 'STAFF_UPDATED',
      entityType: 'StaffProfile',
      entityId: id,
      result: 'SUCCESS',
      metadata: { changedFields: Object.keys(data), name: updated.name },
    });

    return updated;
  }

  async getSchedule(staffId: string, clinicId: string) {
    await this.findById(staffId, clinicId);

    return this.prisma.providerSchedule.findMany({
      where: { staffId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async setSchedule(staffId: string, clinicId: string, schedules: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isAvailable?: boolean;
  }[]) {
    await this.findById(staffId, clinicId);

    await this.prisma.providerSchedule.deleteMany({ where: { staffId } });

    await this.prisma.providerSchedule.createMany({
      data: schedules.map(s => ({
        staffId,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        isAvailable: s.isAvailable ?? true,
      })),
    });

    await this.auditService.log({
      clinicId,
      actorId: undefined,
      action: 'STAFF_SCHEDULE_UPDATED',
      entityType: 'StaffProfile',
      entityId: staffId,
      result: 'SUCCESS',
      metadata: { scheduleCount: schedules.length },
    });

    return this.prisma.providerSchedule.findMany({
      where: { staffId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async delete(id: string, clinicId: string) {
    const staff = await this.findById(id, clinicId);

    const appointmentCount = await this.prisma.appointment.count({
      where: { providerId: id, clinicId },
    });
    const therapyCaseCount = await this.prisma.therapyCase.count({
      where: { therapistId: id, clinicId },
    });

    if (appointmentCount > 0 || therapyCaseCount > 0) {
      throw new ConflictException('Cannot delete staff with active appointments or therapy cases');
    }

    await this.prisma.staffProfile.delete({ where: { id } });

    await this.auditService.log({
      clinicId,
      actorId: undefined,
      action: 'STAFF_DELETED',
      entityType: 'StaffProfile',
      entityId: id,
      result: 'SUCCESS',
      metadata: { name: staff.name },
    });

    return { message: 'Staff profile deleted successfully' };
  }
}
