-- Staff attendance: shifts, punches, devices, challenges (tenant-scoped)

CREATE TYPE "StaffAttendanceStatus" AS ENUM (
  'PRESENT',
  'LATE',
  'ABSENT',
  'HALF_DAY',
  'ON_LEAVE',
  'HOLIDAY',
  'WEEK_OFF'
);

CREATE TABLE "staff_shifts" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "graceMinutes" INTEGER NOT NULL DEFAULT 10,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_shifts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "staff_shift_assignments" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_shift_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "staff_attendances" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "checkIn" TIMESTAMP(3),
  "checkOut" TIMESTAMP(3),
  "status" "StaffAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
  "lateMinutes" INTEGER NOT NULL DEFAULT 0,
  "workingMinutes" INTEGER NOT NULL DEFAULT 0,
  "shiftId" TEXT,
  "checkInLatitude" DECIMAL(10,7),
  "checkInLongitude" DECIMAL(10,7),
  "checkInAccuracyMeters" DECIMAL(8,2),
  "checkOutLatitude" DECIMAL(10,7),
  "checkOutLongitude" DECIMAL(10,7),
  "checkOutAccuracyMeters" DECIMAL(8,2),
  "checkInDeviceId" TEXT,
  "checkOutDeviceId" TEXT,
  "biometricVerifiedAt" TIMESTAMP(3),
  "source" TEXT NOT NULL DEFAULT 'SELF',
  "remarks" TEXT,
  "correctedBy" TEXT,
  "correctedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_attendances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attendance_devices" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceKeyHash" TEXT NOT NULL,
  "platform" TEXT,
  "deviceName" TEXT,
  "webauthnCredentialId" TEXT,
  "webauthnPublicKey" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "attendance_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attendance_challenges" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "challenge" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "staff_shifts_clinicId_idx" ON "staff_shifts"("clinicId");
CREATE INDEX "staff_shifts_clinicId_isActive_idx" ON "staff_shifts"("clinicId", "isActive");
CREATE INDEX "staff_shift_assignments_clinicId_userId_idx" ON "staff_shift_assignments"("clinicId", "userId");
CREATE INDEX "staff_shift_assignments_shiftId_idx" ON "staff_shift_assignments"("shiftId");
CREATE UNIQUE INDEX "staff_attendances_clinicId_userId_date_key" ON "staff_attendances"("clinicId", "userId", "date");
CREATE INDEX "staff_attendances_clinicId_date_idx" ON "staff_attendances"("clinicId", "date");
CREATE INDEX "staff_attendances_clinicId_userId_idx" ON "staff_attendances"("clinicId", "userId");
CREATE INDEX "staff_attendances_status_idx" ON "staff_attendances"("status");
CREATE UNIQUE INDEX "attendance_devices_clinicId_deviceKeyHash_key" ON "attendance_devices"("clinicId", "deviceKeyHash");
CREATE INDEX "attendance_devices_clinicId_userId_idx" ON "attendance_devices"("clinicId", "userId");
CREATE INDEX "attendance_devices_userId_isActive_idx" ON "attendance_devices"("userId", "isActive");
CREATE INDEX "attendance_challenges_clinicId_userId_idx" ON "attendance_challenges"("clinicId", "userId");
CREATE INDEX "attendance_challenges_expiresAt_idx" ON "attendance_challenges"("expiresAt");

ALTER TABLE "staff_shifts" ADD CONSTRAINT "staff_shifts_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "staff_shift_assignments" ADD CONSTRAINT "staff_shift_assignments_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "staff_shift_assignments" ADD CONSTRAINT "staff_shift_assignments_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_shift_assignments" ADD CONSTRAINT "staff_shift_assignments_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "staff_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_attendances" ADD CONSTRAINT "staff_attendances_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "staff_attendances" ADD CONSTRAINT "staff_attendances_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_devices" ADD CONSTRAINT "attendance_devices_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_devices" ADD CONSTRAINT "attendance_devices_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_challenges" ADD CONSTRAINT "attendance_challenges_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_challenges" ADD CONSTRAINT "attendance_challenges_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
