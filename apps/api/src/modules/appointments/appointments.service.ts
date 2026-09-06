import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function padTime(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Injectable()
export class AppointmentsService {
  constructor(
    @Inject('PRISMA_CLIENT') private prisma: any,
    private auditService: AuditService,
  ) {}

  async listSlotTemplates(clinicId: string, activeOnly = false) {
    return this.prisma.appointmentSlotTemplate.findMany({
      where: { clinicId, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { startTime: 'asc' }],
    });
  }

  async createSlotTemplate(data: {
    label?: string;
    startTime: string;
    endTime: string;
    sortOrder?: number;
    isActive?: boolean;
    createdBy?: string;
    clinicId: string;
  }) {
    this.assertTimes(data.startTime, data.endTime);
    const max = await this.prisma.appointmentSlotTemplate.aggregate({
      where: { clinicId: data.clinicId },
      _max: { sortOrder: true },
    });
    const created = await this.prisma.appointmentSlotTemplate.create({
      data: {
        clinicId: data.clinicId,
        label: data.label || `${data.startTime}–${data.endTime}`,
        startTime: data.startTime,
        endTime: data.endTime,
        sortOrder: data.sortOrder ?? (max._max.sortOrder || 0) + 1,
        isActive: data.isActive ?? true,
      },
    });
    await this.auditService.log({
      clinicId: data.clinicId,
      actorId: data.createdBy,
      actorType: 'user',
      action: 'APPOINTMENT_SLOT_CREATED',
      entityType: 'AppointmentSlotTemplate',
      entityId: created.id,
      result: 'SUCCESS',
      metadata: { startTime: created.startTime, endTime: created.endTime },
    });
    return created;
  }

  async updateSlotTemplate(
    id: string,
    clinicId: string,
    data: {
      label?: string;
      startTime?: string;
      endTime?: string;
      sortOrder?: number;
      isActive?: boolean;
      updatedBy?: string;
    },
  ) {
    const existing = await this.prisma.appointmentSlotTemplate.findFirst({ where: { id, clinicId } });
    if (!existing) throw new NotFoundException('Slot template not found');
    const startTime = data.startTime ?? existing.startTime;
    const endTime = data.endTime ?? existing.endTime;
    this.assertTimes(startTime, endTime);
    const updated = await this.prisma.appointmentSlotTemplate.update({
      where: { id },
      data: {
        label: data.label ?? existing.label,
        startTime,
        endTime,
        sortOrder: data.sortOrder ?? existing.sortOrder,
        isActive: data.isActive ?? existing.isActive,
      },
    });
    await this.auditService.log({
      clinicId,
      actorId: data.updatedBy,
      actorType: 'user',
      action: 'APPOINTMENT_SLOT_UPDATED',
      entityType: 'AppointmentSlotTemplate',
      entityId: id,
      result: 'SUCCESS',
    });
    return updated;
  }

  async deleteSlotTemplate(id: string, clinicId: string, deletedBy?: string) {
    const existing = await this.prisma.appointmentSlotTemplate.findFirst({ where: { id, clinicId } });
    if (!existing) throw new NotFoundException('Slot template not found');
    await this.prisma.appointmentSlotTemplate.delete({ where: { id } });
    await this.auditService.log({
      clinicId,
      actorId: deletedBy,
      actorType: 'user',
      action: 'APPOINTMENT_SLOT_DELETED',
      entityType: 'AppointmentSlotTemplate',
      entityId: id,
      result: 'SUCCESS',
    });
    return { message: 'Slot deleted' };
  }

  /** Free clinic slots for a doctor on a calendar day (respects schedule + booked sessions). */
  async getDoctorAvailability(doctorId: string, dateYmd: string, clinicId: string, excludeSessionId?: string) {
    const doctor = await this.prisma.staffProfile.findFirst({ where: { id: doctorId, clinicId } });
    if (!doctor) throw new NotFoundException('Doctor not found');
    if (doctor.staffType !== 'DOCTOR') throw new BadRequestException('Staff must be a doctor');

    const day = new Date(`${dateYmd}T12:00:00`);
    if (isNaN(day.getTime())) throw new BadRequestException('Invalid date');
    const dayOfWeek = day.getDay();

    const schedules = await this.prisma.providerSchedule.findMany({
      where: { staffId: doctorId, dayOfWeek, isAvailable: true },
    });

    // Default clinic hours when no schedule rows exist
    const windows =
      schedules.length > 0
        ? schedules.map((s: any) => ({ start: toMin(s.startTime), end: toMin(s.endTime) }))
        : [{ start: toMin('09:00'), end: toMin('17:15') }];

    const templates = await this.listSlotTemplates(clinicId, true);
    const dayStart = new Date(`${dateYmd}T00:00:00`);
    const dayEnd = new Date(`${dateYmd}T23:59:59.999`);

    const booked = await this.prisma.therapySession.findMany({
      where: {
        clinicId,
        doctorId,
        status: { in: ['SCHEDULED', 'COMPLETED'] },
        scheduledAt: { gte: dayStart, lte: dayEnd },
        ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
      },
      select: { id: true, scheduledAt: true },
    });

    const bookedStarts = new Set(
      booked.map((b: any) => {
        const d = new Date(b.scheduledAt);
        return padTime(d.getHours() * 60 + d.getMinutes());
      }),
    );

    const slots = templates
      .filter((t: any) => {
        const start = toMin(t.startTime);
        const end = toMin(t.endTime);
        const inWindow = windows.some((w: any) => start >= w.start && end <= w.end);
        if (!inWindow) return false;
        if (bookedStarts.has(t.startTime)) return false;
        return true;
      })
      .map((t: any) => ({
        templateId: t.id,
        label: t.label || `${t.startTime}–${t.endTime}`,
        startTime: t.startTime,
        endTime: t.endTime,
        scheduledAt: `${dateYmd}T${t.startTime}:00`,
        available: true,
      }));

    return {
      doctor: { id: doctor.id, name: doctor.name },
      date: dateYmd,
      dayOfWeek,
      slots,
    };
  }

  async getDayBoard(dateYmd: string, clinicId: string) {
    const dayStart = new Date(`${dateYmd}T00:00:00`);
    const dayEnd = new Date(`${dateYmd}T23:59:59.999`);
    if (isNaN(dayStart.getTime())) throw new BadRequestException('Invalid date');

    const [doctors, templates, sessions] = await Promise.all([
      this.prisma.staffProfile.findMany({
        where: { clinicId, staffType: 'DOCTOR', isProvider: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, specialization: true },
      }),
      this.listSlotTemplates(clinicId, true),
      this.prisma.therapySession.findMany({
        where: {
          clinicId,
          scheduledAt: { gte: dayStart, lte: dayEnd },
          status: { not: 'CANCELLED' },
        },
        orderBy: { scheduledAt: 'asc' },
        include: {
          doctor: { select: { id: true, name: true } },
          therapist: { select: { id: true, name: true } },
          therapyCase: {
            select: {
              id: true,
              title: true,
              patientId: true,
              patient: { select: { id: true, name: true, patientNumber: true } },
            },
          },
        },
      }),
    ]);

    return {
      date: dateYmd,
      dayOfWeek: dayStart.getDay(),
      doctors,
      slotTemplates: templates,
      sessions,
    };
  }

  private assertTimes(startTime: string, endTime: string) {
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      throw new BadRequestException('Times must be HH:MM');
    }
    if (toMin(endTime) <= toMin(startTime)) {
      throw new BadRequestException('endTime must be after startTime');
    }
  }
}
