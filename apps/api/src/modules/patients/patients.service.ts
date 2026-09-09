import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import {
  formatDocumentNumber,
  loadPatientNumberConfig,
  nextDocumentNumber,
} from '../../common/numbering/document-number';

@Injectable()
export class PatientsService {
  constructor(
    @Inject('PRISMA_CLIENT') private prisma: any,
    private auditService: AuditService,
  ) {}

  async findById(id: string, clinicId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, clinicId, deletedAt: null },
      include: {
        appointments: { take: 5, orderBy: { appointmentAt: 'desc' } },
        opCases: { take: 5, orderBy: { createdAt: 'desc' } },
        therapyCases: { take: 5, orderBy: { createdAt: 'desc' } },
        invoices: { take: 5, orderBy: { issueDate: 'desc' } },
        documents: { take: 5, orderBy: { uploadedAt: 'desc' } },
        timelineEvents: { take: 10, orderBy: { occurredAt: 'desc' } },
      },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async findByPatientNumber(patientNumber: string, clinicId: string) {
    const raw = patientNumber.trim();
    const cfg = await loadPatientNumberConfig(this.prisma, clinicId);
    const candidates = new Set<string>([raw]);
    if (/^\d+$/.test(raw)) {
      candidates.add(formatDocumentNumber(cfg, parseInt(raw, 10)));
    }
    const patient = await this.prisma.patient.findFirst({
      where: {
        clinicId,
        deletedAt: null,
        OR: [...candidates].map((value) => ({
          patientNumber: { equals: value, mode: 'insensitive' },
        })),
      },
      include: {
        appointments: { take: 50, orderBy: { appointmentAt: 'desc' } },
        opCases: {
          take: 100,
          orderBy: { createdAt: 'desc' },
          include: { provider: { select: { id: true, name: true, staffType: true } } },
        },
        therapyCases: { take: 50, orderBy: { createdAt: 'desc' } },
        invoices: { take: 50, orderBy: { issueDate: 'desc' } },
        documents: { take: 50, orderBy: { uploadedAt: 'desc' } },
        timelineEvents: { take: 100, orderBy: { occurredAt: 'desc' } },
      },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    gender?: string;
    clinicId: string;
  }) {
    const { page = 1, limit = 20, search, gender, clinicId } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.PatientWhereInput = {
      clinicId,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { patientNumber: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (gender) {
      where.gender = gender as any;
    }

    const [data, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              appointments: true,
              opCases: true,
              therapyCases: true,
              invoices: true,
              documents: true,
            },
          },
        },
      }),
      this.prisma.patient.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(data: {
    name: string;
    dateOfBirth?: Date | string;
    gender?: string;
    phone?: string;
    alternatePhone?: string;
    email?: string;
    address?: Record<string, any>;
    emergencyContact?: Record<string, any>;
    createdBy?: string;
    clinicId: string;
  }) {
    if (data.phone) {
      const existing = await this.prisma.patient.findFirst({
        where: { clinicId: data.clinicId, phone: data.phone, deletedAt: null },
      });
      if (existing) throw new ConflictException('Phone number already registered');
    }
    if (data.email) {
      const existing = await this.prisma.patient.findFirst({
        where: { clinicId: data.clinicId, email: data.email, deletedAt: null },
      });
      if (existing) throw new ConflictException('Email already registered');
    }

    const patientNumber = await nextDocumentNumber(this.prisma, data.clinicId, 'patient', async (stem) => {
      const last = await this.prisma.patient.findFirst({
        where: { clinicId: data.clinicId, patientNumber: { startsWith: stem } },
        orderBy: { patientNumber: 'desc' },
        select: { patientNumber: true },
      });
      return last?.patientNumber;
    });

    const patient = await this.prisma.patient.create({
      data: {
        clinicId: data.clinicId,
        patientNumber,
        name: data.name,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        gender: data.gender as any,
        phone: data.phone,
        alternatePhone: data.alternatePhone,
        email: data.email,
        address: data.address,
        emergencyContact: data.emergencyContact,
        createdBy: data.createdBy,
      },
    });

    await this.auditService.log({
      actorId: data.createdBy,
      action: 'PATIENT_CREATED',
      entityType: 'Patient',
      entityId: patient.id,
      result: 'SUCCESS',
      metadata: { patientNumber: patient.patientNumber, name: patient.name, clinicId: data.clinicId },
    });

    await this.addTimelineEvent({
      patientId: patient.id,
      eventType: 'OTHER',
      referenceId: patient.id,
      title: 'Patient Registered',
      description: `Patient ${patient.name} was registered with number ${patient.patientNumber}.`,
      occurredAt: patient.createdAt,
      metadata: { patientNumber: patient.patientNumber },
    });

    return patient;
  }

