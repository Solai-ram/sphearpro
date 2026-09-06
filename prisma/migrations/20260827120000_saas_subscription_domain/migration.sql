-- Phase 2: SaaS subscription domain (distinct from clinical billing)

CREATE TYPE "SubscriptionStatus" AS ENUM (
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'PAYMENT_FAILED',
  'GRACE_PERIOD',
  'CANCELLED',
  'EXPIRED',
  'SUSPENDED'
);

CREATE TYPE "SubscriptionBillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

CREATE TYPE "SubscriptionPaymentStatus" AS ENUM (
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED'
);

CREATE TYPE "SubscriptionInvoiceStatus" AS ENUM (
  'DRAFT',
  'OPEN',
  'PAID',
  'VOID',
  'UNCOLLECTIBLE'
);

CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "monthlyPricePaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "billingInterval" "SubscriptionBillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "trialDays" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans"("code");
CREATE INDEX "subscription_plans_isActive_idx" ON "subscription_plans"("isActive");

CREATE TABLE "features" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "module" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "features_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "features_code_key" ON "features"("code");
CREATE INDEX "features_module_idx" ON "features"("module");

CREATE TABLE "plan_features" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "plan_features_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plan_features_planId_featureId_key" ON "plan_features"("planId", "featureId");
CREATE INDEX "plan_features_planId_idx" ON "plan_features"("planId");
CREATE INDEX "plan_features_featureId_idx" ON "plan_features"("featureId");

ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'razorpay',
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "billingInterval" "SubscriptionBillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "startDate" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "gracePeriodStart" TIMESTAMP(3),
    "gracePeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscriptions_providerSubscriptionId_key" ON "subscriptions"("providerSubscriptionId");
CREATE INDEX "subscriptions_clinicId_idx" ON "subscriptions"("clinicId");
CREATE INDEX "subscriptions_clinicId_status_idx" ON "subscriptions"("clinicId", "status");
CREATE INDEX "subscriptions_planId_idx" ON "subscriptions"("planId");
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");
CREATE INDEX "subscriptions_providerCustomerId_idx" ON "subscriptions"("providerCustomerId");

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "subscription_payments" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'razorpay',
    "providerPaymentId" TEXT,
    "providerOrderId" TEXT,
    "providerInvoiceId" TEXT,
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_payments_providerPaymentId_key" ON "subscription_payments"("providerPaymentId");
CREATE INDEX "subscription_payments_clinicId_idx" ON "subscription_payments"("clinicId");
CREATE INDEX "subscription_payments_subscriptionId_idx" ON "subscription_payments"("subscriptionId");
CREATE INDEX "subscription_payments_status_idx" ON "subscription_payments"("status");
CREATE INDEX "subscription_payments_providerOrderId_idx" ON "subscription_payments"("providerOrderId");

ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "subscription_invoices" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "taxAmountPaise" INTEGER NOT NULL DEFAULT 0,
    "discountAmountPaise" INTEGER NOT NULL DEFAULT 0,
    "totalAmountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "SubscriptionInvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "providerInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_invoices_clinicId_invoiceNumber_key" ON "subscription_invoices"("clinicId", "invoiceNumber");
CREATE UNIQUE INDEX "subscription_invoices_invoiceNumber_key" ON "subscription_invoices"("invoiceNumber");
CREATE INDEX "subscription_invoices_clinicId_idx" ON "subscription_invoices"("clinicId");
CREATE INDEX "subscription_invoices_subscriptionId_idx" ON "subscription_invoices"("subscriptionId");
CREATE INDEX "subscription_invoices_status_idx" ON "subscription_invoices"("status");

ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhook_events_provider_eventId_key" ON "webhook_events"("provider", "eventId");
CREATE INDEX "webhook_events_processed_createdAt_idx" ON "webhook_events"("processed", "createdAt");
CREATE INDEX "webhook_events_eventType_idx" ON "webhook_events"("eventType");

CREATE TABLE "subscription_events" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "oldStatus" "SubscriptionStatus",
    "newStatus" "SubscriptionStatus",
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "subscription_events_subscriptionId_createdAt_idx" ON "subscription_events"("subscriptionId", "createdAt");
CREATE INDEX "subscription_events_clinicId_createdAt_idx" ON "subscription_events"("clinicId", "createdAt");
CREATE INDEX "subscription_events_eventType_idx" ON "subscription_events"("eventType");

ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
