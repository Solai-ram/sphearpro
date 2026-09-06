import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  forwardRef,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';
import { AiService } from '../ai/ai.service';
import { CommunicationService } from '../communication/communication.service';
import {
  SessionFrequency,
  addDays,
  nextOccurrence,
  withRemaining,
} from './session-schedule';

const DEFAULT_SESSION_FEE = 500;

@Injectable()
export class TherapyService {
  constructor(
    @Inject('PRISMA_CLIENT') private prisma: any,
    private auditService: AuditService,
    @Inject(forwardRef(() => BillingService)) private billingService: BillingService,
    private aiService: AiService,
    private communicationService: CommunicationService,
  ) {}

  // ---------------------------------------------------------------------------
  // Therapy types & package catalog
  // ---------------------------------------------------------------------------

  async listTypes(clinicId: string) {
    return this.prisma.therapyType.findMany({
      where: { clinicId, isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { packages: true } } },
    });
  }

  async createType(data: { name: string; description?: string; clinicId: string }, createdBy?: string) {
    const existing = await this.prisma.therapyType.findUnique({
      where: { clinicId_name: { clinicId: data.clinicId, name: data.name } },
    });
    if (existing) throw new BadRequestException('Therapy type already exists');

    const type = await this.prisma.therapyType.create({
      data: { clinicId: data.clinicId, name: data.name, description: data.description, isActive: true },
    });

    await this.auditService.log({
      clinicId: data.clinicId,
      actorId: createdBy,
      actorType: 'user',
      action: 'THERAPY_TYPE_CREATED',
      entityType: 'TherapyType',
      entityId: type.id,
      result: 'SUCCESS',
      metadata: { name: data.name },
    });

    return type;
  }

  async listPackages(params: { page?: number; limit?: number; therapyTypeId?: string; isActive?: boolean; clinicId: string }) {
    const { page = 1, limit = 50, therapyTypeId, isActive, clinicId } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.TherapyPackageWhereInput = { clinicId };
    if (therapyTypeId) where.therapyTypeId = therapyTypeId;
    if (isActive !== undefined) where.isActive = isActive;

    const [data, total] = await Promise.all([
      this.prisma.therapyPackage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { therapyType: true },
      }),
      this.prisma.therapyPackage.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getPackage(id: string, clinicId: string) {
    const pkg = await this.prisma.therapyPackage.findFirst({
      where: { id, clinicId },
      include: { therapyType: true },
    });
    if (!pkg) throw new NotFoundException('Therapy package not found');
    return pkg;
  }

  async createPackage(
    data: {
      therapyTypeId: string;
      name: string;
      totalSessions: number;
      frequency: SessionFrequency;
      price: number;
      validityDays?: number;
      clinicId: string;
    },
    createdBy?: string,
  ) {
    if (data.totalSessions < 1) throw new BadRequestException('totalSessions must be at least 1');
    if (data.price < 0) throw new BadRequestException('price cannot be negative');

    const type = await this.prisma.therapyType.findFirst({ where: { id: data.therapyTypeId, clinicId: data.clinicId } });
    if (!type) throw new NotFoundException('Therapy type not found');

    const pkg = await this.prisma.therapyPackage.create({
      data: {
        clinicId: data.clinicId,
        therapyTypeId: data.therapyTypeId,
        name: data.name,
        totalSessions: data.totalSessions,
        frequency: data.frequency,
        price: data.price,
        validityDays: data.validityDays,
        isActive: true,
      },
      include: { therapyType: true },
    });

    await this.auditService.log({
      clinicId: data.clinicId,
      actorId: createdBy,
      actorType: 'user',
      action: 'THERAPY_PACKAGE_CREATED',
      entityType: 'TherapyPackage',
      entityId: pkg.id,
      result: 'SUCCESS',
      metadata: { name: data.name, totalSessions: data.totalSessions, frequency: data.frequency },
    });

    return pkg;
  }

  async updatePackage(
    id: string,
    clinicId: string,
    data: {
      name?: string;
      totalSessions?: number;
      frequency?: SessionFrequency;
      price?: number;
      validityDays?: number;
      isActive?: boolean;
    },
  ) {
    await this.getPackage(id, clinicId);
    return this.prisma.therapyPackage.update({
      where: { id },
      data,
      include: { therapyType: true },
    });
  }

  // ---------------------------------------------------------------------------
  // Therapy cases
  // ---------------------------------------------------------------------------

  async createCase(data: {
    patientId: string;
    therapistId: string;
    title: string;
    assessment?: string;
    goals?: unknown;
    opCaseId?: string;
    createdBy?: string;
    clinicId: string;
  }) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: data.patientId, clinicId: data.clinicId, deletedAt: null },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const opWhere: any = { patientId: data.patientId, clinicId: data.clinicId };
    if (data.opCaseId) opWhere.id = data.opCaseId;
    const opCase = await this.prisma.opCase.findFirst({ where: opWhere, orderBy: { createdAt: 'desc' } });
    if (!opCase) {
      throw new BadRequestException(
        'Therapy can only be started for a patient who already has an OP consultation. Create an OP case first.',
      );
    }

    const therapist = await this.prisma.staffProfile.findFirst({ where: { id: data.therapistId, clinicId: data.clinicId } });
    if (!therapist) throw new NotFoundException('Therapist not found');

    const therapyCase = await this.prisma.therapyCase.create({
      data: {
        clinicId: data.clinicId,
        patientId: data.patientId,
        therapistId: data.therapistId,
        title: data.title,
        assessment: data.assessment,
        goals: data.goals as any,
        status: 'ACTIVE',
      },
      include: this.caseInclude(),
    });

    await this.auditService.log({
      clinicId: data.clinicId,
      actorId: data.createdBy,
      actorType: 'user',
      patientId: data.patientId,
      action: 'THERAPY_CASE_CREATED',
      entityType: 'TherapyCase',
      entityId: therapyCase.id,
      result: 'SUCCESS',
      metadata: { therapistId: data.therapistId, title: data.title, opCaseId: opCase.id },
    });

    await this.addTimelineEvent({
      patientId: data.patientId,
      eventType: 'OTHER',
      referenceId: therapyCase.id,
      title: 'Therapy Case Opened',
      description: `${data.title} with ${therapist.name} (from OP)`,
      metadata: { therapyCaseId: therapyCase.id, opCaseId: opCase.id },
    });

    return therapyCase;
  }

  async findCaseById(id: string, clinicId: string) {
    const therapyCase = await this.prisma.therapyCase.findFirst({
      where: { id, clinicId },
      include: this.caseInclude(),
    });
    if (!therapyCase) throw new NotFoundException('Therapy case not found');

    const sessions = therapyCase.sessions || [];
    const pendingDoctorNotes = sessions
      .filter((session: any) => {
        if (session.status !== 'COMPLETED' || !session.doctorId) return false;
        const hasDoctorNote = (session.notes || []).some(
          (note: any) => note.authoredById === session.doctorId && !note.isAiDraft,
        );
        return !hasDoctorNote;
      })
      .map((session: any) => ({
        sessionId: session.id,
        scheduledAt: session.scheduledAt,
        doctorId: session.doctorId,
        doctor: session.doctor,
      }));

    return {
      ...therapyCase,
      packages: (therapyCase.packages || []).map(withRemaining),
      pendingDoctorNotes,
    };
  }

  async findAllCases(params: {
    page?: number;
    limit?: number;
    search?: string;
    therapistId?: string;
    doctorId?: string;
    status?: string;
    patientId?: string;
    requestingUserId?: string;
    clinicId: string;
  }) {
    const { page = 1, limit = 20, search, therapistId, status, patientId, clinicId } = params;
    let doctorId = params.doctorId;
    const skip = (page - 1) * limit;
    const where: Prisma.TherapyCaseWhereInput = { clinicId };

    // Doctors only see cases where they have an assigned appointment/session
    if (params.requestingUserId) {
      const staff = await this.prisma.staffProfile.findFirst({
        where: { clinicId, userId: params.requestingUserId },
      });
      if (staff?.staffType === 'DOCTOR') {
        doctorId = staff.id;
      }
    }

    if (therapistId) where.therapistId = therapistId;
    if (doctorId) {
      where.sessions = { some: { doctorId } };
    }
    if (status) where.status = status as any;
    if (patientId) where.patientId = patientId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { patient: { name: { contains: search, mode: 'insensitive' } } },
        { patient: { patientNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.therapyCase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { id: true, name: true, patientNumber: true, phone: true } },
          therapist: { select: { id: true, name: true, staffType: true } },
          _count: { select: { sessions: true, packages: true } },
        },
      }),
      this.prisma.therapyCase.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async updateCase(
    id: string,
    clinicId: string,
    data: {
      title?: string;
      assessment?: string;
      goals?: unknown;
      status?: 'ACTIVE' | 'COMPLETED' | 'DISCONTINUED';
      updatedBy?: string;
    },
  ) {
    const existing = await this.prisma.therapyCase.findFirst({ where: { id, clinicId } });
    if (!existing) throw new NotFoundException('Therapy case not found');

    const updated = await this.prisma.therapyCase.update({
      where: { id },
      data: {
        title: data.title,
        assessment: data.assessment,
        goals: data.goals as any,
        status: data.status as any,
      },
      include: this.caseInclude(),
    });

    await this.auditService.log({
      clinicId,
      actorId: data.updatedBy,
      actorType: 'user',
      patientId: existing.patientId,
      action: 'THERAPY_CASE_UPDATED',
      entityType: 'TherapyCase',
      entityId: id,
      result: 'SUCCESS',
      metadata: { changed: Object.keys(data) },
    });

    return { ...updated, packages: (updated.packages || []).map(withRemaining) };
  }

  // ---------------------------------------------------------------------------
  // Patient package assignment + session generation
  // ---------------------------------------------------------------------------

  async assignPackage(
    therapyCaseId: string,
    clinicId: string,
    data: { packageId: string; startDate?: Date | string; createdBy?: string },
  ) {
    const therapyCase = await this.prisma.therapyCase.findFirst({
      where: { id: therapyCaseId, clinicId },
      include: { patient: { select: { id: true, name: true } } },
    });
    if (!therapyCase) throw new NotFoundException('Therapy case not found');

    const catalog = await this.getPackage(data.packageId, clinicId);
    if (!catalog.isActive) throw new BadRequestException('Package is not active');

    const purchasedAt = new Date();
    const expiryDate = catalog.validityDays
      ? addDays(purchasedAt, catalog.validityDays)
      : null;

    const patientPackage = await this.prisma.patientPackage.create({
      data: {
        clinicId,
        patientId: therapyCase.patientId,
        therapyCaseId,
        packageId: catalog.id,
        totalSessions: catalog.totalSessions,
        usedSessions: 0,
        expiryDate,
        purchasedAt,
      },
      include: { package: { include: { therapyType: true } } },
    });

    const startDate = data.startDate ? new Date(data.startDate) : purchasedAt;
    const sessions = await this.generateSessions({
      clinicId,
      therapyCaseId,
      therapistId: therapyCase.therapistId,
      patientPackageId: patientPackage.id,
      totalSessions: catalog.totalSessions,
      frequency: catalog.frequency,
      startDate,
      expiryDate,
    });

    await this.auditService.log({
      clinicId,
      actorId: data.createdBy,
      actorType: 'user',
      patientId: therapyCase.patientId,
      action: 'THERAPY_PACKAGE_ASSIGNED',
      entityType: 'PatientPackage',
      entityId: patientPackage.id,
      result: 'SUCCESS',
      metadata: {
        packageId: catalog.id,
        totalSessions: catalog.totalSessions,
        sessionsGenerated: sessions.length,
      },
    });

    await this.addTimelineEvent({
      patientId: therapyCase.patientId,
      eventType: 'OTHER',
      referenceId: patientPackage.id,
      title: 'Therapy Package Assigned',
      description: `${catalog.name} (${catalog.totalSessions} sessions)`,
      metadata: { therapyCaseId, patientPackageId: patientPackage.id },
    });

    try {
      await this.billingService.createInvoice({
        clinicId,
        patientId: therapyCase.patientId,
        notes: `Therapy package: ${catalog.name}`,
        createdBy: data.createdBy,
        items: [
          {
            billableType: 'THERAPY_PACKAGE',
            referenceId: patientPackage.id,
            description: catalog.name,
            quantity: 1,
            unitPrice: Number(catalog.price),
          },
        ],
      });
    } catch (error) {
      console.error('Failed to invoice assigned therapy package:', error);
    }

    this.communicationService.queueTherapySessions(sessions.map((s: { id: string }) => s.id)).catch((error) => {
      console.error('Failed to queue therapy WhatsApp:', error);
    });

    return {
      ...withRemaining(patientPackage),
      sessionsGenerated: sessions.length,
      sessions,
    };
  }

  async listPatientPackages(patientId: string, clinicId: string) {
    const packages = await this.prisma.patientPackage.findMany({
      where: { clinicId, patientId },
      orderBy: { purchasedAt: 'desc' },
      include: {
        package: { include: { therapyType: true } },
        therapyCase: { select: { id: true, title: true, status: true } },
        _count: { select: { sessions: true } },
      },
    });
    return packages.map(withRemaining);
  }

  async generateSessionsForCase(
    therapyCaseId: string,
    clinicId: string,
    data: {
      patientPackageId?: string;
      totalSessions?: number;
      frequency?: SessionFrequency;
      startDate?: Date | string;
      therapistId?: string;
      createdBy?: string;
    },
  ) {
    const therapyCase = await this.prisma.therapyCase.findUnique({ where: { id: therapyCaseId } });
    if (!therapyCase) throw new NotFoundException('Therapy case not found');

    let patientPackageId = data.patientPackageId ?? null;
    let totalSessions = data.totalSessions;
    let frequency: SessionFrequency = data.frequency || 'WEEKLY';
    let expiryDate: Date | null = null;

    if (patientPackageId) {
      const pkg = await this.prisma.patientPackage.findUnique({
        where: { id: patientPackageId },
        include: { package: true },
      });
      if (!pkg) throw new NotFoundException('Patient package not found');
      totalSessions = totalSessions ?? pkg.totalSessions;
      frequency = pkg.package.frequency;
      expiryDate = pkg.expiryDate;
    }

    if (!totalSessions || totalSessions < 1) {
      throw new BadRequestException('totalSessions is required');
    }

    const sessions = await this.generateSessions({
      therapyCaseId,
      therapistId: data.therapistId || therapyCase.therapistId,
      patientPackageId,
      totalSessions,
      frequency,
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      expiryDate,
    });

    await this.auditService.log({
      actorId: data.createdBy,
      actorType: 'user',
      patientId: therapyCase.patientId,
      action: 'THERAPY_SESSIONS_GENERATED',
      entityType: 'TherapyCase',
      entityId: therapyCaseId,
      result: 'SUCCESS',
      metadata: { count: sessions.length, frequency, patientPackageId },
    });

    this.communicationService.queueTherapySessions(sessions.map((s: { id: string }) => s.id)).catch((error) => {
      console.error('Failed to queue therapy WhatsApp:', error);
    });

    return { data: sessions, meta: { generated: sessions.length } };
  }

  private async generateSessions(input: {
    clinicId: string;
    therapyCaseId: string;
    therapistId: string;
    patientPackageId: string | null;
    totalSessions: number;
    frequency: SessionFrequency;
    startDate: Date;
    expiryDate: Date | null;
  }) {
    const sessions: { scheduledAt: Date }[] = [];
    let current = new Date(input.startDate);
    const now = new Date();

    while (current <= now) {
      current = nextOccurrence(current, input.frequency, sessions.length);
    }

    let index = 0;
    while (sessions.length < input.totalSessions) {
      if (input.expiryDate && current > input.expiryDate) break;
      sessions.push({ scheduledAt: new Date(current) });
      current = nextOccurrence(current, input.frequency, index);
      index += 1;
    }

    if (sessions.length === 0) return [];

    const generatedAt = new Date();
    await this.prisma.therapySession.createMany({
      data: sessions.map((s) => ({
        clinicId: input.clinicId,
        therapyCaseId: input.therapyCaseId,
        patientPackageId: input.patientPackageId,
        therapistId: input.therapistId,
        scheduledAt: s.scheduledAt,
        status: 'SCHEDULED',
      })),
    });

    return this.prisma.therapySession.findMany({
      where: {
        therapyCaseId: input.therapyCaseId,
        patientPackageId: input.patientPackageId,
        createdAt: { gte: generatedAt },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  async findAllSessions(params: {
    page?: number;
    limit?: number;
    therapyCaseId?: string;
    therapistId?: string;
    doctorId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    clinicId: string;
  }) {
    const { page = 1, limit = 20, therapyCaseId, therapistId, doctorId, status, startDate, endDate, search, clinicId } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.TherapySessionWhereInput = { clinicId };
    if (therapyCaseId) where.therapyCaseId = therapyCaseId;
    if (therapistId) where.therapistId = therapistId;
    if (doctorId) where.doctorId = doctorId;
    if (status) where.status = status as any;
    if (startDate || endDate) {
      where.scheduledAt = {};
      if (startDate) where.scheduledAt.gte = startDate;
      if (endDate) where.scheduledAt.lte = endDate;
    }
    if (search) {
      where.therapyCase = {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { patient: { name: { contains: search, mode: 'insensitive' } } },
          { patient: { patientNumber: { contains: search, mode: 'insensitive' } } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.therapySession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'asc' },
        include: this.sessionInclude(),
      }),
      this.prisma.therapySession.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findSessionById(id: string, clinicId: string) {
    const session = await this.prisma.therapySession.findFirst({
      where: { id, clinicId },
      include: this.sessionInclude(),
    });
    if (!session) throw new NotFoundException('Therapy session not found');
    return session;
  }

  async assignSession(id: string, clinicId: string, data: { doctorId: string; scheduledAt?: string | Date; createdBy?: string }) {
    const session = await this.findSessionById(id, clinicId);
    if (['COMPLETED', 'CANCELLED'].includes(session.status)) {
      throw new BadRequestException(`Cannot assign a ${session.status} session`);
    }

    const doctor = await this.prisma.staffProfile.findFirst({ where: { id: data.doctorId, clinicId } });
    if (!doctor) throw new NotFoundException('Doctor not found');
    if (doctor.staffType !== 'DOCTOR') {
      throw new BadRequestException('Assign a doctor. Therapists stay on the therapy case.');
    }

    const patch: { doctorId: string; scheduledAt?: Date } = { doctorId: data.doctorId };
    if (data.scheduledAt) {
      const when = new Date(data.scheduledAt);
      if (isNaN(when.getTime())) throw new BadRequestException('Invalid scheduledAt');
      patch.scheduledAt = when;
    }

    await this.prisma.therapySession.update({
      where: { id },
      data: patch,
    });

    const updated = await this.findSessionById(id, clinicId);

    await this.auditService.log({
      actorId: data.createdBy,
      actorType: 'user',
      patientId: session.therapyCase.patientId,
      action: 'THERAPY_SESSION_DOCTOR_ASSIGNED',
      entityType: 'TherapySession',
      entityId: id,
      result: 'SUCCESS',
      metadata: { doctorId: data.doctorId, scheduledAt: patch.scheduledAt?.toISOString() },
    });

    return updated;
  }

  async createManualSession(
    therapyCaseId: string,
    clinicId: string,
    data: { scheduledAt: string | Date; doctorId?: string; patientPackageId?: string; createdBy?: string },
  ) {
    const therapyCase = await this.prisma.therapyCase.findFirst({
      where: { id: therapyCaseId, clinicId },
      include: { packages: { orderBy: { purchasedAt: 'desc' }, take: 1 } },
    });
    if (!therapyCase) throw new NotFoundException('Therapy case not found');
    if (therapyCase.status !== 'ACTIVE') {
      throw new BadRequestException('Can only add slots on an active therapy case');
    }

    const when = new Date(data.scheduledAt);
    if (isNaN(when.getTime())) throw new BadRequestException('Invalid scheduledAt');

    if (data.doctorId) {
      const doctor = await this.prisma.staffProfile.findFirst({ where: { id: data.doctorId, clinicId } });
      if (!doctor || doctor.staffType !== 'DOCTOR') {
        throw new BadRequestException('doctorId must be a doctor');
      }
    }

    const patientPackageId =
      data.patientPackageId || therapyCase.packages?.[0]?.id || null;

    const created = await this.prisma.therapySession.create({
      data: {
        clinicId,
        therapyCaseId,
        therapistId: therapyCase.therapistId,
        patientPackageId,
        doctorId: data.doctorId || null,
        scheduledAt: when,
        status: 'SCHEDULED',
      },
      include: this.sessionInclude(),
    });

    await this.auditService.log({
      actorId: data.createdBy,
      actorType: 'user',
      patientId: therapyCase.patientId,
      action: 'THERAPY_SESSION_SLOT_ADDED',
      entityType: 'TherapySession',
      entityId: created.id,
      result: 'SUCCESS',
      metadata: { scheduledAt: when.toISOString(), doctorId: data.doctorId },
    });

    return created;
  }

  async rescheduleSession(
    id: string,
    clinicId: string,
    data: { scheduledAt: Date | string; note?: string; createdBy?: string },
  ) {
    const session = await this.findSessionById(id, clinicId);
    if (['COMPLETED', 'CANCELLED'].includes(session.status)) {
      throw new BadRequestException(`Cannot reschedule a ${session.status} session`);
    }

    const newTime = new Date(data.scheduledAt);
    if (isNaN(newTime.getTime())) throw new BadRequestException('Invalid scheduledAt');

    const updatedOriginal = await this.prisma.therapySession.update({
      where: { id },
      data: { status: 'RESCHEDULED' },
    });

    const replacement = await this.prisma.therapySession.create({
      data: {
        clinicId,
        therapyCaseId: session.therapyCaseId,
        patientPackageId: session.patientPackageId,
        therapistId: session.therapistId,
        scheduledAt: newTime,
        status: 'SCHEDULED',
      },
      include: this.sessionInclude(),
    });

    await this.auditService.log({
      actorId: data.createdBy,
      actorType: 'user',
      patientId: session.therapyCase.patientId,
      action: 'THERAPY_SESSION_RESCHEDULED',
      entityType: 'TherapySession',
      entityId: replacement.id,
      result: 'SUCCESS',
      metadata: {
        originalSessionId: id,
        fromTime: session.scheduledAt,
        toTime: newTime.toISOString(),
        note: data.note,
      },
    });

    return { original: updatedOriginal, session: replacement };
  }

  async markAttendance(
    id: string,
    clinicId: string,
    data: {
      status: 'PRESENT' | 'ABSENT' | 'CANCELLED' | 'RESCHEDULED' | 'LATE';
      unitPrice?: number;
      createdBy?: string;
    },
  ) {
    const session = await this.findSessionById(id, clinicId);
    if (session.attendance) {
      throw new BadRequestException('Attendance already marked for this session');
    }

    const sessionStatus =
      data.status === 'PRESENT' || data.status === 'LATE'
        ? 'COMPLETED'
        : data.status === 'ABSENT'
          ? 'NO_SHOW'
          : data.status === 'CANCELLED'
            ? 'CANCELLED'
            : 'RESCHEDULED';

    const attendance = await this.prisma.$transaction(async (tx: any) => {
      const created = await tx.therapyAttendance.create({
        data: {
          sessionId: id,
          status: data.status,
          markedBy: data.createdBy,
        },
      });

      await tx.therapySession.update({
        where: { id },
        data: { status: sessionStatus },
      });

      // usedSessions increments only on PRESENT (clinic policy)
      if (data.status === 'PRESENT' && session.patientPackageId) {
        await tx.patientPackage.update({
          where: { id: session.patientPackageId },
          data: { usedSessions: { increment: 1 } },
        });
      }

      return created;
    });

    await this.auditService.log({
      actorId: data.createdBy,
      actorType: 'user',
      patientId: session.therapyCase.patientId,
      action: 'THERAPY_ATTENDANCE_MARKED',
      entityType: 'TherapyAttendance',
      entityId: attendance.id,
      result: 'SUCCESS',
      metadata: { sessionId: id, status: data.status, sessionStatus },
    });

    await this.addTimelineEvent({
      patientId: session.therapyCase.patientId,
      eventType: 'ATTENDANCE',
      referenceId: attendance.id,
      title: `Therapy Attendance: ${data.status}`,
      description: `Session on ${new Date(session.scheduledAt).toLocaleString()}`,
      metadata: { sessionId: id, therapyCaseId: session.therapyCaseId },
    });

    // Independent billing: no package → invoice the session when present
    if ((data.status === 'PRESENT' || data.status === 'LATE') && !session.patientPackageId) {
      try {
        await this.billingService.createInvoice({
        clinicId: session.clinicId,
        patientId: session.therapyCase.patientId,
          notes: 'Individual therapy session',
          createdBy: data.createdBy,
          items: [
            {
              billableType: 'THERAPY_SESSION',
              referenceId: session.id,
              description: `Therapy session — ${session.therapyCase.title}`,
              quantity: 1,
              unitPrice: data.unitPrice ?? DEFAULT_SESSION_FEE,
            },
          ],
        });
      } catch (error) {
        console.error('Failed to invoice individual therapy session:', error);
      }
    }

    const updated = await this.findSessionById(id, clinicId);
    const noteRequired =
      sessionStatus === 'COMPLETED'
      && Boolean(updated.doctorId)
      && !(updated.notes || []).some(
        (note: any) => note.authoredById === updated.doctorId && !note.isAiDraft,
      );

    return { ...updated, noteRequired };
  }

  /**
   * Doctor workspace: only the assigned doctor may record outcome.
   * COMPLETED → attendance PRESENT + required SOAP note.
   * CANCELLED / ABSENT → attendance only, no note.
   */
  async listMyDoctorSessions(userId: string) {
    const doctor = await this.requireStaffForUser(userId);
    if (doctor.staffType !== 'DOCTOR' && doctor.staffType !== 'ADMIN') {
      throw new BadRequestException('Only doctors can open the doctor session queue');
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 14);

    return this.prisma.therapySession.findMany({
      where: {
        doctorId: doctor.id,
        status: 'SCHEDULED',
        scheduledAt: { gte: start },
      },
      orderBy: { scheduledAt: 'asc' },
      include: this.sessionInclude(),
    });
  }

  async getDoctorSessionWorkspace(sessionId: string, userId: string) {
    const doctor = await this.requireStaffForUser(userId);
    const session = await this.findSessionById(sessionId, clinicId);

    if (session.doctorId !== doctor.id) {
      const isAdmin = await this.userIsAdmin(userId);
      if (!isAdmin) {
        throw new BadRequestException('This session is assigned to another doctor');
      }
    }

    const therapyCase = await this.findCaseById(session.therapyCaseId);
    const priorNotes = (therapyCase.sessions || [])
      .flatMap((s: any) =>
        (s.notes || []).map((note: any) => ({
          ...note,
          sessionId: s.id,
          scheduledAt: s.scheduledAt,
          sessionDoctor: s.doctor,
        })),
      )
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    return {
      session,
      therapyCase: {
        id: therapyCase.id,
        title: therapyCase.title,
        patientId: therapyCase.patientId,
        patient: therapyCase.patient,
        therapist: therapyCase.therapist,
        assessment: therapyCase.assessment,
        status: therapyCase.status,
      },
      priorNotes,
      aiSummaries: therapyCase.aiSummaries || [],
    };
  }

  async recordDoctorSessionOutcome(
    sessionId: string,
    data: {
      outcome: 'COMPLETED' | 'CANCELLED' | 'ABSENT';
      subjective?: string;
      objective?: string;
      activities?: string;
      observations?: string;
      progress?: string;
      challenges?: string;
      nextPlan?: string;
      unitPrice?: number;
      createdBy?: string;
    },
  ) {
    if (!data.createdBy) throw new BadRequestException('Authenticated user required');
    const doctor = await this.requireStaffForUser(data.createdBy);
    const session = await this.findSessionById(sessionId, clinicId);

    if (session.doctorId !== doctor.id) {
      throw new BadRequestException('Only the assigned doctor can record this session');
    }
    if (session.status !== 'SCHEDULED') {
      throw new BadRequestException(`Session is already ${session.status}`);
    }
    if (session.attendance) {
      throw new BadRequestException('Attendance already marked for this session');
    }

    if (data.outcome === 'COMPLETED') {
      const hasContent = [
        data.subjective,
        data.objective,
        data.activities,
        data.observations,
        data.progress,
        data.challenges,
        data.nextPlan,
      ].some((field) => field && field.trim());
      if (!hasContent) {
        throw new BadRequestException('SOAP note is required when marking the session Completed');
      }
    }

    const attendanceStatus =
      data.outcome === 'COMPLETED'
        ? 'PRESENT'
        : data.outcome === 'ABSENT'
          ? 'ABSENT'
          : 'CANCELLED';

    const updated = await this.markAttendance(sessionId, {
      status: attendanceStatus,
      unitPrice: data.unitPrice,
      createdBy: data.createdBy,
    });

    let note = null;
    if (data.outcome === 'COMPLETED') {
      note = await this.addNote(sessionId, {
        subjective: data.subjective,
        objective: data.objective,
        activities: data.activities,
        observations: data.observations,
        progress: data.progress,
        challenges: data.challenges,
        nextPlan: data.nextPlan,
        isAiDraft: false,
        createdBy: data.createdBy,
      });
    }

    const fresh = await this.findSessionById(sessionId, clinicId);
    return {
      ...fresh,
      note,
      outcome: data.outcome,
    };
  }

  // ---------------------------------------------------------------------------
  // SOAP notes
  // ---------------------------------------------------------------------------

  async addNote(
    sessionId: string,
    data: {
      therapistId?: string;
      subjective?: string;
      objective?: string;
      activities?: string;
      observations?: string;
      progress?: string;
      challenges?: string;
      nextPlan?: string;
      isAiDraft?: boolean;
      createdBy?: string;
    },
  ) {
    const session = await this.findSessionById(sessionId, clinicId);
    const hasContent = [
      data.subjective,
      data.objective,
      data.activities,
      data.observations,
      data.progress,
      data.challenges,
      data.nextPlan,
    ].some((field) => field && field.trim());
    if (!hasContent) throw new BadRequestException('At least one SOAP field is required');

    const author = await this.resolveNoteAuthor(data.createdBy, data.therapistId, session);
    const isDoctorAuthor = author.staffType === 'DOCTOR';

    if (isDoctorAuthor && !data.isAiDraft) {
      if (session.status !== 'COMPLETED') {
        throw new BadRequestException('Doctor notes can only be added after the session is completed');
      }
      if (!session.doctorId) {
        throw new BadRequestException('No attending doctor is assigned to this session');
      }
      if (session.doctorId !== author.id) {
        const isAdmin = data.createdBy ? await this.userIsAdmin(data.createdBy) : false;
        if (!isAdmin) {
          throw new BadRequestException('Only the attending doctor for this session can add the clinical note');
        }
      }
      const existing = await this.prisma.therapyNote.findFirst({
        where: {
          sessionId,
          authoredById: author.id,
          isAiDraft: false,
        },
      });
      if (existing) {
        throw new BadRequestException('You already added a clinical note for this session');
      }
    }

    const note = await this.prisma.therapyNote.create({
      data: {
        sessionId,
        therapistId: isDoctorAuthor ? session.therapistId : author.id,
        authoredById: author.id,
        subjective: data.subjective,
        objective: data.objective,
        activities: data.activities,
        observations: data.observations,
        progress: data.progress,
        challenges: data.challenges,
        nextPlan: data.nextPlan,
        isAiDraft: data.isAiDraft ?? false,
        aiReviewed: false,
      },
      include: this.noteInclude(),
    });

    await this.auditService.log({
      actorId: data.createdBy,
      actorType: data.isAiDraft ? 'ai' : 'user',
      patientId: session.therapyCase.patientId,
      action: 'THERAPY_NOTE_CREATED',
      entityType: 'TherapyNote',
      entityId: note.id,
      result: 'SUCCESS',
      metadata: {
        sessionId,
        isAiDraft: note.isAiDraft,
        authoredById: author.id,
        authorStaffType: author.staffType,
      },
    });

    if (!note.isAiDraft) {
      await this.addTimelineEvent({
        patientId: session.therapyCase.patientId,
        eventType: 'THERAPY_NOTE',
        referenceId: note.id,
        title: isDoctorAuthor ? 'Doctor Session Note Recorded' : 'Therapy Note Recorded',
        description: data.progress || data.subjective || 'SOAP note recorded',
        metadata: {
          sessionId,
          therapyCaseId: session.therapyCaseId,
          authoredById: author.id,
        },
      });
    }

    return note;
  }

  async addVoiceNote(
    sessionId: string,
    data: {
      buffer: Buffer;
      mimeType: string;
      fileName?: string;
      languageCode?: string;
      createdBy?: string;
    },
  ) {
    await this.findSessionById(sessionId, clinicId);
    const transcript = await this.aiService.transcribeAudio({
        clinicId: session.clinicId || clinicId,
      buffer: data.buffer,
      mimeType: data.mimeType,
      fileName: data.fileName,
      languageCode: data.languageCode,
      createdBy: data.createdBy,
      inputRef: sessionId,
    });

    let soap: Record<string, string> = {
      subjective: transcript.text,
      observations: `Voice transcript via ElevenLabs (${transcript.model}). Draft — therapist must review before this is a clinical record.`,
    };
    try {
      const drafted = await this.aiService.draftSoapFromTranscript({
        transcript: transcript.text,
        createdBy: data.createdBy,
        inputRef: sessionId,
      });
      soap = {
        ...drafted.soap,
        observations:
          drafted.soap.observations ||
          `Voice transcript structured by Gemini (${drafted.model}). Draft — therapist must review before this is a clinical record.`,
      };
    } catch {
      // Keep the raw transcript if summarization is unavailable.
    }

    const note = await this.addNote(sessionId, {
      ...soap,
      isAiDraft: true,
      createdBy: data.createdBy,
    });

    return {
      note,
      transcript: transcript.text,
      requestId: transcript.requestId,
      provider: transcript.provider,
      model: transcript.model,
      isDraft: true,
    };
  }

  async updateNote(
    noteId: string,
    data: {
      subjective?: string;
      objective?: string;
      activities?: string;
      observations?: string;
      progress?: string;
      challenges?: string;
      nextPlan?: string;
      aiReviewed?: boolean;
      updatedBy?: string;
    },
  ) {
    const note = await this.prisma.therapyNote.findUnique({
      where: { id: noteId },
      include: { session: { include: { therapyCase: true } } },
    });
    if (!note) throw new NotFoundException('Therapy note not found');

    const updated = await this.prisma.therapyNote.update({
      where: { id: noteId },
      data: {
        subjective: data.subjective,
        objective: data.objective,
        activities: data.activities,
        observations: data.observations,
        progress: data.progress,
        challenges: data.challenges,
        nextPlan: data.nextPlan,
        aiReviewed: data.aiReviewed,
        isAiDraft: data.aiReviewed ? false : undefined,
      },
      include: this.noteInclude(),
    });

    await this.auditService.log({
      actorId: data.updatedBy,
      actorType: 'user',
      patientId: note.session.therapyCase.patientId,
      action: data.aiReviewed ? 'THERAPY_NOTE_REVIEWED' : 'THERAPY_NOTE_UPDATED',
      entityType: 'TherapyNote',
      entityId: noteId,
      result: 'SUCCESS',
      metadata: { aiReviewed: data.aiReviewed },
    });

    if (data.aiReviewed && note.isAiDraft) {
      await this.addTimelineEvent({
        patientId: note.session.therapyCase.patientId,
        eventType: 'THERAPY_NOTE',
        referenceId: note.id,
        title: 'AI Therapy Note Approved',
        description: 'Therapist approved an AI-drafted SOAP note',
        metadata: { sessionId: note.sessionId },
      });
    }

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Progress + AI summary (draft → human review)
  // ---------------------------------------------------------------------------

  async addProgress(
    therapyCaseId: string,
    data: { metric: string; value?: number; note?: string; createdBy?: string },
  ) {
    const therapyCase = await this.prisma.therapyCase.findUnique({ where: { id: therapyCaseId } });
    if (!therapyCase) throw new NotFoundException('Therapy case not found');

    const progress = await this.prisma.therapyProgress.create({
      data: {
        therapyCaseId,
        metric: data.metric,
        value: data.value,
        note: data.note,
      },
    });

    await this.auditService.log({
      actorId: data.createdBy,
      actorType: 'user',
      patientId: therapyCase.patientId,
      action: 'THERAPY_PROGRESS_RECORDED',
      entityType: 'TherapyProgress',
      entityId: progress.id,
      result: 'SUCCESS',
      metadata: { metric: data.metric, value: data.value },
    });

    return progress;
  }

  async listProgress(therapyCaseId: string) {
    await this.findCaseById(therapyCaseId, clinicId);
    return this.prisma.therapyProgress.findMany({
      where: { therapyCaseId },
      orderBy: { recordedAt: 'desc' },
    });
  }

  async generateSummary(therapyCaseId: string, createdBy?: string) {
    const therapyCase = await this.findCaseById(therapyCaseId, clinicId);
    const sessions = await this.prisma.therapySession.findMany({
      where: { therapyCaseId },
      include: { attendance: true, notes: true },
      orderBy: { scheduledAt: 'asc' },
    });

    const total = sessions.length;
    const present = sessions.filter((s: any) => s.attendance?.status === 'PRESENT' || s.attendance?.status === 'LATE').length;
    const attendanceRate = total ? Math.round((present / total) * 100) : 0;
    const notes = sessions.flatMap((s: any) => s.notes || []);

    const generated = await this.aiService.summarizeTherapy({
      caseTitle: therapyCase.title,
      patientName: therapyCase.patient?.name || therapyCase.patientId,
      assessment: therapyCase.assessment,
      goals: therapyCase.goals,
      attendanceRate,
      present,
      total,
      notes,
      createdBy,
      inputRef: therapyCaseId,
    });

    const summary = await this.prisma.therapyAiSummary.create({
      data: {
        therapyCaseId,
        content: generated.text,
        isReviewed: false,
        createdBy,
        aiRequestId: generated.requestId,
      },
    });

    await this.auditService.log({
      actorId: createdBy,
      actorType: 'ai',
      patientId: therapyCase.patientId,
      action: 'AI_SUMMARY_GENERATED',
      entityType: 'TherapyAiSummary',
      entityId: summary.id,
      result: 'SUCCESS',
      metadata: { isReviewed: false, attendanceRate, provider: 'google', requestId: generated.requestId },
    });

    return summary;
  }

  async reviewSummary(summaryId: string, data: { approved: boolean; reviewedBy?: string }) {
    const summary = await this.prisma.therapyAiSummary.findUnique({
      where: { id: summaryId },
      include: { therapyCase: true },
    });
    if (!summary) throw new NotFoundException('AI summary not found');
    if (summary.isReviewed) throw new BadRequestException('Summary already reviewed');

    const updated = await this.prisma.therapyAiSummary.update({
      where: { id: summaryId },
      data: {
        isReviewed: data.approved,
        reviewedBy: data.reviewedBy,
        reviewedAt: new Date(),
      },
    });

    await this.auditService.log({
      actorId: data.reviewedBy,
      actorType: 'user',
      patientId: summary.therapyCase.patientId,
      action: 'AI_SUMMARY_REVIEWED',
      entityType: 'TherapyAiSummary',
      entityId: summaryId,
      result: 'SUCCESS',
      metadata: { approved: data.approved },
    });

    if (data.approved) {
      await this.addTimelineEvent({
        patientId: summary.therapyCase.patientId,
        eventType: 'OTHER',
        referenceId: summary.id,
        title: 'Therapy AI Summary Approved',
        description: 'Reviewed AI summary added to the clinical record',
        metadata: { therapyCaseId: summary.therapyCaseId },
      });
    }

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private noteInclude() {
    return {
      authoredBy: { select: { id: true, name: true, staffType: true } },
      therapist: { select: { id: true, name: true, staffType: true } },
    };
  }

  private caseInclude() {
    return {
      patient: { select: { id: true, name: true, patientNumber: true, phone: true } },
      therapist: { select: { id: true, name: true, staffType: true } },
      packages: {
        orderBy: { purchasedAt: 'desc' },
        include: { package: { include: { therapyType: true } } },
      },
      sessions: {
        orderBy: { scheduledAt: 'desc' },
        take: 50,
        include: {
          attendance: true,
          doctor: { select: { id: true, name: true, staffType: true } },
          therapist: { select: { id: true, name: true, staffType: true } },
          notes: {
            orderBy: { createdAt: 'desc' },
            include: this.noteInclude(),
          },
        },
      },
      progress: { orderBy: { recordedAt: 'desc' } },
      aiSummaries: { orderBy: { createdAt: 'desc' } },
    };
  }

  private sessionInclude() {
    return {
      therapist: { select: { id: true, name: true, staffType: true } },
      doctor: { select: { id: true, name: true, staffType: true } },
      therapyCase: {
        select: {
          id: true,
          title: true,
          patientId: true,
          therapistId: true,
          patient: { select: { id: true, name: true, patientNumber: true } },
        },
      },
      patientPackage: { include: { package: true } },
      attendance: true,
      notes: {
        orderBy: { createdAt: 'desc' },
        include: this.noteInclude(),
      },
    };
  }

  private async requireStaffForUser(userId: string) {
    const staff = await this.prisma.staffProfile.findFirst({ where: { userId } });
    if (!staff) {
      throw new BadRequestException(
        'No staff profile linked to this user. Ask an admin to link your login to a staff profile.',
      );
    }
    return staff;
  }

  private async userIsAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) return false;
    if (user.staffType === 'ADMIN') return true;
    return (user.roles || []).some((row: any) => row.role?.name === 'ADMIN');
  }

  private async resolveNoteAuthor(
    userId: string | undefined,
    _ignoredClientTherapistId: string | undefined,
    session: { therapistId: string; doctorId?: string | null },
  ) {
    if (!userId) {
      throw new BadRequestException('Unable to resolve note author');
    }
    const staff = await this.prisma.staffProfile.findFirst({ where: { userId } });
    if (!staff) {
      throw new BadRequestException(
        'No staff profile linked to this user. Notes must be authored by the logged-in clinician.',
      );
    }
    // Client-supplied therapistId is ignored — authorship is always the authenticated staff.
    void session;
    return staff;
  }

  private async addTimelineEvent(data: {
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
}
