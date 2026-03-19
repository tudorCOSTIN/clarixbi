import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullBoardModule } from './bull-board.module';
import { SyncProcessor } from './sync.processor';
import { WooCommerceSyncProcessor } from './woocommerce-sync.processor';
import { CsvSyncProcessor } from './csv-sync.processor';
import { SyncScheduler } from './sync.scheduler';
import { DataSourceEntity } from '../data-sources/entities/data-source.entity';
import { SyncJob } from './entities/sync-job.entity';
import { ClickHouseModule } from '../clickhouse/clickhouse.module';
import { NotificationsModule } from '../notifications/notifications.module';
// Queues are initialized on import
import './queues.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([DataSourceEntity, SyncJob]),
    ClickHouseModule,
    NotificationsModule,
    BullBoardModule,
  ],
  providers: [SyncProcessor, WooCommerceSyncProcessor, CsvSyncProcessor, SyncScheduler],
})
export class SyncModule {}
