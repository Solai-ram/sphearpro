/**
 * Shared Types — HIS-Lite
 * Common types used by both frontend (apps/web) and backend (apps/api)
 * Generated from prisma/schema.prisma enums and core entities
 */

// ============================================================================
// Enums (matching Prisma schema)
// ============================================================================

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  INACTIVE = 'INACTIVE',
}

export enum StaffType {
  ADMIN = 'ADMIN',
  DOCTOR = 'DOCTOR',
  THERAPIST = 'THERAPIST',
  RECEPTIONIST = 'RECEPTIONIST',
  BILLING = 'BILLING',
  INVENTORY = 'INVENTORY',
  OTHER = 'OTHER',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  UNKNOWN = 'UNKNOWN',
}

export enum AppointmentStatus {
  BOOKED = 'BOOKED',
  CHECKED_IN = 'CHECKED_IN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
  RESCHEDULED = 'RESCHEDULED',
}

export enum QueueStatus {
  WAITING = 'WAITING',
  CALLED = 'CALLED',
  IN_CONSULTATION = 'IN_CONSULTATION',
  COMPLETED = 'COMPLETED',
  LEFT = 'LEFT',
}

export enum OpCaseStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum DiagnosisType {
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
}

export enum FollowUpStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TherapyCaseStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  DISCONTINUED = 'DISCONTINUED',
}

export enum SessionFrequency {
  WEEKLY = 'WEEKLY',
  TWICE_WEEKLY = 'TWICE_WEEKLY',
  THREE_TIMES_WEEKLY = 'THREE_TIMES_WEEKLY',
  DAILY = 'DAILY',
  EVERY_TWO_WEEKS = 'EVERY_TWO_WEEKS',
  MONTHLY = 'MONTHLY',
  CUSTOM = 'CUSTOM',
}

export enum TherapySessionStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  RESCHEDULED = 'RESCHEDULED',
  NO_SHOW = 'NO_SHOW',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  CANCELLED = 'CANCELLED',
  RESCHEDULED = 'RESCHEDULED',
  LATE = 'LATE',
}

export enum InvoiceStatus {
  PENDING = 'PENDING',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
}

export enum BillableType {
  OP_VISIT = 'OP_VISIT',
  THERAPY_PACKAGE = 'THERAPY_PACKAGE',
  THERAPY_SESSION = 'THERAPY_SESSION',
  PRODUCT = 'PRODUCT',
  OTHER = 'OTHER',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  UPI = 'UPI',
  NET_BANKING = 'NET_BANKING',
  WALLET = 'WALLET',
  OTHER = 'OTHER',
}

export enum PaymentStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
  REFUNDED = 'REFUNDED',
}

export enum RefundStatus {
  PROCESSED = 'PROCESSED',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
}

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

