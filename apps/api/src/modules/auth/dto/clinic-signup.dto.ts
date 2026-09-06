import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClinicSignupDto {
  @ApiProperty({ example: 'Sunrise ENT Clinic' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  clinicName!: string;

  @ApiProperty({ example: 'sunrise-ent' })
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase letters, numbers, hyphens' })
  slug!: string;

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
}
