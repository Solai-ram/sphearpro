-- Link therapy sessions to calendar appointments when a doctor is assigned.
ALTER TABLE "therapy_sessions" ADD COLUMN IF NOT EXISTS "appointmentId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "therapy_sessions_appointmentId_key" ON "therapy_sessions"("appointmentId");
CREATE INDEX IF NOT EXISTS "therapy_sessions_appointmentId_idx" ON "therapy_sessions"("appointmentId");
ALTER TABLE "therapy_sessions" DROP CONSTRAINT IF EXISTS "therapy_sessions_appointmentId_fkey";
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
