-- AlterTable: add authoredById for doctor/therapist note authorship
ALTER TABLE "therapy_notes" ADD COLUMN "authoredById" TEXT;

-- Backfill from legacy therapistId
UPDATE "therapy_notes" SET "authoredById" = "therapistId" WHERE "authoredById" IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE "therapy_notes" ALTER COLUMN "authoredById" SET NOT NULL;

-- CreateIndex
CREATE INDEX "therapy_notes_sessionId_authoredById_idx" ON "therapy_notes"("sessionId", "authoredById");
CREATE INDEX "therapy_notes_authoredById_idx" ON "therapy_notes"("authoredById");

-- AddForeignKey
ALTER TABLE "therapy_notes" ADD CONSTRAINT "therapy_notes_authoredById_fkey" FOREIGN KEY ("authoredById") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
