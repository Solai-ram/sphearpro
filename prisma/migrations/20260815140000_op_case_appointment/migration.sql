-- Link OP cases to appointments (consultation is a separate entity).
ALTER TABLE "op_cases" ADD COLUMN IF NOT EXISTS "appointmentId" TEXT;
CREATE INDEX IF NOT EXISTS "op_cases_appointmentId_idx" ON "op_cases"("appointmentId");
ALTER TABLE "op_cases" DROP CONSTRAINT IF EXISTS "op_cases_appointmentId_fkey";
ALTER TABLE "op_cases" ADD CONSTRAINT "op_cases_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
