import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(@Inject('PRISMA_CLIENT') private prisma: any) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
      };
    } catch {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
      };
    }
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check' })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch {
      return { status: 'not ready' };
    }
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness check' })
  async live() {
    return { status: 'alive' };
  }
}
