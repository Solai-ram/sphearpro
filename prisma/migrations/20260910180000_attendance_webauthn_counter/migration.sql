-- WebAuthn signature counter for attendance device anti-replay
ALTER TABLE "attendance_devices" ADD COLUMN "webauthnCounter" INTEGER NOT NULL DEFAULT 0;
