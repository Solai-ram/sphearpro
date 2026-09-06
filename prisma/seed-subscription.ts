import type { PrismaClient } from '@prisma/client';

/** Monthly billing — ₹1,800/mo */
export const STANDARD_PLAN_CODE = 'STANDARD';
export const STANDARD_YEARLY_CODE = 'STANDARD_YEARLY';
export const STANDARD_PRICE_PAISE = 180_000;
export const STANDARD_YEARLY_MONTHLY_PAISE = 150_000;
export const STANDARD_MAX_STAFF = 5;
export const STANDARD_MAX_ADMIN = 1;

const PLAN_BODY =
  'Full clinic HIS for up to 5 staff users + 1 admin: patients, OP, therapy, billing, inventory, documents, WhatsApp, AI assist, and reports.';

const FEATURES: Array<{ code: string; name: string; description: string; module: string }> = [
  { code: 'PATIENT_MANAGEMENT', name: 'Patient management', description: 'Register, search, and manage patients', module: 'patients' },
  { code: 'APPOINTMENTS', name: 'Appointments', description: 'Therapy schedule, slots, and doctor assignment', module: 'appointments' },
  { code: 'BASIC_BILLING', name: 'Billing & payments', description: 'Invoices, payments, receipts', module: 'billing' },
  { code: 'EMR', name: 'OP / clinical records', description: 'OP registration and clinical cases', module: 'clinical' },
  { code: 'PRESCRIPTIONS', name: 'Prescriptions', description: 'Prescription recording (API-ready)', module: 'clinical' },
  { code: 'THERAPY', name: 'Therapy programmes', description: 'Cases, packages, sessions, attendance, notes', module: 'therapy' },
  { code: 'LAB', name: 'Lab catalogue', description: 'Lab procedures and lab billing lines', module: 'lab' },
  { code: 'INVENTORY', name: 'Inventory', description: 'Products, stock, suppliers', module: 'inventory' },
  { code: 'DOCUMENT_STORAGE', name: 'Documents', description: 'Patient document upload and storage', module: 'documents' },
  { code: 'COMMUNICATION', name: 'WhatsApp communication (coming soon)', description: 'Queued WhatsApp messages and templates — not available in v1', module: 'communication' },
  { code: 'AI_ASSIST', name: 'AI assistance', description: 'Transcription and SOAP/summary drafts with human review', module: 'ai' },
  { code: 'ADVANCED_REPORTS', name: 'Reports', description: 'Clinical, therapy, financial, and inventory reports', module: 'reports' },
  { code: 'DASHBOARD', name: 'Dashboard', description: 'Role dashboards and KPIs', module: 'dashboard' },
  { code: 'MULTI_DOCTOR', name: 'Multi-doctor', description: 'Multiple doctors and per-session assignment', module: 'staff' },
];

async function linkFeatures(prisma: PrismaClient, planId: string, featureIds: string[]) {
  await prisma.planFeature.deleteMany({ where: { planId } });
  await prisma.planFeature.createMany({
    data: featureIds.map((featureId) => ({ planId, featureId })),
    skipDuplicates: true,
  });
}

export async function seedSubscriptionCatalog(prisma: PrismaClient) {
  console.log('Seeding SaaS subscription catalog (STANDARD monthly + yearly)...');

  const featureIds: string[] = [];
  for (const f of FEATURES) {
    const row = await prisma.feature.upsert({
      where: { code: f.code },
      update: { name: f.name, description: f.description, module: f.module },
      create: f,
    });
    featureIds.push(row.id);
  }

  const monthlyPlan = await prisma.subscriptionPlan.upsert({
    where: { code: STANDARD_PLAN_CODE },
    update: {
      name: 'SPHEAR Standard',
      description: PLAN_BODY,
      monthlyPricePaise: STANDARD_PRICE_PAISE,
      currency: 'INR',
      billingInterval: 'MONTHLY',
      maxStaffUsers: STANDARD_MAX_STAFF,
      maxAdminUsers: STANDARD_MAX_ADMIN,
      trialDays: 7,
      isActive: true,
      sortOrder: 1,
    },
    create: {
      code: STANDARD_PLAN_CODE,
      name: 'SPHEAR Standard',
      description: PLAN_BODY,
      monthlyPricePaise: STANDARD_PRICE_PAISE,
      currency: 'INR',
      billingInterval: 'MONTHLY',
      maxStaffUsers: STANDARD_MAX_STAFF,
      maxAdminUsers: STANDARD_MAX_ADMIN,
      trialDays: 7,
      isActive: true,
      sortOrder: 1,
    },
  });

  const yearlyPlan = await prisma.subscriptionPlan.upsert({
    where: { code: STANDARD_YEARLY_CODE },
    update: {
      name: 'SPHEAR Standard',
      description: PLAN_BODY,
      monthlyPricePaise: STANDARD_YEARLY_MONTHLY_PAISE,
      currency: 'INR',
      billingInterval: 'YEARLY',
      maxStaffUsers: STANDARD_MAX_STAFF,
      maxAdminUsers: STANDARD_MAX_ADMIN,
      trialDays: 7,
      isActive: true,
      sortOrder: 2,
    },
    create: {
      code: STANDARD_YEARLY_CODE,
      name: 'SPHEAR Standard',
      description: PLAN_BODY,
      monthlyPricePaise: STANDARD_YEARLY_MONTHLY_PAISE,
      currency: 'INR',
      billingInterval: 'YEARLY',
      maxStaffUsers: STANDARD_MAX_STAFF,
      maxAdminUsers: STANDARD_MAX_ADMIN,
      trialDays: 7,
      isActive: true,
      sortOrder: 2,
    },
  });

  await linkFeatures(prisma, monthlyPlan.id, featureIds);
  await linkFeatures(prisma, yearlyPlan.id, featureIds);

  console.log(`   - ${STANDARD_PLAN_CODE} @ ₹${STANDARD_PRICE_PAISE / 100}/month`);
  console.log(
    `   - ${STANDARD_YEARLY_CODE} @ ₹${STANDARD_YEARLY_MONTHLY_PAISE / 100}/month (₹${(STANDARD_YEARLY_MONTHLY_PAISE * 12) / 100}/year)`,
  );
  console.log(`   - Seat limit: ${STANDARD_MAX_STAFF} staff + ${STANDARD_MAX_ADMIN} admin`);
  console.log(`   - ${FEATURES.length} features linked to each plan`);

  const defaultClinicId = process.env.DEFAULT_CLINIC_ID || 'cldefault00000000000000001';
  const clinic = await prisma.clinic.findUnique({ where: { id: defaultClinicId } });
  if (clinic) {
    const existing = await prisma.subscription.findFirst({
      where: { clinicId: clinic.id },
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 12);
    if (!existing) {
      await prisma.subscription.create({
        data: {
          clinicId: clinic.id,
          planId: monthlyPlan.id,
          provider: 'manual',
          status: 'ACTIVE',
          amountPaise: STANDARD_PRICE_PAISE,
          currency: 'INR',
          billingInterval: 'MONTHLY',
          startDate: now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
      console.log(`   - Seeded ACTIVE subscription for clinic ${clinic.slug}`);
    } else if (existing.status !== 'ACTIVE') {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          status: 'ACTIVE',
          planId: monthlyPlan.id,
          amountPaise: STANDARD_PRICE_PAISE,
          billingInterval: 'MONTHLY',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          endedAt: null,
          gracePeriodStart: null,
          gracePeriodEnd: null,
        },
      });
      console.log(`   - Reactivated seed subscription for clinic ${clinic.slug}`);
    }
  }

  return { monthlyPlan, yearlyPlan };
}
