export type TherapyCaseStatus = 'ACTIVE' | 'COMPLETED' | 'DISCONTINUED';
export type SessionFrequency =
  | 'WEEKLY'
  | 'TWICE_WEEKLY'
  | 'THREE_TIMES_WEEKLY'
  | 'DAILY'
  | 'EVERY_TWO_WEEKS'
  | 'MONTHLY'
  | 'CUSTOM';
export type TherapySessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED' | 'NO_SHOW';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'CANCELLED' | 'RESCHEDULED' | 'LATE';

export interface PatientRef {
  id: string;
  name: string;
  patientNumber: string;
  phone?: string;
}

export interface StaffRef {
  id: string;
  name: string;
  staffType?: string;
}

export interface TherapyType {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface TherapyPackage {
  id: string;
  therapyTypeId: string;
  name: string;
  totalSessions: number;
  frequency: SessionFrequency;
  price: number | string;
  validityDays?: number;
  isActive: boolean;
  therapyType?: TherapyType;
}

export interface PatientPackage {
  id: string;
  patientId: string;
  therapyCaseId: string;
  packageId: string;
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  expiryDate?: string;
  purchasedAt: string;
  package?: TherapyPackage;
}

export interface TherapyAttendance {
  id: string;
  sessionId: string;
  status: AttendanceStatus;
  markedAt: string;
}

export interface TherapyNote {
  id: string;
  sessionId: string;
  therapistId: string;
  authoredById?: string;
  subjective?: string;
  objective?: string;
  activities?: string;
  observations?: string;
  progress?: string;
  challenges?: string;
  nextPlan?: string;
  isAiDraft: boolean;
  aiReviewed: boolean;
  createdAt: string;
  authoredBy?: StaffRef;
  therapist?: StaffRef;
}

export interface TherapySession {
  id: string;
  therapyCaseId: string;
  patientPackageId?: string;
  therapistId: string;
  doctorId?: string | null;
  scheduledAt: string;
  status: TherapySessionStatus;
  therapist?: StaffRef;
  doctor?: StaffRef | null;
  attendance?: TherapyAttendance | null;
  notes?: TherapyNote[];
  patientPackage?: PatientPackage | null;
  noteRequired?: boolean;
  therapyCase?: {
    id: string;
    title: string;
    patientId: string;
    patient?: PatientRef;
  };
  _count?: { notes: number };
}

export interface TherapyProgress {
  id: string;
  therapyCaseId: string;
  recordedAt: string;
  metric: string;
  value?: number | string;
  note?: string;
}

export interface TherapyAiSummary {
  id: string;
  therapyCaseId: string;
  content: string;
  isReviewed: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface TherapyCase {
  id: string;
  patientId: string;
  therapistId: string;
  title: string;
  assessment?: string;
  goals?: unknown;
  status: TherapyCaseStatus;
  createdAt: string;
  updatedAt: string;
  patient?: PatientRef;
  therapist?: StaffRef;
  packages?: PatientPackage[];
  sessions?: TherapySession[];
  progress?: TherapyProgress[];
  aiSummaries?: TherapyAiSummary[];
  pendingDoctorNotes?: Array<{
    sessionId: string;
    scheduledAt: string;
    doctorId: string;
    doctor?: StaffRef | null;
  }>;
  _count?: { sessions: number; packages: number };
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface TherapyFilters {
  page?: number;
  limit?: number;
  search?: string;
  therapistId?: string;
  status?: string;
}
