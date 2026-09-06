-- Per-clinic platform support ADMIN accounts
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isSystemSupport" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "supportPasswordEnc" TEXT;

CREATE INDEX IF NOT EXISTS "users_clinicId_isSystemSupport_idx" ON "users"("clinicId", "isSystemSupport");
