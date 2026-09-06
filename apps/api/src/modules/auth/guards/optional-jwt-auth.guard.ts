import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Attempts JWT auth but never blocks the request (used for logout). */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const result = await super.canActivate(context);
      return result as boolean;
    } catch {
      return true;
    }
  }

  handleRequest<TUser = any>(_err: Error | null, user: TUser): TUser {
    return (user || null) as TUser;
  }
}
