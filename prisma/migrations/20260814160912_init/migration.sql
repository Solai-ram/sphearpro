-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "StaffType" AS ENUM ('ADMIN', 'DOCTOR', 'THERAPIST', 'RECEPTIONIST', 'BILLING', 'INVENTORY', 'OTHER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TimelineEventType" AS ENUM ('APPOINTMENT', 'OP_VISIT', 'THERAPY_SESSION', 'ATTENDANCE', 'THERAPY_NOTE', 'PRESCRIPTION', 'DOCUMENT', 'INVOICE', 'PAYMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('BOOKED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('WAITING', 'CALLED', 'IN_CONSULTATION', 'COMPLETED', 'LEFT');

-- CreateEnum
CREATE TYPE "OpCaseStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "DiagnosisType" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TherapyCaseStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "SessionFrequency" AS ENUM ('WEEKLY', 'TWICE_WEEKLY', 'THREE_TIMES_WEEKLY', 'DAILY', 'EVERY_TWO_WEEKS', 'MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TherapySessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'CANCELLED', 'RESCHEDULED', 'LATE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillableType" AS ENUM ('OP_VISIT', 'THERAPY_PACKAGE', 'THERAPY_SESSION', 'PRODUCT', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'UPI', 'NET_BANKING', 'WALLET', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SUCCESS', 'FAILED', 'PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PROCESSED', 'PENDING', 'FAILED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "StockTxnType" AS ENUM ('PURCHASE', 'SALE', 'RETURN', 'DAMAGE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "DocCategory" AS ENUM ('AUDIOGRAM', 'LAB_REPORT', 'PRESCRIPTION', 'REFERRAL', 'THERAPY_ASSESSMENT', 'SCANNED', 'OTHER');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('APPOINTMENT_REMINDER', 'THERAPY_REMINDER', 'PAYMENT_RECEIPT', 'INVOICE', 'GENERIC');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "AiRequestType" AS ENUM ('THERAPY_SUMMARY', 'VOICE_TRANSCRIPTION', 'NOTE_DRAFT', 'PROGRESS_SUMMARY');

-- CreateEnum
CREATE TYPE "AiRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "WidgetCategory" AS ENUM ('PATIENT', 'OPERATIONS', 'THERAPY', 'FINANCE', 'INVENTORY', 'COMMUNICATION', 'AI');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT NOT NULL,
    "mobile" TEXT,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "staffType" "StaffType",
    "refreshTokenHash" TEXT,
    "resetTokenHash" TEXT,
    "resetTokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "patientNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" "Gender",
    "phone" TEXT,
    "alternatePhone" TEXT,
    "email" TEXT,
    "address" JSONB,
    "emergencyContact" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_timeline_events" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "eventType" "TimelineEventType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "patient_timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "staffType" "StaffType" NOT NULL,
    "specialization" TEXT,
    "department" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isProvider" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_schedules" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "provider_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "appointmentAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'BOOKED',
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_status_history" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" TEXT,
    "note" TEXT,

    CONSTRAINT "appointment_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_items" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT,
    "patientId" TEXT NOT NULL,
    "tokenNumber" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "QueueStatus" NOT NULL DEFAULT 'WAITING',
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "queue_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "op_cases" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "chiefComplaint" TEXT,
    "vitals" JSONB,
    "status" "OpCaseStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "op_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "op_visits" (
    "id" TEXT NOT NULL,
    "opCaseId" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "op_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnoses" (
    "id" TEXT NOT NULL,
    "opCaseId" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT NOT NULL,
    "type" "DiagnosisType" NOT NULL DEFAULT 'PRIMARY',

    CONSTRAINT "diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_notes" (
    "id" TEXT NOT NULL,
    "opCaseId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "clinical_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" TEXT NOT NULL,
    "opCaseId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "drugName" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "duration" TEXT,
    "instructions" TEXT,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" TEXT NOT NULL,
    "opCaseId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "therapy_cases" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assessment" TEXT,
    "goals" JSONB,
    "status" "TherapyCaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "therapy_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "therapy_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "therapy_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "therapy_packages" (
    "id" TEXT NOT NULL,
    "therapyTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalSessions" INTEGER NOT NULL,
    "frequency" "SessionFrequency" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "validityDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "therapy_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_packages" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "therapyCaseId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "totalSessions" INTEGER NOT NULL,
    "usedSessions" INTEGER NOT NULL DEFAULT 0,
    "expiryDate" TIMESTAMP(3),
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "therapy_sessions" (
    "id" TEXT NOT NULL,
    "therapyCaseId" TEXT NOT NULL,
    "patientPackageId" TEXT,
    "therapistId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "TherapySessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "therapy_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "therapy_attendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markedBy" TEXT,

    CONSTRAINT "therapy_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "therapy_notes" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "subjective" TEXT,
    "objective" TEXT,
    "activities" TEXT,
    "observations" TEXT,
    "progress" TEXT,
    "challenges" TEXT,
    "nextPlan" TEXT,
    "isAiDraft" BOOLEAN NOT NULL DEFAULT false,
    "aiReviewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "therapy_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "therapy_progress" (
    "id" TEXT NOT NULL,
    "therapyCaseId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metric" TEXT NOT NULL,
    "value" DECIMAL(10,2),
    "note" TEXT,

    CONSTRAINT "therapy_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "therapy_ai_summaries" (
    "id" TEXT NOT NULL,
    "therapyCaseId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isReviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "aiRequestId" TEXT,

    CONSTRAINT "therapy_ai_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discountTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "billableType" "BillableType" NOT NULL,
    "referenceId" TEXT,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'SUCCESS',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "createdBy" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'PROCESSED',
    "refundedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),

    CONSTRAINT "discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_sales" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceId" TEXT,
    "createdBy" TEXT,

    CONSTRAINT "product_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transactions" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT,
    "type" "StockTxnType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "unitCost" DECIMAL(10,2),
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "stock_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_documents" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "category" "DocCategory" NOT NULL,
    "fileName" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "patient_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_access_logs" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "accessedById" TEXT,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,

    CONSTRAINT "document_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_messages" (
    "id" TEXT NOT NULL,
    "patientId" TEXT,
    "templateId" TEXT,
    "appointmentId" TEXT,
    "invoiceId" TEXT,
    "type" "MessageType" NOT NULL,
    "channel" "Channel" NOT NULL,
    "to" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMsgId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MessageType" NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_requests" (
    "id" TEXT NOT NULL,
    "type" "AiRequestType" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "promptTokens" INTEGER,
    "inputRef" TEXT,
    "status" "AiRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_outputs" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "confidence" DECIMAL(5,2),
    "isReviewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "requestType" "AiRequestType" NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "costUsd" DECIMAL(10,6),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_provider_configs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "apiBaseUrl" TEXT,
    "defaultModel" TEXT,
    "settings" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_widgets" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "WidgetCategory" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "dashboard_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_layouts" (
    "id" TEXT NOT NULL,
    "roleId" TEXT,
    "userId" TEXT,
    "widgetId" TEXT NOT NULL,
    "positionX" INTEGER NOT NULL,
    "positionY" INTEGER NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 1,
    "height" INTEGER NOT NULL DEFAULT 1,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "dashboard_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'general',

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "patientId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "result" TEXT NOT NULL DEFAULT 'SUCCESS',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_mobile_key" ON "users"("mobile");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE INDEX "user_roles_userId_idx" ON "user_roles"("userId");

-- CreateIndex
CREATE INDEX "user_roles_roleId_idx" ON "user_roles"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");

-- CreateIndex
CREATE INDEX "role_permissions_roleId_idx" ON "role_permissions"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "user_permissions_userId_idx" ON "user_permissions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_userId_permissionId_key" ON "user_permissions"("userId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "patients_patientNumber_key" ON "patients"("patientNumber");

-- CreateIndex
CREATE UNIQUE INDEX "patients_phone_key" ON "patients"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "patients_email_key" ON "patients"("email");

-- CreateIndex
CREATE INDEX "patients_name_idx" ON "patients"("name");

-- CreateIndex
CREATE INDEX "patients_phone_idx" ON "patients"("phone");

-- CreateIndex
CREATE INDEX "patient_timeline_events_patientId_occurredAt_idx" ON "patient_timeline_events"("patientId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_userId_key" ON "staff_profiles"("userId");

-- CreateIndex
CREATE INDEX "staff_profiles_staffType_idx" ON "staff_profiles"("staffType");

-- CreateIndex
CREATE INDEX "provider_schedules_staffId_dayOfWeek_idx" ON "provider_schedules"("staffId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "appointments_patientId_idx" ON "appointments"("patientId");

-- CreateIndex
CREATE INDEX "appointments_appointmentAt_idx" ON "appointments"("appointmentAt");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_providerId_appointmentAt_key" ON "appointments"("providerId", "appointmentAt");

-- CreateIndex
CREATE INDEX "appointment_status_history_appointmentId_idx" ON "appointment_status_history"("appointmentId");

-- CreateIndex
CREATE INDEX "queue_items_status_position_idx" ON "queue_items"("status", "position");

-- CreateIndex
CREATE INDEX "op_cases_patientId_idx" ON "op_cases"("patientId");

-- CreateIndex
CREATE INDEX "op_visits_opCaseId_idx" ON "op_visits"("opCaseId");

-- CreateIndex
CREATE INDEX "diagnoses_opCaseId_idx" ON "diagnoses"("opCaseId");

-- CreateIndex
CREATE INDEX "clinical_notes_opCaseId_idx" ON "clinical_notes"("opCaseId");

-- CreateIndex
CREATE INDEX "prescriptions_opCaseId_idx" ON "prescriptions"("opCaseId");

-- CreateIndex
CREATE INDEX "prescription_items_prescriptionId_idx" ON "prescription_items"("prescriptionId");

-- CreateIndex
CREATE INDEX "follow_ups_opCaseId_dueDate_idx" ON "follow_ups"("opCaseId", "dueDate");

-- CreateIndex
CREATE INDEX "therapy_cases_patientId_idx" ON "therapy_cases"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "therapy_types_name_key" ON "therapy_types"("name");

-- CreateIndex
CREATE INDEX "therapy_packages_therapyTypeId_idx" ON "therapy_packages"("therapyTypeId");

-- CreateIndex
CREATE INDEX "patient_packages_patientId_therapyCaseId_idx" ON "patient_packages"("patientId", "therapyCaseId");

-- CreateIndex
CREATE INDEX "therapy_sessions_therapyCaseId_scheduledAt_idx" ON "therapy_sessions"("therapyCaseId", "scheduledAt");

-- CreateIndex
CREATE INDEX "therapy_sessions_therapistId_idx" ON "therapy_sessions"("therapistId");

-- CreateIndex
CREATE UNIQUE INDEX "therapy_attendance_sessionId_key" ON "therapy_attendance"("sessionId");

-- CreateIndex
CREATE INDEX "therapy_notes_sessionId_idx" ON "therapy_notes"("sessionId");

-- CreateIndex
CREATE INDEX "therapy_progress_therapyCaseId_recordedAt_idx" ON "therapy_progress"("therapyCaseId", "recordedAt");

-- CreateIndex
CREATE INDEX "therapy_ai_summaries_therapyCaseId_idx" ON "therapy_ai_summaries"("therapyCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_patientId_issueDate_idx" ON "invoices"("patientId", "issueDate");

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_items_productId_idx" ON "invoice_items"("productId");

-- CreateIndex
CREATE INDEX "payments_invoiceId_paidAt_idx" ON "payments"("invoiceId", "paidAt");

-- CreateIndex
CREATE INDEX "payments_patientId_idx" ON "payments"("patientId");

-- CreateIndex
CREATE INDEX "payment_allocations_paymentId_idx" ON "payment_allocations"("paymentId");

-- CreateIndex
CREATE INDEX "refunds_invoiceId_idx" ON "refunds"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- CreateIndex
CREATE INDEX "product_sales_patientId_idx" ON "product_sales"("patientId");

-- CreateIndex
CREATE INDEX "product_sales_productId_idx" ON "product_sales"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_name_key" ON "product_categories"("name");

-- CreateIndex
CREATE INDEX "stock_transactions_productId_createdAt_idx" ON "stock_transactions"("productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "patient_documents_s3Key_key" ON "patient_documents"("s3Key");

-- CreateIndex
CREATE INDEX "patient_documents_patientId_idx" ON "patient_documents"("patientId");

-- CreateIndex
CREATE INDEX "document_access_logs_documentId_idx" ON "document_access_logs"("documentId");

-- CreateIndex
CREATE INDEX "communication_messages_patientId_status_idx" ON "communication_messages"("patientId", "status");

-- CreateIndex
CREATE INDEX "communication_messages_referenceType_referenceId_idx" ON "communication_messages"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_name_key" ON "message_templates"("name");

-- CreateIndex
CREATE INDEX "communication_events_eventType_idx" ON "communication_events"("eventType");

-- CreateIndex
CREATE INDEX "ai_requests_type_createdAt_idx" ON "ai_requests"("type", "createdAt");

-- CreateIndex
CREATE INDEX "ai_outputs_requestId_idx" ON "ai_outputs"("requestId");

-- CreateIndex
CREATE INDEX "ai_usage_provider_recordedAt_idx" ON "ai_usage"("provider", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_configs_provider_key" ON "ai_provider_configs"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_widgets_key_key" ON "dashboard_widgets"("key");

-- CreateIndex
CREATE INDEX "dashboard_layouts_roleId_idx" ON "dashboard_layouts"("roleId");

-- CreateIndex
CREATE INDEX "dashboard_layouts_userId_idx" ON "dashboard_layouts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_layouts_roleId_widgetId_key" ON "dashboard_layouts"("roleId", "widgetId");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_layouts_userId_widgetId_key" ON "dashboard_layouts"("userId", "widgetId");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE INDEX "settings_group_idx" ON "settings"("group");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_patientId_idx" ON "audit_logs"("patientId");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_timeline_events" ADD CONSTRAINT "patient_timeline_events_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_schedules" ADD CONSTRAINT "provider_schedules_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appointment_status_history_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_items" ADD CONSTRAINT "queue_items_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_items" ADD CONSTRAINT "queue_items_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "op_cases" ADD CONSTRAINT "op_cases_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "op_cases" ADD CONSTRAINT "op_cases_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "op_visits" ADD CONSTRAINT "op_visits_opCaseId_fkey" FOREIGN KEY ("opCaseId") REFERENCES "op_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_opCaseId_fkey" FOREIGN KEY ("opCaseId") REFERENCES "op_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_opCaseId_fkey" FOREIGN KEY ("opCaseId") REFERENCES "op_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_opCaseId_fkey" FOREIGN KEY ("opCaseId") REFERENCES "op_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_opCaseId_fkey" FOREIGN KEY ("opCaseId") REFERENCES "op_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapy_cases" ADD CONSTRAINT "therapy_cases_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapy_cases" ADD CONSTRAINT "therapy_cases_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapy_packages" ADD CONSTRAINT "therapy_packages_therapyTypeId_fkey" FOREIGN KEY ("therapyTypeId") REFERENCES "therapy_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_packages" ADD CONSTRAINT "patient_packages_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_packages" ADD CONSTRAINT "patient_packages_therapyCaseId_fkey" FOREIGN KEY ("therapyCaseId") REFERENCES "therapy_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_packages" ADD CONSTRAINT "patient_packages_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "therapy_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_therapyCaseId_fkey" FOREIGN KEY ("therapyCaseId") REFERENCES "therapy_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_patientPackageId_fkey" FOREIGN KEY ("patientPackageId") REFERENCES "patient_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapy_attendance" ADD CONSTRAINT "therapy_attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "therapy_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapy_notes" ADD CONSTRAINT "therapy_notes_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "therapy_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapy_notes" ADD CONSTRAINT "therapy_notes_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapy_progress" ADD CONSTRAINT "therapy_progress_therapyCaseId_fkey" FOREIGN KEY ("therapyCaseId") REFERENCES "therapy_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapy_ai_summaries" ADD CONSTRAINT "therapy_ai_summaries_therapyCaseId_fkey" FOREIGN KEY ("therapyCaseId") REFERENCES "therapy_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapy_ai_summaries" ADD CONSTRAINT "therapy_ai_summaries_aiRequestId_fkey" FOREIGN KEY ("aiRequestId") REFERENCES "ai_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "therapy_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_sales" ADD CONSTRAINT "product_sales_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_sales" ADD CONSTRAINT "product_sales_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_logs" ADD CONSTRAINT "document_access_logs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "patient_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_logs" ADD CONSTRAINT "document_access_logs_accessedById_fkey" FOREIGN KEY ("accessedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_outputs" ADD CONSTRAINT "ai_outputs_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ai_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "dashboard_widgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
