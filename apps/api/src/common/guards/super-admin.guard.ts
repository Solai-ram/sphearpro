import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/** Requires JWT user to have SUPER_ADMIN role (platform operator). */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const roles: string[] = request.user?.roles || [];
    if (!roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Platform SUPER_ADMIN role required',
        },
      });
    }
    return true;
  }
}
