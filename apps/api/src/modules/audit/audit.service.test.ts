import { describe, expect, it, vi } from 'vitest';
import { AuditService } from './audit.service';
import { createMockPrisma } from '../../test/mock-prisma';

describe('AuditService', () => {
  it('writes a structured audit row', async () => {
    const prisma = createMockPrisma();
    prisma.auditLog.create.mockResolvedValue({ id: 'a1' });
    const svc = new AuditService(prisma);
    await svc.log({
      clinicId: 'c1',
      actorId: 'u1',
      action: 'PATIENT_VIEWED',
      entityType: 'Patient',
      entityId: 'p1',
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PATIENT_VIEWED',
          result: 'SUCCESS',
          clinicId: 'c1',
        }),
      }),
    );
  });

  it('parses JSON metadata in findById', async () => {
    const prisma = createMockPrisma();
    prisma.auditLog.findFirst.mockResolvedValue({
      id: 'a1',
      metadata: '{"k":1}',
    });
    const svc = new AuditService(prisma);
    const row = await svc.findById('a1', 'c1');
    expect(row?.metadata).toEqual({ k: 1 });
  });
});
