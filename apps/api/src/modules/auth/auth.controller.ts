import { Controller, Post, Body, Res, HttpCode, HttpStatus, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ClinicSignupDto } from './dto/clinic-signup.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { THROTTLE_POLICY } from './auth-throttle.policy';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api',
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api',
    });
  }

  @Post('clinic-signup')
  @Throttle({
    default: { limit: THROTTLE_POLICY.clinicSignup.limit, ttl: THROTTLE_POLICY.clinicSignup.ttlMs },
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Public clinic registration (creates Clinic + ADMIN user)' })
  async clinicSignup(
    @Body() dto: ClinicSignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.registerClinic(dto, req.ip, req.get('user-agent'));
    this.setRefreshCookie(res, result.refreshToken);
    return {
      clinic: result.clinic,
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('login')
  @Throttle({ default: { limit: THROTTLE_POLICY.login.limit, ttl: THROTTLE_POLICY.login.ttlMs } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto, req.ip, req.get('user-agent'));
    this.setRefreshCookie(res, result.refreshToken);
    // Never return refreshToken in JSON (XSS mitigation)
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'User logout (clears refresh cookie even without Bearer)' })
  async logout(
    @CurrentUser('id') userId: string | undefined,
    @CurrentUser('sub') sub: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    await this.authService.logout(userId || sub || null, refreshToken, req.ip, req.get('user-agent'));
    this.clearRefreshCookie(res);
    return { success: true };
  }

  @Post('refresh')
  @Throttle({ default: { limit: THROTTLE_POLICY.refresh.limit, ttl: THROTTLE_POLICY.refresh.ttlMs } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(
    @Body() body: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken || body?.refreshToken;
    if (!refreshToken) {
      return { accessToken: null };
    }

    const tokens = await this.authService.refreshTokens(refreshToken, req.ip, req.get('user-agent'));
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post('forgot-password')
  @Throttle({
    default: {
      limit: THROTTLE_POLICY.forgotPassword.limit,
      ttl: THROTTLE_POLICY.forgotPassword.ttlMs,
    },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.authService.forgotPassword(dto.email, req.ip, req.get('user-agent'));
  }

  @Post('reset-password')
  @Throttle({
    default: {
      limit: THROTTLE_POLICY.resetPassword.limit,
      ttl: THROTTLE_POLICY.resetPassword.ttlMs,
    },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.authService.resetPassword(dto.token, dto.newPassword, req.ip, req.get('user-agent'));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async me(@CurrentUser() jwtUser: any) {
    const userId = jwtUser?.sub || jwtUser?.id;
    return this.authService.getProfile(userId, jwtUser?.permissions || []);
  }
}