export enum StockTxnType {
  PURCHASE = 'PURCHASE',
  SALE = 'SALE',
  RETURN = 'RETURN',
  DAMAGE = 'DAMAGE',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum DocCategory {
  AUDIOGRAM = 'AUDIOGRAM',
  LAB_REPORT = 'LAB_REPORT',
  PRESCRIPTION = 'PRESCRIPTION',
  REFERRAL = 'REFERRAL',
  THERAPY_ASSESSMENT = 'THERAPY_ASSESSMENT',
  SCANNED = 'SCANNED',
  OTHER = 'OTHER',
}

export enum MessageType {
  APPOINTMENT_REMINDER = 'APPOINTMENT_REMINDER',
  THERAPY_REMINDER = 'THERAPY_REMINDER',
  PAYMENT_RECEIPT = 'PAYMENT_RECEIPT',
  INVOICE = 'INVOICE',
  GENERIC = 'GENERIC',
}

export enum Channel {
  WHATSAPP = 'WHATSAPP',
  SMS = 'SMS',
  EMAIL = 'EMAIL',
}

export enum MessageStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

export enum AiRequestType {
  THERAPY_SUMMARY = 'THERAPY_SUMMARY',
  VOICE_TRANSCRIPTION = 'VOICE_TRANSCRIPTION',
  NOTE_DRAFT = 'NOTE_DRAFT',
  PROGRESS_SUMMARY = 'PROGRESS_SUMMARY',
}

export enum AiRequestStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum WidgetCategory {
  PATIENT = 'PATIENT',
  OPERATIONS = 'OPERATIONS',
  THERAPY = 'THERAPY',
  FINANCE = 'FINANCE',
  INVENTORY = 'INVENTORY',
  COMMUNICATION = 'COMMUNICATION',
  AI = 'AI',
}

export enum TimelineEventType {
  APPOINTMENT = 'APPOINTMENT',
  OP_VISIT = 'OP_VISIT',
  THERAPY_SESSION = 'THERAPY_SESSION',
  ATTENDANCE = 'ATTENDANCE',
  THERAPY_NOTE = 'THERAPY_NOTE',
  PRESCRIPTION = 'PRESCRIPTION',
  DOCUMENT = 'DOCUMENT',
  INVOICE = 'INVOICE',
  PAYMENT = 'PAYMENT',
  OTHER = 'OTHER',
}

// ============================================================================
// Core Entity Types (simplified for API contracts)
// ============================================================================

export interface BaseEntity {
  id: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface User extends BaseEntity {
  username: string | null;
  email: string;
  mobile: string | null;
  name: string;
  status: UserStatus;
  staffType: StaffType | null;
  lastLoginAt: string | null;
}

export interface Role extends BaseEntity {
  name: string;
  description: string | null;
  isSystem: boolean;
}

export interface Permission extends BaseEntity {
  name: string;
  module: string;
  action: string;
  description: string | null;
}

export interface Patient extends BaseEntity {
  patientNumber: string;
  name: string;
  dateOfBirth: string | null;
  gender: Gender | null;
  phone: string | null;
  alternatePhone: string | null;
  email: string | null;
  address: Address | null;
  emergencyContact: EmergencyContact | null;
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface PatientTimelineEvent extends BaseEntity {
  patientId: string;
  eventType: TimelineEventType;
  referenceId: string;
  title: string;
  description: string | null;
  occurredAt: string;
  metadata: Record<string, unknown> | null;
}

export interface StaffProfile extends BaseEntity {
  userId: string | null;
  name: string;
  staffType: StaffType;
  specialization: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  isProvider: boolean;
}

export interface ProviderSchedule extends BaseEntity {
  staffId: string;
  dayOfWeek: number; // 0-6
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  isAvailable: boolean;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
}

export interface IdempotencyKey {
  key: string;
}

// ============================================================================
// Form/Input Types (for React Hook Form + Zod)
// ============================================================================

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterPatientInput {
  name: string;
  dateOfBirth?: string;
  gender?: Gender;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  address?: Address;
  emergencyContact?: EmergencyContact;
}

export interface AppointmentInput {
  patientId: string;
  providerId: string;
  appointmentAt: string;
  durationMin?: number;
  reason?: string;
}

export interface InvoiceItemInput {
  billableType: BillableType;
  referenceId?: string;
  description: string;
  quantity?: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// ============================================================================
// Constants
// ============================================================================

export const MODULES = [
  'auth',
  'users',
  'roles',
  'permissions',
  'patients',
  'staff',
  'appointments',
  'reception',
  'clinical',
  'therapy',
  'billing',
  'inventory',
  'documents',
  'communication',
  'ai',
  'dashboard',
  'reports',
  'audit',
  'settings',
] as const;

export type Module = (typeof MODULES)[number];

export const ACTIONS = ['view', 'create', 'edit', 'delete', 'manage', 'export', 'review'] as const;

export type Action = (typeof ACTIONS)[number];

export function permissionName(module: Module, action: Action): string {
  return `${module}.${action}`;
}