import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateRazorpayOrderDto {
  /** Amount in paise (minimum 100). */
  @Type(() => Number)
  @IsInt()
  @Min(100)
  amount!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  currency?: string;

  @IsOptional()
  @IsString()
  receipt?: string;
}

export class VerifyRazorpayPaymentDto {
  @IsString()
  @MinLength(1)
  razorpay_order_id!: string;

  @IsString()
  @MinLength(1)
  razorpay_payment_id!: string;

  @IsString()
  @MinLength(1)
  razorpay_signature!: string;
}
