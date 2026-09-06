-- Lab procedure catalog
CREATE TYPE "LabSampleType" AS ENUM ('NONE', 'BLOOD', 'SERUM', 'URINE', 'SWAB', 'SPUTUM', 'OTHER');

CREATE TABLE "lab_procedures" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "sampleType" "LabSampleType" NOT NULL DEFAULT 'NONE',
    "price" DECIMAL(10,2) NOT NULL,
    "tatHours" INTEGER NOT NULL DEFAULT 24,
    "instructions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_procedures_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lab_procedures_code_key" ON "lab_procedures"("code");
CREATE INDEX "lab_procedures_department_idx" ON "lab_procedures"("department");
CREATE INDEX "lab_procedures_isActive_idx" ON "lab_procedures"("isActive");
CREATE INDEX "lab_procedures_name_idx" ON "lab_procedures"("name");
