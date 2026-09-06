import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';

describe('Phase 12 — document signed URL tenancy', () => {
  let prisma: any;
  let svc: DocumentsService;

  beforeEach(() => {
    prisma = {
      patientDocument: {
        findFirst: vi.fn(),
      },
      documentAccessLog: { create: vi.fn() },
      auditLog: { create: vi.fn() },
    };
    // DocumentsService constructs S3 client from env — provide minimal
    process.env.S3_ENDPOINT = 'http://localhost:9000';
    process.env.S3_ACCESS_KEY = 'x';
    process.env.S3_SECRET_KEY = 'y';
    process.env.S3_BUCKET = 'hislite-documents';
    svc = new DocumentsService(prisma as any);
  });

  it('findById scopes by clinicId (cross-tenant miss → 404)', async () => {
    prisma.patientDocument.findFirst.mockResolvedValue(null);
    await expect(svc.findById('doc_b', 'clinic_a')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.patientDocument.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc_b', clinicId: 'clinic_a' },
      }),
    );
  });

  it('getDownloadUrl refuses when document belongs to another clinic', async () => {
    prisma.patientDocument.findFirst.mockResolvedValue(null);
    await expect(svc.getDownloadUrl('doc_b', 'clinic_a', 'user_1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.documentAccessLog.create).not.toHaveBeenCalled();
  });
});
