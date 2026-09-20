-- Clinic holidays + staff leave requests (attendance Phase 6)

CREATE TYPE "StaffLeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "clinic_holidays" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clinic_holidays_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "staff_leave_requests" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "reason" TEXT,
  "status" "StaffLeaveStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_leave_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clinic_holidays_clinicId_date_key" ON "clinic_holidays"("clinicId", "date");
CREATE INDEX "clinic_holidays_clinicId_date_idx" ON "clinic_holidays"("clinicId", "date");
CREATE INDEX "staff_leave_requests_clinicId_status_idx" ON "staff_leave_requests"("clinicId", "status");
CREATE INDEX "staff_leave_requests_clinicId_userId_idx" ON "staff_leave_requests"("clinicId", "userId");
CREATE INDEX "staff_leave_requests_clinicId_startDate_endDate_idx" ON "staff_leave_requests"("clinicId", "startDate", "endDate");

ALTER TABLE "clinic_holidays" ADD CONSTRAINT "clinic_holidays_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_leave_requests" ADD CONSTRAINT "staff_leave_requests_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "staff_leave_requests" ADD CONSTRAINT "staff_leave_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
