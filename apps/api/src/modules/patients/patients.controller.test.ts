import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { DocumentsService } from '../documents/documents.service';
import { createHttpApp, http } from '../../test/http-app';

describe('PatientsController (HTTP)', () => {
  let app: INestApplication;
  const patientsService = {
    findAll: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0 } }),
    create: vi.fn().mockImplementation(async (data: any) => ({
      id: 'pat_1',
      patientNumber: 'P000001',
      name: data.name,
      clinicId: data.clinicId,
    })),
  };

  beforeAll(async () => {
    app = await createHttpApp({
      controllers: [PatientsController],
      providers: [
        { provide: PatientsService, useValue: patientsService },
        { provide: DocumentsService, useValue: {} },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /patients uses clinicId from the authenticated user', async () => {
    const res = await http(app).get('/patients');
    expect(res.status).toBe(200);
    expect(patientsService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: 'clinic_a' }),
    );
  });

  it('POST /patients ignores body.clinicId', async () => {
    const res = await http(app)
      .post('/patients')
      .send({ name: 'Ada', clinicId: 'attacker-clinic' });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(patientsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ada', clinicId: 'clinic_a' }),
    );
    expect(patientsService.create.mock.calls[0][0].clinicId).not.toBe('attacker-clinic');
  });
});
