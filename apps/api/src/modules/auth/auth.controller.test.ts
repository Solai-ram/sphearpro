import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { createHttpApp, http } from '../../test/http-app';

describe('AuthController (HTTP)', () => {
  let app: INestApplication;
  const authService = {
    getProfile: vi.fn().mockResolvedValue({
      id: 'user_admin_1',
      email: 'admin@example.com',
      clinicId: 'clinic_a',
      roles: ['ADMIN'],
    }),
  };

  beforeAll(async () => {
    app = await createHttpApp({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /auth/me returns the authenticated profile', async () => {
    const res = await http(app).get('/auth/me');
    expect(res.status).toBe(200);
    expect(authService.getProfile).toHaveBeenCalledWith('user_admin_1', expect.any(Array));
    expect(res.body.email).toBe('admin@example.com');
  });
});
