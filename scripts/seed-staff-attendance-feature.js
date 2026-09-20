const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const f = await prisma.feature.upsert({
      where: { code: 'STAFF_ATTENDANCE' },
      update: {
        name: 'Staff attendance',
        description: 'GPS/device/biometric staff check-in, shifts, and reports',
        module: 'attendance',
      },
      create: {
        code: 'STAFF_ATTENDANCE',
        name: 'Staff attendance',
        description: 'GPS/device/biometric staff check-in, shifts, and reports',
        module: 'attendance',
      },
    });
    const plans = await prisma.subscriptionPlan.findMany({
      where: { code: { in: ['STANDARD', 'STANDARD_YEARLY'] } },
      select: { id: true, code: true },
    });
    for (const p of plans) {
      await prisma.planFeature.upsert({
        where: { planId_featureId: { planId: p.id, featureId: f.id } },
        update: {},
        create: { planId: p.id, featureId: f.id },
      });
      console.log('linked', p.code);
    }
    console.log('feature', f.code, f.id);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
