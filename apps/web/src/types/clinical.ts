// Clinical types - mirrors backend Prisma schema & DTOs

export type OpCaseStatus = 'OPEN' | 'CLOSED';

export interface PatientRef {
  id: string;
  name: string;
  patientNumber: string;
  phone?: string;
  email?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: Record<string, string>;
}

export interface ProviderRef {
  id: string;
  name: string;
  staffType?: string;
}

export interface OpVisit {
  id: string;
  opCaseId: string;
  visitedAt: string;
  notes?: string;
}

export interface Diagnosis {
  id: string;
  opCaseId: string;
  code?: string;
  description: string;
  type: 'PRIMARY' | 'SECONDARY';
}

export interface ClinicalNote {
  id: string;
  opCaseId: string;
  content: string;
  createdAt: string;
  createdBy?: string;
}

export interface PrescriptionItem {
  id: string;
  prescriptionId: string;
  drugName: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface Prescription {
  id: string;
  opCaseId: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
  items: PrescriptionItem[];
}

export interface FollowUp {
  id: string;
  opCaseId: string;
  dueDate: string;
  reason?: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
}

export interface OpCase {
  id: string;
  patientId: string;
  providerId?: string | null;
  chiefComplaint?: string;
  vitals?: Record<string, any>;
  status: OpCaseStatus;
  createdAt: string;
  updatedAt: string;
  patient?: PatientRef;
  provider?: ProviderRef;
  visits?: OpVisit[];
  diagnoses?: Diagnosis[];
  notes?: ClinicalNote[];
  prescriptions?: Prescription[];
  followUps?: FollowUp[];
  _count?: {
    diagnoses: number;
    prescriptions: number;
    followUps: number;
  };
}

export interface OpCasesListResponse {
  data: OpCase[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateOpCaseInput {
  patientId: string;
  providerId?: string;
  chiefComplaint?: string;
  vitals?: Record<string, any>;
  consultationFee?: number;
  paymentMethod?: 'CASH' | 'CARD' | 'UPI' | 'NET_BANKING' | 'WALLET' | 'OTHER';
  paymentReference?: string;
}

export interface AddVisitInput {
  visitedAt?: string;
  notes?: string;
}

export interface AddDiagnosisInput {
  code?: string;
  description: string;
  type?: 'PRIMARY' | 'SECONDARY';
}

export interface AddClinicalNoteInput {
  content: string;
}

export interface AddPrescriptionItemInput {
  drugName: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface AddPrescriptionInput {
  notes?: string;
  items: AddPrescriptionItemInput[];
}

export interface AddFollowUpInput {
  dueDate: string;
  reason?: string;
}

export interface Icd10Code {
  code: string;
  description: string;
  category: string;
}

export interface ClinicalFilters {
  page?: number;
  limit?: number;
  search?: string;
  providerId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface PatientOpCasesFilters {
  page?: number;
  limit?: number;
  status?: string;
}