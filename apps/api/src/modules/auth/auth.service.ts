import {
  Injectable,
  UnauthorizedException,
  Logger,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { MailService } from '../mail/mail.module';
import { LoginDto } from './dto/login.dto';
import { ClinicSignupDto } from './dto/clinic-signup.dto';
import { User, PrismaClient } from '@prisma/client';
import {
  decryptSupportPassword,
  encryptSupportPassword,
  generateSupportPassword,
  supportEmailForSlug,
} from './support-credentials';

const GENERIC_LOGIN_ERROR = 'Invalid credentials';

export type ClinicSupportCredentials = {
  userId: string;
  email: string;
  password: string;
  clinicId: string;
  clinicName: string;
  clinicSlug: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
    @Inject('PRISMA_CLIENT') private prisma: PrismaClient,
    private auditService: AuditService,
    private subscriptions: SubscriptionService,
    private mail: MailService,
  ) {}

  async registerClinic(dto: ClinicSignupDto, ipAddress?: string, userAgent?: string) {
    const email = dto.email.trim().toLowerCase();
    const baseSlug = (dto.slug?.trim() || dto.clinicName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || `clinic-${Date.now().toString(36)}`;

    const existingEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingEmail) throw new ConflictException('Email already in use');

    let slug = baseSlug;
    for (let i = 0; i < 8; i += 1) {
      const taken = await this.prisma.clinic.findUnique({ where: { slug } });
      if (!taken) break;
      slug = `${baseSlug.slice(0, 40)}-${(i + 2).toString(36)}`.slice(0, 48);
    }
    const stillTaken = await this.prisma.clinic.findUnique({ where: { slug } });
    if (stillTaken) throw new ConflictException('Clinic slug already taken');

    const adminRole = await this.prisma.role.findFirst({ where: { name: 'ADMIN' } });
    if (!adminRole) {
      throw new BadRequestException('ADMIN role missing — run database seed');
    }

    const passwordHash = await argon2.hash(dto.password);
    const supportPassword = generateSupportPassword();
    const supportPasswordHash = await argon2.hash(supportPassword);
    const supportPasswordEnc = encryptSupportPassword(supportPassword);
    const supportEmail = supportEmailForSlug(slug);

    const { clinic, user } = await this.prisma.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: {
          name: dto.clinicName.trim(),
          slug,
          email,
          phone: dto.phone?.trim() || null,
          rciNumber: dto.rciNumber?.trim() || null,
          address: {
            street: dto.address.street?.trim() || undefined,
            city: dto.address.city.trim(),
            state: dto.address.state.trim(),
            pincode: dto.address.pincode.trim(),
            country: 'IN',
          },
          status: 'ACTIVE',
        },
      });

      const user = await tx.user.create({
        data: {
          clinicId: clinic.id,
          email,
          name: dto.adminName.trim(),
          mobile: dto.phone?.trim() || undefined,
          passwordHash,
          staffType: 'ADMIN',
          status: 'ACTIVE',
          roles: { create: [{ roleId: adminRole.id }] },
        },
        include: { roles: { include: { role: true } } },
      });

      await tx.user.create({
        data: {
          clinicId: clinic.id,
          email: supportEmail,
          name: `${clinic.name} Support Admin`,
          passwordHash: supportPasswordHash,
          supportPasswordEnc,
          isSystemSupport: true,
          staffType: 'ADMIN',
          status: 'ACTIVE',
          roles: { create: [{ roleId: adminRole.id }] },
        },
      });

      return { clinic, user };
    });

    await this.auditService.log({
      action: 'CLINIC_SIGNUP',
      entityType: 'Clinic',
      entityId: clinic.id,
      result: 'SUCCESS',
      clinicId: clinic.id,
      metadata: { email, slug, ipAddress, userAgent },
    });

    // Give each newly created clinic a paid plan trial immediately.
    // Access automatically turns off when `trialEnd` passes, forcing checkout/subscription.
    const planCode = (process.env.SAAS_DEFAULT_PLAN_CODE || 'STANDARD').toUpperCase();
    await this.subscriptions.createSubscription(clinic.id, planCode, user.id);

    // Mark clinic for post-subscription setup (letterhead + ID formats).
    await this.prisma.setting.upsert({
      where: { clinicId_key: { clinicId: clinic.id, key: 'clinic.setupComplete' } },
      update: { value: false },
      create: {
        clinicId: clinic.id,
        key: 'clinic.setupComplete',
        group: 'clinic',
        value: false,
      },
    });
    await this.prisma.setting.upsert({
      where: { clinicId_key: { clinicId: clinic.id, key: 'clinic.name' } },
      update: { value: clinic.name },
      create: {
        clinicId: clinic.id,
        key: 'clinic.name',
        group: 'clinic',
        value: clinic.name,
      },
    });

    const tokens = await this.issueSession(user as any);
    return {
      clinic: { id: clinic.id, name: clinic.name, slug: clinic.slug },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        clinicId: clinic.id,
        roles: ['ADMIN'],
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      // Dummy verify to reduce timing oracle
      await argon2.hash(loginDto.password).catch(() => undefined);
      await this.auditService.log({
        action: 'LOGIN_FAILED',
        entityType: 'user',
        entityId: loginDto.email,
        result: 'FAILURE',
        metadata: { reason: 'USER_NOT_FOUND', ipAddress, userAgent },
      });
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const passwordValid = await argon2.verify(user.passwordHash, loginDto.password);

    if (!passwordValid || user.status !== 'ACTIVE' || (user as any).staffType === 'THERAPIST') {
      await this.auditService.log({
        action: 'LOGIN_FAILED',
        entityType: 'user',
        entityId: user.id,
        result: 'FAILURE',
        metadata: {
          reason: !passwordValid
            ? 'INVALID_PASSWORD'
            : user.status !== 'ACTIVE'
              ? 'USER_INACTIVE'
              : 'THERAPIST_LOGIN_DISABLED',
          status: user.status,
          ipAddress,
          userAgent,
        },
      });
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    if (!(user as any).clinicId) {
      await this.auditService.log({
        action: 'LOGIN_FAILED',
        entityType: 'user',
        entityId: user.id,
        result: 'FAILURE',
        metadata: { reason: 'MISSING_CLINIC', ipAddress, userAgent },
      });
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueSession(user);

    await this.auditService.log({
      action: 'LOGIN_SUCCESS',
      entityType: 'user',
      entityId: user.id,
      result: 'SUCCESS',
      metadata: { ipAddress, userAgent },
      actorId: user.id,
    });

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken, // controller sets HttpOnly cookie; stripped from JSON response
    };
  }

  async logout(userId: string | null, refreshToken: string | undefined, ipAddress?: string, userAgent?: string) {
    let targetId = userId;
    if (!targetId && refreshToken) {
      const parsed = this.parseOpaqueToken(refreshToken);
      if (parsed) {
        const row = await this.prisma.user.findFirst({
          where: { refreshTokenId: parsed.id },
          select: { id: true },
        });
        targetId = row?.id || null;
      }
    }

    if (targetId) {
      await this.prisma.user.update({
        where: { id: targetId },
        data: { refreshTokenHash: null, refreshTokenId: null },
      });
      await this.auditService.log({
        action: 'LOGOUT',
        entityType: 'user',
        entityId: targetId,
        result: 'SUCCESS',
        metadata: { ipAddress, userAgent },
        actorId: targetId,
      });
    }

    return { success: true };
  }

  async refreshTokens(refreshToken: string, ipAddress?: string, userAgent?: string) {
    const parsed = this.parseOpaqueToken(refreshToken);
    if (!parsed) {
      await this.failRefresh(ipAddress, userAgent, 'MALFORMED');
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findFirst({
      where: { refreshTokenId: parsed.id },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (!user?.refreshTokenHash) {
      await this.failRefresh(ipAddress, userAgent, 'UNKNOWN_ID');
      throw new UnauthorizedException('Invalid refresh token');
    }

    const valid = await argon2.verify(user.refreshTokenHash, parsed.secret);
    if (!valid || user.status !== 'ACTIVE') {
      await this.failRefresh(ipAddress, userAgent, 'INVALID_OR_INACTIVE');
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.issueSession(user);

    await this.auditService.log({
      action: 'TOKEN_REFRESH',
      entityType: 'user',
      entityId: user.id,
      result: 'SUCCESS',
      metadata: { ipAddress, userAgent },
      actorId: user.id,
    });

    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async forgotPassword(email: string, ipAddress?: string, userAgent?: string) {
    const user = await this.usersService.findByEmail(email);

    // Always return success to prevent email enumeration
    if (!user) {
      return { success: true };
    }

    const { id, secret } = this.createOpaqueTokenParts();
    const resetTokenHash = await argon2.hash(secret);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenId: id,
        resetTokenHash,
        resetTokenExpiresAt: expiresAt,
      },
    });

    const resetToken = `${id}.${secret}`;
    const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const resetUrl = `${frontendBase}/reset-password/${encodeURIComponent(resetToken)}`;

    try {
      await this.mail.send({
        to: email,
        subject: 'Reset your SPHEAR password',
        text: `Use this link to reset your password (expires in 1 hour):\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
        html: `<p>Use this link to reset your password. It expires in <strong>1 hour</strong>.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
      });
    } catch (err) {
      this.logger.error(
        `Password reset email failed for ${email}: ${err instanceof Error ? err.message : err}`,
      );
      // Still return success below to avoid email enumeration.
    }

    // Dev fallback when SMTP (Mailpit) is not running — link is in API logs only.
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`Password reset link ready for ${email}. Open: ${resetUrl}`);
    }

    await this.auditService.log({
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'user',
      entityId: user.id,
      result: 'SUCCESS',
      metadata: { ipAddress, userAgent },
    });

    // In non-production return token so Mailpit-less local reset still works without log leak of random guessability
    if (process.env.NODE_ENV !== 'production' && process.env.EXPOSE_RESET_TOKEN === 'true') {
      return { success: true, resetToken };
    }

    return { success: true };
  }

  async resetPassword(token: string, newPassword: string, ipAddress?: string, userAgent?: string) {
    const parsed = this.parseOpaqueToken(token);
    if (!parsed) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const user = await this.prisma.user.findFirst({
      where: { resetTokenId: parsed.id },
    });

    if (
      !user?.resetTokenHash ||
      !user.resetTokenExpiresAt ||
      user.resetTokenExpiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const valid = await argon2.verify(user.resetTokenHash, parsed.secret);
    if (!valid) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await argon2.hash(newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetTokenHash: null,
        resetTokenId: null,
        resetTokenExpiresAt: null,
        refreshTokenHash: null,
        refreshTokenId: null,
      },
    });

    await this.auditService.log({
      action: 'PASSWORD_RESET',
      entityType: 'user',
      entityId: user.id,
      result: 'SUCCESS',
      metadata: { ipAddress, userAgent },
    });

    return { success: true };
  }

  async getProfile(userId: string, permissions: string[] = []) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    const roles = ((user as any).roles || []).map((ur: any) => ur.role?.name).filter(Boolean);
    const staff = await this.prisma.staffProfile.findFirst({
      where: { userId: user.id },
      select: { id: true, staffType: true, name: true },
    });
    const clinicId = (user as any).clinicId || null;
    const clinic = clinicId
      ? await this.prisma.clinic.findUnique({
          where: { id: clinicId },
          select: { id: true, name: true, slug: true },
        })
      : null;
    const subscriptionAccess = clinicId
      ? await this.subscriptions.checkAccess(clinicId)
      : {
          allowed: false,
          status: null,
          reason: 'SUBSCRIPTION_REQUIRED',
          features: [] as string[],
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null as string | null,
        };

    let setupComplete = true;
    if (clinicId && !(user as any).isSystemSupport) {
      const setupRow = await this.prisma.setting.findUnique({
        where: { clinicId_key: { clinicId, key: 'clinic.setupComplete' } },
      });
      if (setupRow) {
        const v = setupRow.value as unknown;
        setupComplete = v === true || v === 'true' || v === 1;
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      clinicId,
      clinic,
      staffType: (user as any).staffType || staff?.staffType || null,
      staffProfileId: staff?.id || null,
      status: (user as any).status,
      isSystemSupport: Boolean((user as any).isSystemSupport),
      roles,
      permissions,
      subscriptionAccess,
      setupComplete,
    };
  }

  /**
   * Ensure each clinic has a dedicated support ADMIN (full CRUD) for platform ops.
   * Password is recoverable for the platform console only (encrypted at rest).
   */
  async ensureClinicSupportAdmin(
    clinicId: string,
    opts?: { rotatePassword?: boolean },
  ): Promise<ClinicSupportCredentials> {
    const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) throw new NotFoundException('Clinic not found');

    const adminRole = await this.prisma.role.findFirst({ where: { name: 'ADMIN' } });
    if (!adminRole) {
      throw new BadRequestException('ADMIN role missing — run database seed');
    }

    const email = supportEmailForSlug(clinic.slug);
    let support = await this.prisma.user.findFirst({
      where: { clinicId, isSystemSupport: true },
    });

    if (!support) {
      support = await this.prisma.user.findUnique({ where: { email } });
      if (support && support.clinicId !== clinicId) {
        throw new ConflictException(
          `Support email ${email} is already used by another clinic`,
        );
      }
    }

    const needRotate =
      opts?.rotatePassword ||
      !support ||
      !support.supportPasswordEnc ||
      !support.isSystemSupport;

    if (!support) {
      const password = generateSupportPassword();
      const passwordHash = await argon2.hash(password);
      const supportPasswordEnc = encryptSupportPassword(password);
      support = await this.prisma.user.create({
        data: {
          clinicId: clinic.id,
          email,
          name: `${clinic.name} Support Admin`,
          passwordHash,
          supportPasswordEnc,
          isSystemSupport: true,
          staffType: 'ADMIN',
          status: 'ACTIVE',
          roles: { create: [{ roleId: adminRole.id }] },
        },
      });
      return {
        userId: support.id,
        email: support.email,
        password,
        clinicId: clinic.id,
        clinicName: clinic.name,
        clinicSlug: clinic.slug,
      };
    }

    if (needRotate) {
      const password = generateSupportPassword();
      const passwordHash = await argon2.hash(password);
      const supportPasswordEnc = encryptSupportPassword(password);
      support = await this.prisma.user.update({
        where: { id: support.id },
        data: {
          email,
          name: `${clinic.name} Support Admin`,
          passwordHash,
          supportPasswordEnc,
          isSystemSupport: true,
          staffType: 'ADMIN',
          status: 'ACTIVE',
          refreshTokenHash: null,
          refreshTokenId: null,
        },
      });
      // Ensure ADMIN role
      await this.prisma.userRole.upsert({
        where: {
          userId_roleId: { userId: support.id, roleId: adminRole.id },
        },
        create: { userId: support.id, roleId: adminRole.id },
        update: {},
      });
      return {
        userId: support.id,
        email: support.email,
        password,
        clinicId: clinic.id,
        clinicName: clinic.name,
        clinicSlug: clinic.slug,
      };
    }

    // Ensure ADMIN role present
    await this.prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: support.id, roleId: adminRole.id },
      },
      create: { userId: support.id, roleId: adminRole.id },
      update: {},
    });

    let password: string;
    try {
      password = decryptSupportPassword(support.supportPasswordEnc!);
    } catch {
      return this.ensureClinicSupportAdmin(clinicId, { rotatePassword: true });
    }

    return {
      userId: support.id,
      email: support.email,
      password,
      clinicId: clinic.id,
      clinicName: clinic.name,
      clinicSlug: clinic.slug,
    };
  }

  async loginAsClinicSupport(
    clinicId: string,
    actorUserId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const creds = await this.ensureClinicSupportAdmin(clinicId);
    const user = await this.usersService.findById(creds.userId);
    if (!user || (user as any).status !== 'ACTIVE') {
      throw new UnauthorizedException('Support account unavailable');
    }

    const tokens = await this.issueSession(user as any);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditService.log({
      action: 'PLATFORM_SUPPORT_LOGIN',
      entityType: 'Clinic',
      entityId: clinicId,
      result: 'SUCCESS',
      actorId: actorUserId,
      clinicId,
      metadata: {
        supportUserId: user.id,
        supportEmail: creds.email,
        ipAddress,
        userAgent,
      },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      clinic: {
        id: creds.clinicId,
        name: creds.clinicName,
        slug: creds.clinicSlug,
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        clinicId,
        roles: ['ADMIN'],
        isSystemSupport: true,
      },
      supportLogin: {
        email: creds.email,
        password: creds.password,
      },
    };
  }

  private async issueSession(user: User & { roles?: { role: { name: string } }[] }) {
    const accessToken = await this.signAccessToken(user);
    const { id, secret } = this.createOpaqueTokenParts();
    const refreshTokenHash = await argon2.hash(secret);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenId: id, refreshTokenHash },
    });

    return {
      accessToken,
      refreshToken: `${id}.${secret}`,
    };
  }

  private async signAccessToken(user: User & { roles?: { role: { name: string } }[] }) {
    let roles = user.roles?.map((r) => r.role.name).filter(Boolean) || [];
    if (!roles.length) {
      const profile = await this.usersService.findById(user.id);
      roles = ((profile as any)?.roles || []).map((ur: any) => ur.role?.name).filter(Boolean);
    }
    // Roles in JWT are informational only — JwtStrategy reloads from DB
    const payload = { sub: user.id, email: user.email, typ: 'access' as const };
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN') || '15m';
    return this.jwtService.signAsync(payload, { expiresIn });
  }

  private createOpaqueTokenParts() {
    const id = randomBytes(16).toString('hex');
    const secret = randomBytes(32).toString('base64url');
    return { id, secret };
  }

  private parseOpaqueToken(token: string): { id: string; secret: string } | null {
    const idx = token.indexOf('.');
    if (idx <= 0 || idx === token.length - 1) return null;
    const id = token.slice(0, idx);
    const secret = token.slice(idx + 1);
    if (!/^[a-f0-9]{32}$/i.test(id) || secret.length < 16) return null;
    return { id, secret };
  }

  private async failRefresh(ipAddress?: string, userAgent?: string, reason?: string) {
    await this.auditService.log({
      action: 'TOKEN_REFRESH_FAILED',
      entityType: 'user',
      result: 'FAILURE',
      metadata: { reason, ipAddress, userAgent },
    });
  }

  private sanitizeUser(user: User) {
    const {
      passwordHash: _p,
      refreshTokenHash: _r,
      refreshTokenId: _ri,
      resetTokenHash: _rt,
      resetTokenId: _rti,
      resetTokenExpiresAt: _rte,
      ...sanitized
    } = user as any;
    return sanitized;
  }
}
