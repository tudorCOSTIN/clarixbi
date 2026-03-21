import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { dataSourceOptions } from './config/database.config';
import { getLoggerConfig } from './common/logger';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-behind-proxy.guard';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { TeamsModule } from './modules/teams/teams.module';
import { DataSourcesModule } from './modules/data-sources/data-sources.module';
import { SyncModule } from './modules/sync/sync.module';
import { DashboardsModule } from './modules/dashboards/dashboards.module';
import { WidgetsModule } from './modules/widgets/widgets.module';
import { AiModule } from './modules/ai/ai.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { BillingModule } from './modules/billing/billing.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AdminModule } from './modules/admin/admin.module';
import { ClickHouseModule } from './modules/clickhouse/clickhouse.module';
import { GdprModule } from './modules/gdpr/gdpr.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(dataSourceOptions),
    LoggerModule.forRoot(getLoggerConfig()),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    ScheduleModule.forRoot(),
    ClickHouseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    TeamsModule,
    DataSourcesModule,
    SyncModule,
    DashboardsModule,
    WidgetsModule,
    AiModule,
    ReportsModule,
    AlertsModule,
    BillingModule,
    NotificationsModule,
    OnboardingModule,
    SettingsModule,
    AdminModule,
    GdprModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
