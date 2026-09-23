-- Drop any remaining unique index or constraint on phone alone and clinicId+phone
DROP INDEX IF EXISTS "patients_phone_key";
DROP INDEX IF EXISTS "patients_clinicId_phone_key";
ALTER TABLE "patients" DROP CONSTRAINT IF EXISTS "patients_phone_key";
ALTER TABLE "patients" DROP CONSTRAINT IF EXISTS "patients_clinicId_phone_key";

-- Ensure non-unique index exists for performance
CREATE INDEX IF NOT EXISTS "patients_phone_idx" ON "patients"("phone");
CREATE INDEX IF NOT EXISTS "patients_clinicId_phone_idx" ON "patients"("clinicId", "phone");
