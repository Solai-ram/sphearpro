import { PrismaClient } from '@prisma/client';

const DEFAULT_CLINIC_ID = 'cldefault00000000000000001';

/** Clinic default: 45-minute slots from 09:00 through 17:15. */
export const SLOT_45_MIN = [
  { label: '09:00–09:45', startTime: '09:00', endTime: '09:45', sortOrder: 1 },
  { label: '09:45–10:30', startTime: '09:45', endTime: '10:30', sortOrder: 2 },
  { label: '10:30–11:15', startTime: '10:30', endTime: '11:15', sortOrder: 3 },
  { label: '11:15–12:00', startTime: '11:15', endTime: '12:00', sortOrder: 4 },
  { label: '12:00–12:45', startTime: '12:00', endTime: '12:45', sortOrder: 5 },
  { label: '12:45–13:30', startTime: '12:45', endTime: '13:30', sortOrder: 6 },
  { label: '13:30–14:15', startTime: '13:30', endTime: '14:15', sortOrder: 7 },
  { label: '14:15–15:00', startTime: '14:15', endTime: '15:00', sortOrder: 8 },
  { label: '15:00–15:45', startTime: '15:00', endTime: '15:45', sortOrder: 9 },
  { label: '15:45–16:30', startTime: '15:45', endTime: '16:30', sortOrder: 10 },
  { label: '16:30–17:15', startTime: '16:30', endTime: '17:15', sortOrder: 11 },
] as const;

/** Replace all clinic slot templates with 45-minute slots. */
export async function seedFortyFiveMinuteSlots(prisma: PrismaClient) {
  const clinicId = DEFAULT_CLINIC_ID;
  const deleted = await prisma.appointmentSlotTemplate.deleteMany({ where: { clinicId } });
  await prisma.appointmentSlotTemplate.createMany({
    data: SLOT_45_MIN.map((slot) => ({
      clinicId,
      label: slot.label,
      startTime: slot.startTime,
      endTime: slot.endTime,
      sortOrder: slot.sortOrder,
      isActive: true,
    })),
  });
  console.log(`   - Slot templates: removed ${deleted.count}, created ${SLOT_45_MIN.length} × 45-minute slots`);
  return { deleted: deleted.count, created: SLOT_45_MIN.length };
}
