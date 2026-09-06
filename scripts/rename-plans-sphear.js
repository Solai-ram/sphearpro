const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.subscriptionPlan
  .updateMany({
    where: { OR: [{ name: 'MediOne Standard' }, { name: 'HIS Lite Standard' }] },
    data: { name: 'SPHEAR Standard' },
  })
  .then((r) => {
    console.log('updated', JSON.stringify(r));
    return p.$disconnect();
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
