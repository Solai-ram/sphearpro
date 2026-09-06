DROP INDEX IF EXISTS "appointments_providerId_appointmentAt_key";
CREATE INDEX IF NOT EXISTS "appointments_providerId_appointmentAt_idx" ON "appointments"("providerId", "appointmentAt");
