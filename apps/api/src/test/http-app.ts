import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { FeatureGuard } from '../common/guards/feature.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

export type TestUser = {
  sub: string;
  id: string;
  clinicId: string;
  email?: string;
  roles: string[];
  permissions: string[];
};

export const defaultTestUser: TestUser = {
  sub: 'user_admin_1',
  id: 'user_admin_1',
  clinicId: 'clinic_a',
  email: 'admin@example.com',
  roles: ['ADMIN'],
  permissions: [
    'patients.view',
    'patients.create',
    'therapy.case.create',
    'therapy.package.view',
    'billing.invoice.create',
    'billing.invoice.view',
  ],
};

class StaticGuard implements CanActivate {
  constructor(private readonly user: TestUser | null, private readonly allow: boolean) {}
  canActivate(context: ExecutionContext) {
    if (!this.allow) return false;
    const req = context.switchToHttp().getRequest();
    if (this.user) req.user = this.user;
    return true;
  }
}

export async function createHttpApp(opts: {
  controllers: any[];
  providers?: any[];
  user?: TestUser | null;
  enforcePermissions?: boolean;
}): Promise<INestApplication> {
  const user = opts.user === undefined ? defaultTestUser : opts.user;
  const builder = Test.createTestingModule({
    controllers: opts.controllers,
    providers: [Reflector, ...(opts.providers || [])],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue(new StaticGuard(user, true))
    .overrideGuard(SubscriptionGuard)
    .useValue(new StaticGuard(user, true))
    .overrideGuard(FeatureGuard)
    .useValue(new StaticGuard(user, true));

  if (!opts.enforcePermissions) {
    builder.overrideGuard(PermissionsGuard).useValue(new StaticGuard(user, true));
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

export function http(app: INestApplication) {
  return request(app.getHttpServer());
}
