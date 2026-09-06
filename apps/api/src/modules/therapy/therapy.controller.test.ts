import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { TherapyController } from './therapy.controller';
import { TherapyService } from './therapy.service';
import { createHttpApp, http } from '../../test/http-app';

describe('TherapyController (HTTP)', () => {
  let app: INestApplication;
  const therapyService = {
    listTypes: vi.fn().mockResolvedValue([{ id: 't1', name: 'Speech' }]),
  };

  beforeAll(async () => {
    app = await createHttpApp({
      controllers: [TherapyController],
      providers: [{ provide: TherapyService, useValue: therapyService }],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /therapy/types uses clinic context', async () => {
    const res = await http(app).get('/therapy/types');
    expect(res.status).toBe(200);
    expect(therapyService.listTypes).toHaveBeenCalledWith('clinic_a');
  });
});
