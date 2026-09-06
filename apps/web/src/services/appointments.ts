import type { AttendanceStatus, TherapySession } from '../types/therapy';
import { therapyApi } from './therapy';
import { fetchApi } from '../lib/api';

/** Therapy session shaped as a clinic appointment (therapy visits only). */
export type Appointment = TherapySession;

export type AppointmentFilters = {
  therapyCaseId?: string;
  therapistId?: string;
  doctorId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export type SlotTemplate = {
  id: string;
  label?: string | null;
  startTime: string;
  endTime: string;
  sortOrder: number;
  isActive: boolean;
};

export type AvailableSlot = {
  templateId: string;
  label: string;
  startTime: string;
  endTime: string;
  scheduledAt: string;
  available: boolean;
};

export type DayBoard = {
  date: string;
  dayOfWeek: number;
  doctors: { id: string; name: string; specialization?: string }[];
  slotTemplates: SlotTemplate[];
  sessions: TherapySession[];
};

export type ProviderScheduleRow = {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
};

export const appointmentsApi = {
  list(filters?: AppointmentFilters) {
    return therapyApi.getSessions(filters);
  },

  getById(id: string) {
    return therapyApi.getSession(id);
  },

  assignDoctor(id: string, doctorId: string, scheduledAt?: string) {
    return fetchApi<TherapySession>(`/therapy/sessions/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ doctorId, scheduledAt }),
    });
  },

  reschedule(id: string, scheduledAt: string, note?: string) {
    return therapyApi.rescheduleSession(id, scheduledAt, note);
  },

  markAttendance(id: string, status: AttendanceStatus) {
    return therapyApi.markAttendance(id, status);
  },

  getDoctors() {
    return therapyApi.getSessionDoctors();
  },

  addSlot(therapyCaseId: string, data: { scheduledAt: string; doctorId?: string; patientPackageId?: string }) {
    return fetchApi<TherapySession>(`/therapy/cases/${therapyCaseId}/sessions/manual`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  listSlots(activeOnly = false) {
    const q = activeOnly ? '?activeOnly=true' : '';
    return fetchApi<SlotTemplate[]>(`/appointments/slots${q}`);
  },

  createSlot(data: { label?: string; startTime: string; endTime: string; sortOrder?: number; isActive?: boolean }) {
    return fetchApi<SlotTemplate>('/appointments/slots', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateSlot(id: string, data: Partial<{ label: string; startTime: string; endTime: string; sortOrder: number; isActive: boolean }>) {
    return fetchApi<SlotTemplate>(`/appointments/slots/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteSlot(id: string) {
    return fetchApi<{ message: string }>(`/appointments/slots/${id}`, { method: 'DELETE' });
  },

  availability(doctorId: string, date: string, excludeSessionId?: string) {
    const params = new URLSearchParams({ doctorId, date });
    if (excludeSessionId) params.set('excludeSessionId', excludeSessionId);
    return fetchApi<{
      doctor: { id: string; name: string };
      date: string;
      slots: AvailableSlot[];
    }>(`/appointments/availability?${params.toString()}`);
  },

  dayBoard(date: string) {
    return fetchApi<DayBoard>(`/appointments/day-board?date=${encodeURIComponent(date)}`);
  },

  getDoctorSchedule(staffId: string) {
    return fetchApi<ProviderScheduleRow[]>(`/staff/${staffId}/schedule`);
  },

  setDoctorSchedule(staffId: string, schedules: Omit<ProviderScheduleRow, 'id'>[]) {
    return fetchApi<ProviderScheduleRow[]>(`/staff/${staffId}/schedule`, {
      method: 'PATCH',
      body: JSON.stringify({ schedules }),
    });
  },
};
