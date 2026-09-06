import { describe, expect, it, vi } from 'vitest';
import { INestApplication, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PatientsController } from '../patients/patients.controller';
import { PatientsService } from '../patients/patients.service';
import { DocumentsService } from '../documents/documents.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { createHttpApp, defaultTestUser, http } from '../../test/http-app';

describe('PermissionsGuard on PatientsController', () => {
  it('returns 403 when the user lacks patients.view', async () => {
    let app: INestApplication | undefined;
    try {
      app = await createHttpApp({
        controllers: [PatientsController],
        providers: [
          {
            provide: PatientsService,
            useValue: { findAll: vi.fn() },
          },
          { provide: DocumentsService, useValue: {} },
        ],
        user: {
          ...defaultTestUser,
          roles: ['DOCTOR'],
          permissions: [],
        },
        enforcePermissions: true,
      });
      const res = await http(app).get('/patients');
      expect(res.status).toBe(403);
    } finally {
      await app?.close();
    }
  });
});

describe('PermissionsGuard unit via HTTP-shaped context', () => {
  it('is a CanActivate', () => {
    const guard = new PermissionsGuard({ getAllAndOverride: () => ['x'] } as any);
    expect(typeof guard.canActivate).toBe('function');
    expect(() =>
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => ({ user: { roles: [], permissions: [] } }) }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext),
    ).toThrow(ForbiddenException);
  });
});
