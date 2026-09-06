import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'doctor@clinic.com' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'abc123def456' })
  @IsString()
  @MinLength(1)
  token!: string;

  @ApiProperty({ example: 'newPassword123' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}