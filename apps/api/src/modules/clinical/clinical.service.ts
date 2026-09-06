import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { searchIcd10 } from './icd10.data';
import { BillingService } from '../billing/billing.service';

export interface CreateOpCaseInput {
  patientId: string;
  clinicId: string;
  providerId?: string;
  appointmentId?: string;
  chiefComplaint?: string;
  vitals?: Record<string, any>;
  consultationFee?: number;
  paymentMethod?: 'CASH' | 'CARD' | 'UPI' | 'NET_BANKING' | 'WALLET' | 'OTHER';
  paymentReference?: string;
  createdBy?: string;
  isReview?: boolean;
}

export interface AddVisitInput {
  visitedAt?: Date | string;
  notes?: string;
}

export interface AddDiagnosisInput {
  code?: string; // ICD-10
  description: string;
  type?: 'PRIMARY' | 'SECONDARY';
}

export interface AddClinicalNoteInput {
  content: string;
  createdBy?: string;
}

export interface AddPrescriptionInput {
  notes?: string;
  items: {
    drugName: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
  }[];
  createdBy?: string;
}

export interface AddFollowUpInput {
  dueDate: Date | string;
  reason?: string;
}

@Injectable()
export class ClinicalService {
  constructor(
    @Inject('PRISMA_CLIENT') private prisma: any,
    private auditService: AuditService,
    private billingService: BillingService,
  ) {}

  // ---------------------------------------------------------------------------
  // OP CASE
  // ---------------------------------------------------------------------------

