import { HttpException, HttpStatus } from '@nestjs/common';

/** Subscription / payment API error codes (§79 + Razorpay provider). */
export const SAAS_ERROR = {
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
  SUBSCRIPTION_PAST_DUE: 'SUBSCRIPTION_PAST_DUE',
  SUBSCRIPTION_CANCELLED: 'SUBSCRIPTION_CANCELLED',
  FEATURE_NOT_AVAILABLE: 'FEATURE_NOT_AVAILABLE',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  PLAN_NOT_FOUND: 'PLAN_NOT_FOUND',
  INVALID_SUBSCRIPTION: 'INVALID_SUBSCRIPTION',
  RAZORPAY_NOT_CONFIGURED: 'RAZORPAY_NOT_CONFIGURED',
  RAZORPAY_PLAN_MISSING: 'RAZORPAY_PLAN_MISSING',
  RAZORPAY_PROVIDER_ERROR: 'RAZORPAY_PROVIDER_ERROR',
  INVALID_PAYMENT_SIGNATURE: 'INVALID_PAYMENT_SIGNATURE',
  INVALID_WEBHOOK_SIGNATURE: 'INVALID_WEBHOOK_SIGNATURE',
  SEAT_LIMIT_EXCEEDED: 'SEAT_LIMIT_EXCEEDED',
} as const;

export type SaasErrorCode = (typeof SAAS_ERROR)[keyof typeof SAAS_ERROR];

export class SaasHttpException extends HttpException {
  constructor(
    code: SaasErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        success: false,
        error: { code, message },
      },
      status,
    );
  }
}
