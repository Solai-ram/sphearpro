import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { PatientsModule } from './modules/patients/patients.module';
import { ClinicalModule } from './modules/clinical/clinical.module';
import { TherapyModule } from './modules/therapy/therapy.module';
import { BillingModule } from './modules/billing/billing.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { LabModule } from './modules/lab/lab.module';
import { ServicesModule } from './modules/services/services.module';
import { AiModule } from './modules/ai/ai.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { StaffModule } from './modules/staff/staff.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { AuditModule } from './modules/audit/audit.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { MailModule } from './modules/mail/mail.module';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './common/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      // Ensure process.env from loadEnvFiles() / shell is not wiped; Nest still merges files.
      ignoreEnvVars: false,
    }),
    // Local load tests share one IP; raise THROTTLE_LIMIT or set DISABLE_THROTTLE=true
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL || 60_000),
        limit:
          process.env.DISABLE_THROTTLE === 'true'
            ? 1_000_000
            : Number(process.env.THROTTLE_LIMIT || 100),
      },
    ]),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'redis',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    }),
    PrismaModule,
    MailModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    PatientsModule,
    ClinicalModule,
    TherapyModule,
    BillingModule,
    InventoryModule,
    LabModule,
    ServicesModule,
    AiModule,
    DocumentsModule,
    StaffModule,
    AppointmentsModule,
    CommunicationModule,
    DashboardModule,
    SettingsModule,
    SubscriptionModule,
    AuditModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
