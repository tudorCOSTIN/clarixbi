import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DataSourceEntity,
  DataSourceStatus,
  DataSourceType,
} from '../data-sources/entities/data-source.entity';
import { syncSmartbillQueue, syncWoocommerceQueue } from './queues.config';

@Injectable()
export class SyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncScheduler.name);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(DataSourceEntity)
    private readonly dataSourceRepo: Repository<DataSourceEntity>,
  ) {}

  onModuleInit() {
    this.intervalId = setInterval(() => this.checkForSyncs(), 60_000);
    this.logger.log('Sync scheduler started (checking every 60s)');
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private async checkForSyncs(): Promise<void> {
    try {
      const dataSources = await this.dataSourceRepo.find({
        where: {
          status: DataSourceStatus.ACTIVE,
        },
      });

      const now = new Date();

      for (const ds of dataSources) {
        if (!ds.last_sync_at) continue;

        const nextSyncAt = new Date(ds.last_sync_at.getTime() + ds.sync_interval_minutes * 60_000);

        if (now >= nextSyncAt) {
          this.logger.log(`Scheduling incremental sync for ${ds.id} (${ds.name})`);

          await this.dataSourceRepo.update(ds.id, {
            status: DataSourceStatus.SYNCING,
          });

          if (ds.type === DataSourceType.SMARTBILL) {
            await syncSmartbillQueue.add('sync', {
              dataSourceId: ds.id,
              orgId: ds.org_id,
              jobType: 'incremental',
            });
          } else if (ds.type === DataSourceType.WOOCOMMERCE) {
            await syncWoocommerceQueue.add('sync', {
              dataSourceId: ds.id,
              orgId: ds.org_id,
              jobType: 'incremental',
            });
          }
          // CSV data sources don't need incremental sync
        }
      }
    } catch (error) {
      this.logger.error(`Scheduler error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }
}
