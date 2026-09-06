/**
 * Run: npx ts-node --esm prisma/run-seed-slots-45.ts
 * Replaces clinic slot templates with 45-minute slots and reseeds upcoming appointments.
 */
import { PrismaClient } from '@prisma/client';
import { seedFortyFiveMinuteSlots } from './seed-slot-templates.ts';
import { seedUpcomingTherapyAppointments } from './seed-upcoming-appointments.ts';

const prisma = new PrismaClient();

async function main() {
  console.log('Switching clinic to 45-minute slots…');
  await seedFortyFiveMinuteSlots(prisma);
  await seedUpcomingTherapyAppointments(prisma);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
