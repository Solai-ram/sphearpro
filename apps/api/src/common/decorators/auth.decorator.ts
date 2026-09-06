import { UseGuards, applyDecorators } from '@nestjs/common';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { SubscriptionGuard } from '../guards/subscription.guard';
import { FeatureGuard } from '../guards/feature.guard';
import { RequirePermissions } from './require-permissions.decorator';
import { RequireFeature } from './subscription.decorator';

/**
 * Combined decorator that applies JWT authentication, subscription access,
 * optional feature gates, and permission checks in the correct order.
 *
 * Order: JwtAuthGuard → SubscriptionGuard → FeatureGuard → PermissionsGuard
 *
 * Usage:
 *   @Authenticated()
 *   @Authenticated('users.view')
 *   @Authenticated({ permissions: ['inventory.view'], features: ['INVENTORY'] })
 */
export function Authenticated(
  ...args: Array<string | { permissions?: string[]; features?: string[] }>
) {
  const permissions: string[] = [];
  const features: string[] = [];

  for (const arg of args) {
    if (typeof arg === 'string') {
      permissions.push(arg);
    } else if (arg && typeof arg === 'object') {
      if (arg.permissions) permissions.push(...arg.permissions);
      if (arg.features) features.push(...arg.features);
    }
  }

  const decorators: (ClassDecorator | MethodDecorator | PropertyDecorator)[] = [
    UseGuards(JwtAuthGuard, SubscriptionGuard, FeatureGuard),
  ];

  if (features.length > 0) {
    decorators.push(RequireFeature(...features));
  }

  if (permissions.length > 0) {
    decorators.push(RequirePermissions(...permissions));
    decorators.push(UseGuards(PermissionsGuard));
  }

  return applyDecorators(...decorators);
}
