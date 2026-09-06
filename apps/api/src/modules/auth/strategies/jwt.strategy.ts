import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => req?.cookies?.accessToken,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // Reject anything that is not an access token (opaque refresh is not a JWT;
    // still block typ=refresh if an old token shape appears).
    if (payload?.typ && payload.typ !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || (user as any).status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    if (!(user as any).clinicId) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const roles = ((user as any).roles || [])
      .map((ur: any) => ur.role?.name)
      .filter(Boolean) as string[];

    const rolePermissions = ((user as any).roles || []).flatMap((ur: any) =>
      (ur.role?.rolePermissions || [])
        .filter((rp: any) => rp.granted)
        .map((rp: any) => rp.permission?.name),
    );

    const directPermissions = ((user as any).userPermissions || [])
      .filter((up: any) => up.granted)
      .map((up: any) => up.permission?.name);

    const permissions = Array.from(
      new Set([...rolePermissions, ...directPermissions].filter(Boolean)),
    );

    return {
      sub: payload.sub,
      id: payload.sub,
      email: (user as any).email,
      clinicId: (user as any).clinicId,
      // Always from DB — never trust JWT-embedded roles
      roles,
      permissions,
    };
  }
}