  async update(id: string, data: {
    name?: string;
    dateOfBirth?: Date | string;
    gender?: string;
    phone?: string;
    alternatePhone?: string;
    email?: string;
    address?: Record<string, any>;
    emergencyContact?: Record<string, any>;
    updatedBy?: string;
  }, clinicId: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id, clinicId } });
    if (!patient || patient.deletedAt) throw new NotFoundException('Patient not found');

    if (data.phone && data.phone !== patient.phone) {
      const existing = await this.prisma.patient.findFirst({
        where: { clinicId, phone: data.phone, deletedAt: null, NOT: { id } },
      });
      if (existing) throw new ConflictException('Phone number already registered');
    }
    if (data.email && data.email !== patient.email) {
      const existing = await this.prisma.patient.findFirst({
        where: { clinicId, email: data.email, deletedAt: null, NOT: { id } },
      });
      if (existing) throw new ConflictException('Email already registered');
    }

    const changedFields: Record<string, { old: any; new: any }> = {};
    const fieldMap = {
      name: 'name',
      dateOfBirth: 'dateOfBirth',
      gender: 'gender',
      phone: 'phone',
      alternatePhone: 'alternatePhone',
      email: 'email',
      address: 'address',
      emergencyContact: 'emergencyContact',
    };

    for (const [key, field] of Object.entries(fieldMap)) {
      const newValue = (data as any)[key];
      const oldValue = (patient as any)[field];
      if (newValue !== undefined && newValue !== oldValue) {
        changedFields[key] = { old: oldValue, new: newValue };
      }
    }

    const updated = await this.prisma.patient.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.dateOfBirth !== undefined
          ? { dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null }
          : {}),
        ...(data.gender !== undefined ? { gender: data.gender as any } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.alternatePhone !== undefined ? { alternatePhone: data.alternatePhone } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.address !== undefined ? { address: data.address } : {}),
        ...(data.emergencyContact !== undefined ? { emergencyContact: data.emergencyContact } : {}),
      },
    });

    if (Object.keys(changedFields).length) {
      await this.auditService.log({
        actorId: data.updatedBy,
        action: 'PATIENT_UPDATED',
        entityType: 'Patient',
        entityId: id,
        result: 'SUCCESS',
        metadata: { changedFields, clinicId },
      });
    }

    return updated;
  }

  async search(query: string, limit = 10, options?: { opRegistered?: boolean; clinicId: string }) {
    return this.prisma.patient.findMany({
      where: {
        clinicId: options?.clinicId,
        deletedAt: null,
        ...(options?.opRegistered ? { opCases: { some: {} } } : {}),
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { patientNumber: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        patientNumber: true,
        name: true,
        phone: true,
        email: true,
        gender: true,
        dateOfBirth: true,
        opCases: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, createdAt: true, chiefComplaint: true, status: true },
        },
      },
    });
  }

  async getTimeline(id: string, params: {
    page?: number;
    limit?: number;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
    clinicId: string;
  }) {
    await this.findById(id, params.clinicId);
    const { page = 1, limit = 50, eventType, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.PatientTimelineEventWhereInput = {
      patientId: id,
    };

    if (eventType) {
      where.eventType = eventType as any;
    }
    if (startDate || endDate) {
      where.occurredAt = {};
      if (startDate) where.occurredAt.gte = startDate;
      if (endDate) where.occurredAt.lte = endDate;
    }

    const [data, total] = await Promise.all([
      this.prisma.patientTimelineEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { occurredAt: 'desc' },
      }),
      this.prisma.patientTimelineEvent.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async addTimelineEvent(data: {
    patientId: string;
    eventType: string;
    referenceId: string;
    title: string;
    description?: string;
    occurredAt?: Date;
    metadata?: Record<string, any>;
  }) {
    return this.prisma.patientTimelineEvent.create({
      data: {
        patientId: data.patientId,
        eventType: data.eventType as any,
        referenceId: data.referenceId,
        title: data.title,
        description: data.description,
        occurredAt: data.occurredAt || new Date(),
        metadata: data.metadata,
      },
    });
  }

  // Document-related methods
  async getDocuments(patientId: string, params: {
    page?: number;
    limit?: number;
    category?: string;
    clinicId: string;
  }) {
    await this.findById(patientId, params.clinicId);
    const { page = 1, limit = 20, category, clinicId } = params;
    const skip = (page - 1) * limit;

    const where: any = {
      patientId,
      clinicId,
      isDeleted: false,
    };

    if (category) {
      where.category = category;
    }

    const [data, total] = await Promise.all([
      this.prisma.patientDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { uploadedAt: 'desc' },
        include: {
          uploadedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.patientDocument.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getDocumentCategories() {
    return [
      { value: 'AUDIOGRAM', label: 'Audiogram' },
      { value: 'LAB_REPORT', label: 'Lab Report' },
      { value: 'PRESCRIPTION', label: 'Prescription' },
      { value: 'REFERRAL', label: 'Referral' },
      { value: 'THERAPY_ASSESSMENT', label: 'Therapy Assessment' },
      { value: 'SCANNED', label: 'Scanned' },
      { value: 'OTHER', label: 'Other' },
    ];
  }

  async getStats(id: string, clinicId: string) {
    await this.findById(id, clinicId);
    const [
      appointmentsCount,
      opCasesCount,
      therapyCasesCount,
      invoicesCount,
      totalPaid,
      documentsCount,
      upcomingAppointments,
    ] = await Promise.all([
      this.prisma.appointment.count({ where: { patientId: id, clinicId } }),
      this.prisma.opCase.count({ where: { patientId: id, clinicId } }),
      this.prisma.therapyCase.count({ where: { patientId: id, clinicId } }),
      this.prisma.invoice.count({ where: { patientId: id, clinicId } }),
      this.prisma.payment.aggregate({
        where: { clinicId, invoice: { patientId: id }, status: 'SUCCESS' },
        _sum: { amount: true },
      }),
      this.prisma.patientDocument.count({ where: { patientId: id, clinicId, isDeleted: false } }),
      this.prisma.appointment.findMany({
        where: {
          patientId: id,
          clinicId,
          status: { in: ['BOOKED', 'CHECKED_IN'] },
          appointmentAt: { gte: new Date() },
        },
        orderBy: { appointmentAt: 'asc' },
        take: 5,
      }),
    ]);

    return {
      appointments: appointmentsCount,
      opCases: opCasesCount,
      therapyCases: therapyCasesCount,
      invoices: invoicesCount,
      totalPaid: totalPaid._sum.amount || 0,
      documents: documentsCount,
      upcomingAppointments,
    };
  }

  async delete(id: string, deletedBy: string, clinicId: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id, clinicId } });
    if (!patient || patient.deletedAt) throw new NotFoundException('Patient not found');

    const deleted = await this.prisma.patient.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
      },
    });

    await this.auditService.log({
      actorId: deletedBy,
      actorType: 'user',
      patientId: id,
      action: 'PATIENT_DELETED',
      entityType: 'Patient',
      entityId: id,
      result: 'SUCCESS',
      metadata: { patientNumber: patient.patientNumber, name: patient.name, clinicId },
    });

    await this.addTimelineEvent({
      patientId: id,
      eventType: 'OTHER',
      referenceId: id,
      title: 'Patient Deleted',
      description: `Patient ${patient.name} (${patient.patientNumber}) was deleted.`,
      occurredAt: new Date(),
      metadata: { patientNumber: patient.patientNumber, deletedBy },
    });

    return { message: 'Patient deleted successfully', patient: deleted };
  }
}