import { PrismaClient } from '@prisma/client';
import { describe } from 'vitest';

function resolveTestDatabaseUrl(): string | null {
  if (process.env.SKIP_DB_TESTS === 'true') return null;
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) return null;
  if (url.includes('hislite_test') || process.env.ALLOW_UNSAFE_DB_TESTS === 'true') {
    return url;
  }
  return null;
}

export const describeDb = resolveTestDatabaseUrl() ? describe : describe.skip;

let client: PrismaClient | null | undefined;

/** Connect to the dedicated test Postgres, or return null when not configured. */
export async function getTestPrisma(): Promise<PrismaClient | null> {
  if (client !== undefined) return client;
  const url = resolveTestDatabaseUrl();
  if (!url) {
    client = null;
    return null;
  }
  const prisma = new PrismaClient({
    datasources: { db: { url } },
    log: ['error'],
  });
  try {
    await prisma.$queryRaw`SELECT 1`;
    client = prisma;
    return client;
  } catch (err) {
    await prisma.$disconnect().catch(() => undefined);
    throw new Error(
      `Test DATABASE_URL is set but Postgres is unreachable: ${err instanceof Error ? err.message : err}`,
    );
  }
}

export async function disconnectTestPrisma() {
  if (client) {
    await client.$disconnect().catch(() => undefined);
  }
  client = undefined;
}

export async function truncateAll(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "audit_logs",
      "patient_timeline_events",
      "payment_allocations",
      "payments",
      "refunds",
      "invoice_items",
      "invoices",
      "therapy_attendance",
      "therapy_sessions",
      "patient_packages",
      "therapy_packages",
      "therapy_types",
      "therapy_cases",
      "op_cases",
      "patients",
      "staff_profiles",
      "user_roles",
      "users",
      "subscription_events",
      "subscriptions",
      "plan_features",
      "subscription_plans",
      "features",
      "clinics"
    RESTART IDENTITY CASCADE;
  `);
}
