-- AlterTable
ALTER TABLE "therapy_sessions" ADD COLUMN "doctorId" TEXT;

-- CreateIndex
CREATE INDEX "therapy_sessions_doctorId_idx" ON "therapy_sessions"("doctorId");

-- AddForeignKey
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill from linked appointments when present
UPDATE "therapy_sessions" AS ts
SET "doctorId" = a."providerId"
FROM "appointments" AS a
WHERE ts."appointmentId" = a."id"
  AND ts."doctorId" IS NULL;
