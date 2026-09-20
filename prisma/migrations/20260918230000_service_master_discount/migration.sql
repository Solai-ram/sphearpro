-- AlterTable
ALTER TABLE "service_masters" ADD COLUMN IF NOT EXISTS "discount" DECIMAL(10,2) NOT NULL DEFAULT 0;
