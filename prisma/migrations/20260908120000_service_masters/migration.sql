-- CreateEnum
CREATE TYPE "ServiceMasterCategory" AS ENUM ('CONSULTATION', 'REVIEW', 'OTHER');

-- CreateTable
CREATE TABLE "service_masters" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ServiceMasterCategory" NOT NULL DEFAULT 'CONSULTATION',
    "price" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_masters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_masters_clinicId_idx" ON "service_masters"("clinicId");

-- CreateIndex
CREATE INDEX "service_masters_category_idx" ON "service_masters"("category");

-- CreateIndex
CREATE INDEX "service_masters_isActive_idx" ON "service_masters"("isActive");

-- CreateIndex
CREATE INDEX "service_masters_name_idx" ON "service_masters"("name");

-- CreateIndex
CREATE UNIQUE INDEX "service_masters_clinicId_code_key" ON "service_masters"("clinicId", "code");

-- AddForeignKey
ALTER TABLE "service_masters" ADD CONSTRAINT "service_masters_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
