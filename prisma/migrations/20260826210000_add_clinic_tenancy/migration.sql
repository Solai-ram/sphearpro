-- Phase 1: multi-tenancy — Clinic + clinic_id on root tenant tables
-- Backfills all existing rows into a single default clinic.

CREATE TYPE "ClinicStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

CREATE TABLE "clinics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "ClinicStatus" NOT NULL DEFAULT 'ACTIVE',
    "phone" TEXT,
    "email" TEXT,
    "gstin" TEXT,
    "address" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clinics_slug_key" ON "clinics"("slug");
CREATE INDEX "clinics_status_idx" ON "clinics"("status");

INSERT INTO "clinics" ("id", "name", "slug", "status", "createdAt", "updatedAt")
VALUES ('cldefault00000000000000001', 'Default Clinic', 'default', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Helper: add nullable clinic_id, backfill, set NOT NULL + FK + index
-- USERS
ALTER TABLE "users" ADD COLUMN "clinicId" TEXT;
UPDATE "users" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "users" ALTER COLUMN "clinicId" SET NOT NULL;
CREATE INDEX "users_clinicId_idx" ON "users"("clinicId");
ALTER TABLE "users" ADD CONSTRAINT "users_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PATIENTS: drop global uniques, add clinic-scoped
ALTER TABLE "patients" ADD COLUMN "clinicId" TEXT;
UPDATE "patients" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "patients" ALTER COLUMN "clinicId" SET NOT NULL;
ALTER TABLE "patients" DROP CONSTRAINT IF EXISTS "patients_patientNumber_key";
ALTER TABLE "patients" DROP CONSTRAINT IF EXISTS "patients_phone_key";
ALTER TABLE "patients" DROP CONSTRAINT IF EXISTS "patients_email_key";
CREATE UNIQUE INDEX "patients_clinicId_patientNumber_key" ON "patients"("clinicId", "patientNumber");
CREATE UNIQUE INDEX "patients_clinicId_phone_key" ON "patients"("clinicId", "phone");
CREATE UNIQUE INDEX "patients_clinicId_email_key" ON "patients"("clinicId", "email");
CREATE INDEX "patients_clinicId_idx" ON "patients"("clinicId");
ALTER TABLE "patients" ADD CONSTRAINT "patients_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- STAFF
ALTER TABLE "staff_profiles" ADD COLUMN "clinicId" TEXT;
UPDATE "staff_profiles" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "staff_profiles" ALTER COLUMN "clinicId" SET NOT NULL;
CREATE INDEX "staff_profiles_clinicId_idx" ON "staff_profiles"("clinicId");
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SLOT TEMPLATES
ALTER TABLE "appointment_slot_templates" ADD COLUMN "clinicId" TEXT;
UPDATE "appointment_slot_templates" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "appointment_slot_templates" ALTER COLUMN "clinicId" SET NOT NULL;
DROP INDEX IF EXISTS "appointment_slot_templates_isActive_sortOrder_idx";
CREATE INDEX "appointment_slot_templates_clinicId_isActive_sortOrder_idx" ON "appointment_slot_templates"("clinicId", "isActive", "sortOrder");
ALTER TABLE "appointment_slot_templates" ADD CONSTRAINT "appointment_slot_templates_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- APPOINTMENTS
ALTER TABLE "appointments" ADD COLUMN "clinicId" TEXT;
UPDATE "appointments" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "appointments" ALTER COLUMN "clinicId" SET NOT NULL;
CREATE INDEX "appointments_clinicId_idx" ON "appointments"("clinicId");
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- QUEUE
ALTER TABLE "queue_items" ADD COLUMN "clinicId" TEXT;
UPDATE "queue_items" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "queue_items" ALTER COLUMN "clinicId" SET NOT NULL;
CREATE INDEX "queue_items_clinicId_idx" ON "queue_items"("clinicId");
ALTER TABLE "queue_items" ADD CONSTRAINT "queue_items_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- OP CASES
ALTER TABLE "op_cases" ADD COLUMN "clinicId" TEXT;
UPDATE "op_cases" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "op_cases" ALTER COLUMN "clinicId" SET NOT NULL;
CREATE INDEX "op_cases_clinicId_idx" ON "op_cases"("clinicId");
ALTER TABLE "op_cases" ADD CONSTRAINT "op_cases_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- THERAPY
ALTER TABLE "therapy_cases" ADD COLUMN "clinicId" TEXT;
UPDATE "therapy_cases" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "therapy_cases" ALTER COLUMN "clinicId" SET NOT NULL;
CREATE INDEX "therapy_cases_clinicId_idx" ON "therapy_cases"("clinicId");
ALTER TABLE "therapy_cases" ADD CONSTRAINT "therapy_cases_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "therapy_types" ADD COLUMN "clinicId" TEXT;
UPDATE "therapy_types" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "therapy_types" ALTER COLUMN "clinicId" SET NOT NULL;
ALTER TABLE "therapy_types" DROP CONSTRAINT IF EXISTS "therapy_types_name_key";
CREATE UNIQUE INDEX "therapy_types_clinicId_name_key" ON "therapy_types"("clinicId", "name");
CREATE INDEX "therapy_types_clinicId_idx" ON "therapy_types"("clinicId");
ALTER TABLE "therapy_types" ADD CONSTRAINT "therapy_types_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "therapy_packages" ADD COLUMN "clinicId" TEXT;
UPDATE "therapy_packages" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "therapy_packages" ALTER COLUMN "clinicId" SET NOT NULL;
CREATE INDEX "therapy_packages_clinicId_idx" ON "therapy_packages"("clinicId");
ALTER TABLE "therapy_packages" ADD CONSTRAINT "therapy_packages_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "patient_packages" ADD COLUMN "clinicId" TEXT;
UPDATE "patient_packages" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "patient_packages" ALTER COLUMN "clinicId" SET NOT NULL;
CREATE INDEX "patient_packages_clinicId_idx" ON "patient_packages"("clinicId");
ALTER TABLE "patient_packages" ADD CONSTRAINT "patient_packages_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "therapy_sessions" ADD COLUMN "clinicId" TEXT;
UPDATE "therapy_sessions" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "therapy_sessions" ALTER COLUMN "clinicId" SET NOT NULL;
CREATE INDEX "therapy_sessions_clinicId_idx" ON "therapy_sessions"("clinicId");
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- BILLING
ALTER TABLE "invoices" ADD COLUMN "clinicId" TEXT;
UPDATE "invoices" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "invoices" ALTER COLUMN "clinicId" SET NOT NULL;
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_invoiceNumber_key";
CREATE UNIQUE INDEX "invoices_clinicId_invoiceNumber_key" ON "invoices"("clinicId", "invoiceNumber");
CREATE INDEX "invoices_clinicId_idx" ON "invoices"("clinicId");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments" ADD COLUMN "clinicId" TEXT;
UPDATE "payments" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "payments" ALTER COLUMN "clinicId" SET NOT NULL;
CREATE INDEX "payments_clinicId_idx" ON "payments"("clinicId");
ALTER TABLE "payments" ADD CONSTRAINT "payments_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "discounts" ADD COLUMN "clinicId" TEXT;
UPDATE "discounts" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "discounts" ALTER COLUMN "clinicId" SET NOT NULL;
CREATE INDEX "discounts_clinicId_idx" ON "discounts"("clinicId");
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- INVENTORY
ALTER TABLE "products" ADD COLUMN "clinicId" TEXT;
UPDATE "products" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "products" ALTER COLUMN "clinicId" SET NOT NULL;
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_sku_key";
CREATE UNIQUE INDEX "products_clinicId_sku_key" ON "products"("clinicId", "sku");
CREATE INDEX "products_clinicId_idx" ON "products"("clinicId");
ALTER TABLE "products" ADD CONSTRAINT "products_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_sales" ADD COLUMN "clinicId" TEXT;
UPDATE "product_sales" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "product_sales" ALTER COLUMN "clinicId" SET NOT NULL;
CREATE INDEX "product_sales_clinicId_idx" ON "product_sales"("clinicId");
ALTER TABLE "product_sales" ADD CONSTRAINT "product_sales_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_categories" ADD COLUMN "clinicId" TEXT;
UPDATE "product_categories" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "product_categories" ALTER COLUMN "clinicId" SET NOT NULL;
ALTER TABLE "product_categories" DROP CONSTRAINT IF EXISTS "product_categories_name_key";
CREATE UNIQUE INDEX "product_categories_clinicId_name_key" ON "product_categories"("clinicId", "name");
CREATE INDEX "product_categories_clinicId_idx" ON "product_categories"("clinicId");
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "suppliers" ADD COLUMN "clinicId" TEXT;
UPDATE "suppliers" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "suppliers" ALTER COLUMN "clinicId" SET NOT NULL;
CREATE INDEX "suppliers_clinicId_idx" ON "suppliers"("clinicId");
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_transactions" ADD COLUMN "clinicId" TEXT;
UPDATE "stock_transactions" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "stock_transactions" ALTER COLUMN "clinicId" SET NOT NULL;
CREATE INDEX "stock_transactions_clinicId_idx" ON "stock_transactions"("clinicId");
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DOCUMENTS
ALTER TABLE "patient_documents" ADD COLUMN "clinicId" TEXT;
UPDATE "patient_documents" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "patient_documents" ALTER COLUMN "clinicId" SET NOT NULL;
CREATE INDEX "patient_documents_clinicId_idx" ON "patient_documents"("clinicId");
ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- COMMUNICATION
ALTER TABLE "communication_messages" ADD COLUMN "clinicId" TEXT;
UPDATE "communication_messages" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "communication_messages" ALTER COLUMN "clinicId" SET NOT NULL;
CREATE INDEX "communication_messages_clinicId_idx" ON "communication_messages"("clinicId");
ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "message_templates" ADD COLUMN "clinicId" TEXT;
UPDATE "message_templates" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "message_templates" ALTER COLUMN "clinicId" SET NOT NULL;
ALTER TABLE "message_templates" DROP CONSTRAINT IF EXISTS "message_templates_name_key";
CREATE UNIQUE INDEX "message_templates_clinicId_name_key" ON "message_templates"("clinicId", "name");
CREATE INDEX "message_templates_clinicId_idx" ON "message_templates"("clinicId");
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "communication_events" ADD COLUMN "clinicId" TEXT;
UPDATE "communication_events" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "communication_events" ALTER COLUMN "clinicId" SET NOT NULL;
CREATE INDEX "communication_events_clinicId_idx" ON "communication_events"("clinicId");
ALTER TABLE "communication_events" ADD CONSTRAINT "communication_events_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AI
ALTER TABLE "ai_requests" ADD COLUMN "clinicId" TEXT;
UPDATE "ai_requests" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "ai_requests" ALTER COLUMN "clinicId" SET NOT NULL;
CREATE INDEX "ai_requests_clinicId_idx" ON "ai_requests"("clinicId");
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_usage" ADD COLUMN "clinicId" TEXT;
UPDATE "ai_usage" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "ai_usage" ALTER COLUMN "clinicId" SET NOT NULL;
CREATE INDEX "ai_usage_clinicId_idx" ON "ai_usage"("clinicId");
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SETTINGS
ALTER TABLE "settings" ADD COLUMN "clinicId" TEXT;
UPDATE "settings" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "settings" ALTER COLUMN "clinicId" SET NOT NULL;
ALTER TABLE "settings" DROP CONSTRAINT IF EXISTS "settings_key_key";
CREATE UNIQUE INDEX "settings_clinicId_key_key" ON "settings"("clinicId", "key");
CREATE INDEX "settings_clinicId_idx" ON "settings"("clinicId");
ALTER TABLE "settings" ADD CONSTRAINT "settings_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- LAB
ALTER TABLE "lab_procedures" ADD COLUMN "clinicId" TEXT;
UPDATE "lab_procedures" SET "clinicId" = 'cldefault00000000000000001';
ALTER TABLE "lab_procedures" ALTER COLUMN "clinicId" SET NOT NULL;
ALTER TABLE "lab_procedures" DROP CONSTRAINT IF EXISTS "lab_procedures_code_key";
CREATE UNIQUE INDEX "lab_procedures_clinicId_code_key" ON "lab_procedures"("clinicId", "code");
CREATE INDEX "lab_procedures_clinicId_idx" ON "lab_procedures"("clinicId");
ALTER TABLE "lab_procedures" ADD CONSTRAINT "lab_procedures_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AUDIT (nullable clinicId for system events)
ALTER TABLE "audit_logs" ADD COLUMN "clinicId" TEXT;
UPDATE "audit_logs" SET "clinicId" = 'cldefault00000000000000001';
CREATE INDEX "audit_logs_clinicId_idx" ON "audit_logs"("clinicId");
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
