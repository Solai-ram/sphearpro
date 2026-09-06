import { SetMetadata } from '@nestjs/common';

/** Skip SubscriptionGuard (billing, auth profile, webhooks handled separately). */
export const SKIP_SUBSCRIPTION_KEY = 'skipSubscription';
export const SkipSubscription = () => SetMetadata(SKIP_SUBSCRIPTION_KEY, true);

/** Require a PlanFeature code (e.g. INVENTORY). */
export const REQUIRE_FEATURE_KEY = 'requireFeature';
export const RequireFeature = (...features: string[]) =>
  SetMetadata(REQUIRE_FEATURE_KEY, features);
