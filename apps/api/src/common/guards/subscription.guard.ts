import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionService } from '../../modules/subscription/subscription.service';
import { SKIP_SUBSCRIPTION_KEY } from '../decorators/subscription.decorator';
import { SAAS_ERROR, SaasHttpException } from '../../modules/subscription/razorpay.errors';
import { HttpStatus } from '@nestjs/common';
import { accessWhileCancelPending, canAccessHis } from '../../modules/subscription/subscription-state';

/**
 * Enforces SaaS subscription access after JWT auth.
 * Allowlist via @SkipSubscription(); public routes have no user → pass-through.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionGuard.name);

  constructor(
    private reflector: Reflector,
    private subscriptions: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.SUBSCRIPTION_ENFORCE === 'false') {
      return true;
    }

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_SUBSCRIPTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return true; // unauthenticated routes

    // Platform operators (Phase 9) — skip clinic subscription
    const roles: string[] = user.roles || [];
    if (roles.includes('SUPER_ADMIN')) return true;

    const clinicId = user.clinicId as string | undefined;
    if (!clinicId) {
      throw new SaasHttpException(
        SAAS_ERROR.SUBSCRIPTION_REQUIRED,
        'User is not linked to a clinic',
        HttpStatus.FORBIDDEN,
      );
    }

    const access = await this.subscriptions.checkAccess(clinicId);
    request.subscriptionAccess = access;

    if (access.allowed) return true;

    const code = mapReasonToCode(access.reason, access.status);
    this.logger.debug(
      `Blocked clinic=${clinicId} status=${access.status} reason=${access.reason}`,
    );
    throw new SaasHttpException(
      code,
      messageForCode(code),
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}

/** Pure helpers for unit tests (mirror checkAccess policy). */
export function evaluateSubscriptionGate(input: {
  status: string | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | null;
  trialEnd?: Date | null;
}): { allowed: boolean; reason: string | null } {
  if (!input.status) {
    return { allowed: false, reason: 'SUBSCRIPTION_REQUIRED' };
  }
  if (input.status === 'TRIALING' && !input.trialEnd) {
    return { allowed: false, reason: 'PAYMENT_REQUIRED' };
  }
  if (input.status === 'TRIALING' && input.trialEnd && input.trialEnd.getTime() <= Date.now()) {
    return { allowed: false, reason: 'TRIAL_EXPIRED' };
  }
  const allowed = accessWhileCancelPending(
    input.status as any,
    Boolean(input.cancelAtPeriodEnd),
    input.currentPeriodEnd,
  );
  if (allowed) return { allowed: true, reason: null };
  if (!canAccessHis(input.status as any)) {
    if (input.status === 'EXPIRED') return { allowed: false, reason: 'SUBSCRIPTION_EXPIRED' };
    if (input.status === 'CANCELLED') return { allowed: false, reason: 'SUBSCRIPTION_CANCELLED' };
    if (input.status === 'PAST_DUE' || input.status === 'PAYMENT_FAILED') {
      return { allowed: false, reason: 'SUBSCRIPTION_PAST_DUE' };
    }
    return { allowed: false, reason: 'SUBSCRIPTION_REQUIRED' };
  }
  return { allowed: false, reason: 'PAYMENT_REQUIRED' };
}

function mapReasonToCode(reason: string | null, status: string | null) {
  if (reason === 'TRIAL_EXPIRED') return SAAS_ERROR.PAYMENT_REQUIRED;
  if (reason === 'SUBSCRIPTION_EXPIRED' || status === 'EXPIRED') return SAAS_ERROR.SUBSCRIPTION_EXPIRED;
  if (reason === 'SUBSCRIPTION_CANCELLED' || status === 'CANCELLED') return SAAS_ERROR.SUBSCRIPTION_CANCELLED;
  if (reason === 'SUBSCRIPTION_PAST_DUE' || status === 'PAST_DUE') return SAAS_ERROR.SUBSCRIPTION_PAST_DUE;
  if (reason === 'PAYMENT_REQUIRED') return SAAS_ERROR.PAYMENT_REQUIRED;
  return SAAS_ERROR.SUBSCRIPTION_REQUIRED;
}

function messageForCode(code: string): string {
  switch (code) {
    case SAAS_ERROR.SUBSCRIPTION_EXPIRED:
      return 'Your subscription has expired. Please renew your plan.';
    case SAAS_ERROR.SUBSCRIPTION_CANCELLED:
      return 'Your subscription is cancelled. Please reactivate to continue.';
    case SAAS_ERROR.SUBSCRIPTION_PAST_DUE:
      return 'Your subscription payment is past due.';
    case SAAS_ERROR.PAYMENT_REQUIRED:
      return 'Your free trial has ended. Please subscribe to continue using SPHEAR.';
    default:
      return 'An active subscription is required.';
  }
}
