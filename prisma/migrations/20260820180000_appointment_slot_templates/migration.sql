-- CreateTable
CREATE TABLE "appointment_slot_templates" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_slot_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointment_slot_templates_isActive_sortOrder_idx" ON "appointment_slot_templates"("isActive", "sortOrder");

-- Seed default 30-minute slots 09:00–17:30
INSERT INTO "appointment_slot_templates" ("id", "label", "startTime", "endTime", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text),
  s.label,
  s.start_time,
  s.end_time,
  s.ord,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  VALUES
    ('09:00–09:30', '09:00', '09:30', 1),
    ('09:30–10:00', '09:30', '10:00', 2),
    ('10:00–10:30', '10:00', '10:30', 3),
    ('10:30–11:00', '10:30', '11:00', 4),
    ('11:00–11:30', '11:00', '11:30', 5),
    ('11:30–12:00', '11:30', '12:00', 6),
    ('12:00–12:30', '12:00', '12:30', 7),
    ('12:30–13:00', '12:30', '13:00', 8),
    ('13:00–13:30', '13:00', '13:30', 9),
    ('13:30–14:00', '13:30', '14:00', 10),
    ('14:00–14:30', '14:00', '14:30', 11),
    ('14:30–15:00', '14:30', '15:00', 12),
    ('15:00–15:30', '15:00', '15:30', 13),
    ('15:30–16:00', '15:30', '16:00', 14),
    ('16:00–16:30', '16:00', '16:30', 15),
    ('16:30–17:00', '16:30', '17:00', 16),
    ('17:00–17:30', '17:00', '17:30', 17)
) AS s(label, start_time, end_time, ord);
