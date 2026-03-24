import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';
import { DataSource } from '../data-sources/entities/data-source.entity';
import { Dashboard } from '../dashboards/entities/dashboard.entity';
import { Alert } from '../alerts/entities/alert.entity';
import { AlertTrigger } from '../alerts/entities/alert-trigger.entity';
import { SyncJob } from '../sync/entities/sync-job.entity';
import { ClickHouseModule } from '../clickhouse/clickhouse.module';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DataSource, Dashboard, Alert, AlertTrigger, SyncJob]),
    ClickHouseModule,
    AuthModule,
    BillingModule,
  ],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
