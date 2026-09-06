import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../guards/super-admin.guard';
import { SkipSubscription } from './subscription.decorator';

/** JWT + SUPER_ADMIN + skip clinic subscription gate. */
export function PlatformAdmin() {
  return applyDecorators(
    ApiBearerAuth(),
    SkipSubscription(),
    UseGuards(JwtAuthGuard, SuperAdminGuard),
  );
}
