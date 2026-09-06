import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Authenticated } from '../../common/decorators/auth.decorator';
import { SkipSubscription } from '../../common/decorators/subscription.decorator';
import { RazorpayService } from './razorpay.service';
import { CreateRazorpayOrderDto, VerifyRazorpayPaymentDto } from './razorpay-payments.dto';
import { SAAS_ERROR, SaasHttpException } from './razorpay.errors';

/**
 * Razorpay Standard Web Checkout helpers.
 * Routes (Nest versioned): POST /api/v1/payments/create-order | verify-payment
 */
@ApiTags('Payments')
@Controller('payments')
@SkipSubscription()
export class RazorpayPaymentsController {
  constructor(private readonly razorpay: RazorpayService) {}

  @Post('create-order')
  @ApiBearerAuth()
  @Authenticated()
  @ApiOperation({ summary: 'Create a Razorpay order for Standard Checkout' })
  async createOrder(@Body() body: CreateRazorpayOrderDto) {
    const order = await this.razorpay.createOrder({
      amount: body.amount,
      currency: body.currency,
      receipt: body.receipt,
    });
    return {
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: this.razorpay.getPublicKeyId(),
    };
  }

  @Post('verify-payment')
  @ApiBearerAuth()
  @Authenticated()
  @ApiOperation({ summary: 'Verify Razorpay Standard Checkout payment signature' })
  async verifyPayment(@Body() body: VerifyRazorpayPaymentDto) {
    if (!body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature) {
      throw new SaasHttpException(
        SAAS_ERROR.INVALID_PAYMENT_SIGNATURE,
        'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const ok = this.razorpay.verifyPayment(
      body.razorpay_order_id,
      body.razorpay_payment_id,
      body.razorpay_signature,
    );
    if (!ok) {
      throw new SaasHttpException(
        SAAS_ERROR.INVALID_PAYMENT_SIGNATURE,
        'Payment signature mismatch — payment not marked as paid',
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      success: true,
      verified: true,
      razorpay_order_id: body.razorpay_order_id,
      razorpay_payment_id: body.razorpay_payment_id,
    };
  }
}
