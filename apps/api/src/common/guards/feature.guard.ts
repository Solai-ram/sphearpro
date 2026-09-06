import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionService } from '../../modules/subscription/subscription.service';
import { REQUIRE_FEATURE_KEY } from '../decorators/subscription.decorator';
import { SAAS_ERROR, SaasHttpException } from '../../modules/subscription/razorpay.errors';
import { HttpStatus } from '@nestjs/common';

/**
 * Requires one of the given PlanFeature codes on the clinic's current plan.
 * Must run after JWT (and preferably after SubscriptionGuard).
 */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private subscriptions: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRE_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    if (process.env.SUBSCRIPTION_ENFORCE === 'false') return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return true;

    const roles: string[] = user.roles || [];
    if (roles.includes('SUPER_ADMIN')) return true;

    const clinicId = user.clinicId as string | undefined;
    if (!clinicId) {
      throw new SaasHttpException(
        SAAS_ERROR.FEATURE_NOT_AVAILABLE,
        'Feature not available without a clinic',
        HttpStatus.FORBIDDEN,
      );
    }

    let features: string[] = request.subscriptionAccess?.features;
    if (!features) {
      const access = await this.subscriptions.checkAccess(clinicId);
      request.subscriptionAccess = access;
      features = access.features || [];
    }

    const ok = required.some((code) => features.includes(code));
    if (!ok) {
      throw new SaasHttpException(
        SAAS_ERROR.FEATURE_NOT_AVAILABLE,
        `Feature not available on your plan: ${required.join(', ')}`,
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
