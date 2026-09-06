/**
 * Run: npx ts-node --esm prisma/run-seed-upcoming.ts
 * Seeds SCHEDULED therapy sessions from today through ~14 days.
 */
import { PrismaClient } from '@prisma/client';
import { seedUpcomingTherapyAppointments } from './seed-upcoming-appointments.ts';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding upcoming therapy appointments from today…');
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
