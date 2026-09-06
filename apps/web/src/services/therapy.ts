import type {
  TherapyCase,
  TherapyPackage,
  TherapyType,
  TherapySession,
  TherapyNote,
  TherapyProgress,
  TherapyAiSummary,
  PatientPackage,
  Paginated,
  TherapyFilters,
  SessionFrequency,
  AttendanceStatus,
} from '../types/therapy';
import { fetchApi, getAccessToken } from '../lib/api';

export const therapyApi = {
  async getCases(filters?: TherapyFilters): Promise<Paginated<TherapyCase>> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.search) params.append('search', filters.search);
    if (filters?.therapistId) params.append('therapistId', filters.therapistId);
    if (filters?.status) params.append('status', filters.status);
    return fetchApi(`/therapy/cases?${params.toString()}`);
  },

  async getCase(id: string): Promise<TherapyCase> {
    return fetchApi(`/therapy/cases/${id}`);
  },

  async createCase(data: {
    patientId: string;
    therapistId: string;
    title: string;
    assessment?: string;
    goals?: unknown;
    opCaseId?: string;
  }): Promise<TherapyCase> {
    return fetchApi('/therapy/cases', { method: 'POST', body: JSON.stringify(data) });
  },

  async updateCase(id: string, data: {
    title?: string;
    assessment?: string;
    goals?: unknown;
    status?: 'ACTIVE' | 'COMPLETED' | 'DISCONTINUED';
  }): Promise<TherapyCase> {
    return fetchApi(`/therapy/cases/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  async getTypes(): Promise<TherapyType[]> {
    return fetchApi('/therapy/types');
  },

  async getPackages(): Promise<Paginated<TherapyPackage>> {
    return fetchApi('/therapy/packages?limit=100');
  },

  async createPackage(data: {
    therapyTypeId: string;
    name: string;
    totalSessions: number;
    frequency: SessionFrequency;
    price: number;
    validityDays?: number;
  }): Promise<TherapyPackage> {
    return fetchApi('/therapy/packages', { method: 'POST', body: JSON.stringify(data) });
  },

  async assignPackage(caseId: string, data: { packageId: string; startDate?: string }): Promise<PatientPackage> {
    return fetchApi(`/therapy/cases/${caseId}/packages`, { method: 'POST', body: JSON.stringify(data) });
  },

  async getSessions(filters?: {
    therapyCaseId?: string;
    therapistId?: string;
    doctorId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<Paginated<TherapySession>> {
    const params = new URLSearchParams();
    if (filters?.therapyCaseId) params.append('therapyCaseId', filters.therapyCaseId);
    if (filters?.therapistId) params.append('therapistId', filters.therapistId);
    if (filters?.doctorId) params.append('doctorId', filters.doctorId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));
    return fetchApi(`/therapy/sessions?${params.toString()}`);
  },

  async getSession(id: string): Promise<TherapySession> {
    return fetchApi(`/therapy/sessions/${id}`);
  },

  async assignSession(sessionId: string, doctorId: string): Promise<TherapySession> {
    return fetchApi(`/therapy/sessions/${sessionId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ doctorId }),
    });
  },

  async markAttendance(sessionId: string, status: AttendanceStatus, unitPrice?: number): Promise<TherapySession> {
    return fetchApi(`/therapy/sessions/${sessionId}/attendance`, {
      method: 'PATCH',
      body: JSON.stringify({ status, unitPrice }),
    });
  },

  async rescheduleSession(sessionId: string, scheduledAt: string, note?: string) {
    return fetchApi(`/therapy/sessions/${sessionId}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify({ scheduledAt, note }),
    });
  },

  async addNote(sessionId: string, data: Partial<TherapyNote>): Promise<TherapyNote> {
    return fetchApi(`/therapy/sessions/${sessionId}/notes`, { method: 'POST', body: JSON.stringify(data) });
  },

  async listMyDoctorSessions(): Promise<TherapySession[]> {
    return fetchApi('/therapy/doctor/sessions');
  },

  async getDoctorSessionWorkspace(sessionId: string): Promise<{
    session: TherapySession;
    therapyCase: {
      id: string;
      title: string;
      patientId: string;
      patient?: { id: string; name: string; patientNumber: string; phone?: string };
      therapist?: { id: string; name: string; staffType?: string };
      assessment?: string;
      status: string;
    };
    priorNotes: Array<TherapyNote & {
      scheduledAt: string;
      sessionDoctor?: { id: string; name: string; staffType?: string } | null;
    }>;
    aiSummaries: TherapyAiSummary[];
  }> {
    return fetchApi(`/therapy/doctor/sessions/${sessionId}`);
  },

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
    },
  ): Promise<TherapySession & { note?: TherapyNote | null; outcome: string }> {
    return fetchApi(`/therapy/doctor/sessions/${sessionId}/outcome`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async addVoiceNote(sessionId: string, audio: Blob, languageCode?: string) {
    const token = getAccessToken();
    const form = new FormData();
    form.append('file', audio, 'voice-note.webm');
    const params = languageCode ? `?languageCode=${encodeURIComponent(languageCode)}` : '';
    const response = await fetch(`${API_BASE}/therapy/sessions/${sessionId}/voice-note${params}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: 'include',
      body: form,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Transcription failed' }));
      throw new Error(error.message || error.detail || `HTTP error ${response.status}`);
    }
    return response.json();
  },

  async updateNote(noteId: string, data: Partial<TherapyNote> & { aiReviewed?: boolean }): Promise<TherapyNote> {
    return fetchApi(`/therapy/notes/${noteId}`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  async addProgress(caseId: string, data: { metric: string; value?: number; note?: string }): Promise<TherapyProgress> {
    return fetchApi(`/therapy/cases/${caseId}/progress`, { method: 'POST', body: JSON.stringify(data) });
  },

  async generateSummary(caseId: string): Promise<TherapyAiSummary> {
    return fetchApi(`/therapy/cases/${caseId}/summary`, { method: 'POST' });
  },

  async reviewSummary(summaryId: string, approved: boolean): Promise<TherapyAiSummary> {
    return fetchApi(`/therapy/summaries/${summaryId}/review`, {
      method: 'POST',
      body: JSON.stringify({ approved }),
    });
  },

  async getTherapists(): Promise<{ id: string; name: string; staffType?: string }[]> {
    // Doctors own therapy cases (no separate therapist role)
    return this.getSessionDoctors();
  },

  async getSessionDoctors(): Promise<{ id: string; name: string; staffType?: string }[]> {
    const response = await fetchApi<{ data: any[] }>('/staff?isProvider=true&limit=100');
    return (response.data || []).filter((p) => p.staffType === 'DOCTOR');
  },
};
