import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { dataSourceOptions } from './config/database.config';
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

@Module({
  imports: [
    TypeOrmModule.forRoot(dataSourceOptions),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env['NODE_ENV'] !== 'production' ? { target: 'pino-pretty' } : undefined,
      },
    }),
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
  ],
})
export class AppModule {}
