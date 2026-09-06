import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { AuditService } from '../audit/audit.service';
import { disconnectTestPrisma, getTestPrisma, truncateAll, describeDb } from '../../test/prisma-test';
import { createTestTenant } from '../../test/tenant-factory';

describeDb('PatientsService (database)', () => {
  let prisma: PrismaClient | null;
  let patients: PatientsService;

  beforeAll(async () => {
    prisma = await getTestPrisma();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  beforeEach(async () => {
    if (!prisma) return;
    await truncateAll(prisma);
    patients = new PatientsService(prisma, new AuditService(prisma));
  });

  it('assigns sequential patient numbers and writes PATIENT_CREATED audit', async () => {
    if (!prisma) return;
    const tenant = await createTestTenant(prisma);
    const a = await patients.create({
      clinicId: tenant.clinic.id,
      name: 'Ada',
      createdBy: tenant.adminUser.id,
    });
    const b = await patients.create({
      clinicId: tenant.clinic.id,
      name: 'Bob',
      createdBy: tenant.adminUser.id,
    });
    expect(a.patientNumber).toBe('P000001');
    expect(b.patientNumber).toBe('P000002');
    const logs = await prisma.auditLog.findMany({ where: { action: 'PATIENT_CREATED' } });
    expect(logs).toHaveLength(2);
  });

  it('rejects duplicate phone in the same clinic', async () => {
    if (!prisma) return;
    const tenant = await createTestTenant(prisma);
    await patients.create({
      clinicId: tenant.clinic.id,
      name: 'Ada',
      phone: '9990001111',
    });
    await expect(
      patients.create({
        clinicId: tenant.clinic.id,
        name: 'Ada 2',
        phone: '9990001111',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
