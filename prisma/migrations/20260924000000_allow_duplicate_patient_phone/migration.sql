-- Drop unique constraint on (clinicId, phone) to allow shared phone numbers across patients (e.g. family members)
DROP INDEX IF EXISTS "patients_clinicId_phone_key";

-- Maintain index for performant search on (clinicId, phone)
CREATE INDEX IF NOT EXISTS "patients_clinicId_phone_idx" ON "patients"("clinicId", "phone");