  async createOpCase(data: CreateOpCaseInput) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: data.patientId, clinicId: data.clinicId, deletedAt: null },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    if (data.consultationFee != null) {
      const fee = Number(data.consultationFee);
      if (Number.isNaN(fee) || fee < 0) throw new BadRequestException('Invalid consultation fee');
      data.consultationFee = fee;
    }

    let provider: { id: string; name: string } | null = null;
    if (data.providerId) {
      provider = await this.prisma.staffProfile.findUnique({
        where: { id: data.providerId },
        select: { id: true, name: true },
      });
      if (!provider) throw new NotFoundException('Doctor not found');
    }

    if (data.appointmentId) {
      const existing = await this.prisma.opCase.findFirst({ where: { appointmentId: data.appointmentId } });
      if (existing) throw new BadRequestException('An OP case already exists for this appointment');
    }

    const opCase = await this.prisma.opCase.create({
      data: {
        clinicId: data.clinicId,
        patientId: data.patientId,
        providerId: provider?.id ?? null,
        appointmentId: data.appointmentId,
        chiefComplaint: data.chiefComplaint,
        vitals: data.vitals as any,
        status: 'OPEN',
      },
      include: this.opCaseInclude(),
    });

    // Initial visit is implied by case creation; record explicitly for the timeline.
    await this.prisma.opVisit.create({
      data: { opCaseId: opCase.id, notes: data.chiefComplaint },
    });

    await this.auditService.log({
      actorId: data.createdBy,
      actorType: 'user',
      patientId: data.patientId,
      action: data.isReview ? 'OP_REVIEW_REGISTERED' : 'OP_CASE_CREATED',
      entityType: 'OpCase',
      entityId: opCase.id,
      result: 'SUCCESS',
      metadata: { providerId: provider?.id, complaint: data.chiefComplaint, isReview: Boolean(data.isReview) },
    });

    const doctorBit = provider?.name ? ` with ${provider.name}` : '';
    await this.addTimelineEvent({
      patientId: data.patientId,
      eventType: 'OP_VISIT',
      referenceId: opCase.id,
      title: data.isReview ? 'OP Review Visit' : 'OP Case Opened',
      description: data.isReview
        ? `Returning OP visit${doctorBit}${data.chiefComplaint ? `: ${data.chiefComplaint}` : ''}.`
        : `OP case opened${provider?.name ? ` by ${provider.name}` : ''}${data.chiefComplaint ? `: ${data.chiefComplaint}` : ''}.`,
      occurredAt: opCase.createdAt,
      metadata: { opCaseId: opCase.id, isReview: Boolean(data.isReview) },
    });

    if (data.consultationFee != null && data.consultationFee > 0) {
      await this.billConsultation(opCase.id, data.clinicId, {
        unitPrice: data.consultationFee,
        paymentMethod: data.paymentMethod || 'CASH',
        paymentReference: data.paymentReference,
        createdBy: data.createdBy,
      });
    }

    return this.findById(opCase.id, data.clinicId);
  }

  async createOpReview(data: CreateOpCaseInput) {
    const prior = await this.prisma.opCase.findFirst({
      where: { patientId: data.patientId, clinicId: data.clinicId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    });
    if (!prior) {
      throw new BadRequestException(
        'This patient has no previous OP registration. Use New OP registration for a first visit.',
      );
    }
    return this.createOpCase({ ...data, isReview: true });
  }

  async invoiceOpCase(opCaseId: string, clinicId: string, data: {
    unitPrice?: number;
    paymentMethod?: CreateOpCaseInput['paymentMethod'];
    paymentReference?: string;
    createdBy?: string;
  }) {
    return this.billConsultation(opCaseId, clinicId, {
      unitPrice: data.unitPrice ?? 500,
      paymentMethod: data.paymentMethod,
      paymentReference: data.paymentReference,
      createdBy: data.createdBy,
    });
  }

  async findById(id: string, clinicId: string) {
    const opCase = await this.prisma.opCase.findFirst({
      where: { id, clinicId },
      include: this.opCaseInclude(),
    });
    if (!opCase) throw new NotFoundException('OP case not found');
    return opCase;
  }

  async findByPatient(patientId: string, params: { page?: number; limit?: number; status?: string; clinicId: string }) {
    const { page = 1, limit = 20, status, clinicId } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.OpCaseWhereInput = { patientId, clinicId };
    if (status) where.status = status as any;

    const [data, total] = await Promise.all([
      this.prisma.opCase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: this.opCaseInclude(),
      }),
      this.prisma.opCase.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    providerId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    clinicId: string;
  }) {
    const { page = 1, limit = 20, search, providerId, status, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.OpCaseWhereInput = { clinicId: params.clinicId };
    if (providerId) where.providerId = providerId;
    if (status) where.status = status as any;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }
    if (search) {
      where.OR = [
        { chiefComplaint: { contains: search, mode: 'insensitive' } },
        { patient: { name: { contains: search, mode: 'insensitive' } } },
        { patient: { patientNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.opCase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { id: true, name: true, patientNumber: true } },
          provider: { select: { id: true, name: true } },
          _count: { select: { diagnoses: true, prescriptions: true, followUps: true } },
        },
      }),
      this.prisma.opCase.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateOpCase(id: string, data: {
    chiefComplaint?: string;
    vitals?: Record<string, any>;
    status?: 'OPEN' | 'CLOSED';
    updatedBy?: string;
  }) {
    const opCase = await this.prisma.opCase.findUnique({ where: { id } });
    if (!opCase) throw new NotFoundException('OP case not found');

    const updated = await this.prisma.opCase.update({
      where: { id },
      data: {
        chiefComplaint: data.chiefComplaint,
        vitals: data.vitals as any,
        status: data.status as any,
      },
      include: this.opCaseInclude(),
    });

    await this.auditService.log({
      actorId: data.updatedBy,
      actorType: 'user',
      patientId: opCase.patientId,
      action: 'OP_CASE_UPDATED',
      entityType: 'OpCase',
      entityId: id,
      result: 'SUCCESS',
      metadata: { changed: Object.keys(data) },
    });

    return updated;
  }

  async addVisit(opCaseId: string, data: AddVisitInput) {
    const opCase = await this.prisma.opCase.findUnique({ where: { id: opCaseId } });
    if (!opCase) throw new NotFoundException('OP case not found');

    const visit = await this.prisma.opVisit.create({
      data: {
        opCaseId,
        visitedAt: data.visitedAt ? new Date(data.visitedAt) : new Date(),
        notes: data.notes,
      },
    });

    await this.auditService.log({
      actorId: undefined,
      actorType: 'user',
      patientId: opCase.patientId,
      action: 'OP_VISIT_CREATED',
      entityType: 'OpVisit',
      entityId: visit.id,
      result: 'SUCCESS',
      metadata: { opCaseId },
    });

    await this.addTimelineEvent({
      patientId: opCase.patientId,
      eventType: 'OP_VISIT',
      referenceId: visit.id,
      title: 'OP Visit Recorded',
      description: data.notes || 'An OP visit was recorded.',
      metadata: { opCaseId },
    });

    return visit;
  }

  // ---------------------------------------------------------------------------
  // DIAGNOSIS (ICD-10)
  // ---------------------------------------------------------------------------

  async addDiagnosis(opCaseId: string, data: AddDiagnosisInput) {
    const opCase = await this.prisma.opCase.findUnique({ where: { id: opCaseId } });
    if (!opCase) throw new NotFoundException('OP case not found');

    const diagnosis = await this.prisma.diagnosis.create({
      data: {
        opCaseId,
        code: data.code,
        description: data.description,
        type: (data.type || 'PRIMARY') as any,
      },
    });

    await this.auditService.log({
      actorId: undefined,
      actorType: 'user',
      patientId: opCase.patientId,
      action: 'DIAGNOSIS_CREATED',
      entityType: 'Diagnosis',
      entityId: diagnosis.id,
      result: 'SUCCESS',
      metadata: { opCaseId, code: data.code, description: data.description },
    });

    return diagnosis;
  }

  async updateDiagnosis(diagnosisId: string, data: { code?: string; description?: string; type?: 'PRIMARY' | 'SECONDARY' }) {
    const diagnosis = await this.prisma.diagnosis.findUnique({ where: { id: diagnosisId } });
    if (!diagnosis) throw new NotFoundException('Diagnosis not found');

    return this.prisma.diagnosis.update({
      where: { id: diagnosisId },
      data: {
        code: data.code,
        description: data.description,
        type: data.type as any,
      },
    });
  }

  async deleteDiagnosis(diagnosisId: string) {
    const diagnosis = await this.prisma.diagnosis.findUnique({ where: { id: diagnosisId } });
    if (!diagnosis) throw new NotFoundException('Diagnosis not found');
    await this.prisma.diagnosis.delete({ where: { id: diagnosisId } });
    return { message: 'Diagnosis deleted successfully' };
  }

  // ---------------------------------------------------------------------------
  // CLINICAL NOTE
  // ---------------------------------------------------------------------------

  async addClinicalNote(opCaseId: string, data: AddClinicalNoteInput) {
    const opCase = await this.prisma.opCase.findUnique({ where: { id: opCaseId } });
    if (!opCase) throw new NotFoundException('OP case not found');

    const note = await this.prisma.clinicalNote.create({
      data: {
        opCaseId,
        content: data.content,
        createdBy: data.createdBy,
      },
    });

    await this.auditService.log({
      actorId: data.createdBy,
      actorType: 'user',
      patientId: opCase.patientId,
      action: 'CLINICAL_NOTE_CREATED',
      entityType: 'ClinicalNote',
      entityId: note.id,
      result: 'SUCCESS',
      metadata: { opCaseId },
    });

    return note;
  }

  // ---------------------------------------------------------------------------
  // PRESCRIPTION
  // ---------------------------------------------------------------------------

  async addPrescription(opCaseId: string, data: AddPrescriptionInput) {
    const opCase = await this.prisma.opCase.findUnique({ where: { id: opCaseId } });
    if (!opCase) throw new NotFoundException('OP case not found');

    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('At least one prescription item is required');
    }

    const prescription = await this.prisma.prescription.create({
      data: {
        opCaseId,
        notes: data.notes,
        createdBy: data.createdBy,
        items: {
          create: data.items.map((item) => ({
            drugName: item.drugName,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            instructions: item.instructions,
          })),
        },
      },
      include: { items: true },
    });

    await this.auditService.log({
      actorId: data.createdBy,
      actorType: 'user',
      patientId: opCase.patientId,
      action: 'PRESCRIPTION_CREATED',
      entityType: 'Prescription',
      entityId: prescription.id,
      result: 'SUCCESS',
      metadata: { opCaseId, itemCount: data.items.length },
    });

    await this.addTimelineEvent({
      patientId: opCase.patientId,
      eventType: 'PRESCRIPTION',
      referenceId: prescription.id,
      title: 'Prescription Issued',
      description: `${data.items.length} medication(s) prescribed.`,
      metadata: { opCaseId, prescriptionId: prescription.id },
    });

    return prescription;
  }

  async getPrescription(prescriptionId: string) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: { items: true },
    });
    if (!prescription) throw new NotFoundException('Prescription not found');
    return prescription;
  }

  // ---------------------------------------------------------------------------
  // FOLLOW-UP
  // ---------------------------------------------------------------------------

  async addFollowUp(opCaseId: string, data: AddFollowUpInput) {
    const opCase = await this.prisma.opCase.findUnique({ where: { id: opCaseId } });
    if (!opCase) throw new NotFoundException('OP case not found');

    const dueDate = new Date(data.dueDate);
    if (isNaN(dueDate.getTime())) throw new BadRequestException('Invalid due date');

    const followUp = await this.prisma.followUp.create({
      data: {
        opCaseId,
        dueDate,
        reason: data.reason,
        status: 'PENDING',
      },
    });

    await this.auditService.log({
      actorId: undefined,
      actorType: 'user',
      patientId: opCase.patientId,
      action: 'FOLLOWUP_CREATED',
      entityType: 'FollowUp',
      entityId: followUp.id,
      result: 'SUCCESS',
      metadata: { opCaseId, dueDate: dueDate.toISOString() },
    });

    await this.addTimelineEvent({
      patientId: opCase.patientId,
      eventType: 'OTHER',
      referenceId: followUp.id,
      title: 'Follow-up Scheduled',
      description: data.reason || `Follow-up due ${dueDate.toLocaleDateString()}.`,
      occurredAt: dueDate,
      metadata: { opCaseId, followUpId: followUp.id },
    });

    return followUp;
  }

  async updateFollowUp(followUpId: string, data: { dueDate?: Date | string; reason?: string; status?: 'PENDING' | 'COMPLETED' | 'CANCELLED' }) {
    const followUp = await this.prisma.followUp.findUnique({ where: { id: followUpId } });
    if (!followUp) throw new NotFoundException('Follow-up not found');

    return this.prisma.followUp.update({
      where: { id: followUpId },
      data: {
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        reason: data.reason,
        status: data.status as any,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // ICD-10 search
  // ---------------------------------------------------------------------------

  async searchIcd10(query: string, limit = 20) {
    return searchIcd10(query, limit);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async billConsultation(opCaseId: string, clinicId: string, data: {
    unitPrice: number;
    paymentMethod?: CreateOpCaseInput['paymentMethod'];
    paymentReference?: string;
    createdBy?: string;
  }) {
    if (data.unitPrice <= 0) {
      throw new BadRequestException('Consultation fee must be greater than 0');
    }

    const opCase = await this.findById(opCaseId, clinicId);
    const alreadyBilled = await this.prisma.invoiceItem.findFirst({
      where: {
        billableType: 'OP_VISIT',
        referenceId: opCase.id,
        invoice: { clinicId, status: { not: 'CANCELLED' } },
      },
      select: { id: true },
    });
    if (alreadyBilled) {
      throw new BadRequestException('This OP visit already has a consultation invoice');
    }

    return this.billingService.createInvoice({
      clinicId,
      patientId: opCase.patientId,
      notes: `Consultation fee — OP ${opCase.id}`,
      createdBy: data.createdBy,
      items: [
        {
          billableType: 'OP_VISIT',
          referenceId: opCase.id,
          description: opCase.chiefComplaint
            ? `Consultation fee — ${opCase.chiefComplaint}`
            : 'Consultation fee',
          quantity: 1,
          unitPrice: data.unitPrice,
        },
      ],
      payment: data.paymentMethod
        ? {
            method: data.paymentMethod,
            amount: data.unitPrice,
            reference: data.paymentReference,
          }
        : undefined,
    });
  }

  private opCaseInclude() {
    return {
      patient: {
        select: {
          id: true,
          name: true,
          patientNumber: true,
          phone: true,
          email: true,
          gender: true,
          dateOfBirth: true,
          address: true,
        },
      },
      provider: { select: { id: true, name: true, staffType: true } },
      visits: { orderBy: { visitedAt: 'desc' } },
      diagnoses: { orderBy: { type: 'asc' } },
      notes: { orderBy: { createdAt: 'desc' } },
      prescriptions: { orderBy: { createdAt: 'desc' }, include: { items: true } },
      followUps: { orderBy: { dueDate: 'asc' } },
    };
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
