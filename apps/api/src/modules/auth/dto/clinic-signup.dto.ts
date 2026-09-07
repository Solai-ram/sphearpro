import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ClinicSignupAddressDto {
  @ApiPropertyOptional({ example: '12 MG Road' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  street?: string;

  @ApiProperty({ example: 'Bengaluru' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city!: string;

  @ApiProperty({ example: 'Karnataka' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  state!: string;

  @ApiProperty({ example: '560001' })
  @IsString()
  @Matches(/^[1-9][0-9]{5}$/, { message: 'pincode must be a valid 6-digit Indian PIN code' })
  pincode!: string;
}

export class ClinicSignupDto {
  @ApiProperty({ example: 'Sunrise ENT Clinic' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  clinicName!: string;

  /** Optional — when omitted, server derives a unique slug from clinic name. */
  @ApiPropertyOptional({ example: 'sunrise-ent' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase letters, numbers, hyphens' })
  slug?: string;

  @ApiProperty({ example: 'Dr Admin' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  adminName!: string;

  @ApiProperty({ example: 'admin@sunrise.clinic' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SecurePass1!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiProperty({ type: ClinicSignupAddressDto })
  @ValidateNested()
  @Type(() => ClinicSignupAddressDto)
  address!: ClinicSignupAddressDto;

  @ApiPropertyOptional({ example: 'A12345' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  rciNumber?: string;
}
