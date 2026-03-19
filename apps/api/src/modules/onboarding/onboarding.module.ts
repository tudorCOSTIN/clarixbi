import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { DataSourceEntity } from '../data-sources/entities/data-source.entity';
import { SyncJob } from '../sync/entities/sync-job.entity';
import { ClickHouseModule } from '../clickhouse/clickhouse.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DataSourcesModule } from '../data-sources/data-sources.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DataSourceEntity, SyncJob]),
    ClickHouseModule,
    NotificationsModule,
    DataSourcesModule,
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
