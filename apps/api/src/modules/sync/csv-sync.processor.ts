import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Worker, Job } from 'bullmq';
import { v4 as uuid } from 'uuid';
import { DataSourceEntity, DataSourceStatus } from '../data-sources/entities/data-source.entity';
import { SyncJob, SyncJobStatus, SyncJobType } from './entities/sync-job.entity';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { QUEUE_CONFIGS } from './queues.config';

interface CsvSyncJobData {
  dataSourceId: string;
  orgId: string;
  jobType: 'initial';
  rows: Record<string, string>[];
  schema: { name: string; type: string }[];
}

const BATCH_SIZE = 1000;

@Injectable()
export class CsvSyncProcessor implements OnModuleInit {
  private readonly logger = new Logger(CsvSyncProcessor.name);
  private worker!: Worker;

  constructor(
    @InjectRepository(DataSourceEntity)
    private readonly dataSourceRepo: Repository<DataSourceEntity>,
    @InjectRepository(SyncJob)
    private readonly syncJobRepo: Repository<SyncJob>,
    private readonly clickhouse: ClickHouseService,
    private readonly gateway: NotificationsGateway,
  ) {}

  onModuleInit() {
    const redisUrl = process.env['REDIS_URL'];
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is required');
    }
    const parsed = new URL(redisUrl);
    const connection = {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password || undefined,
      maxRetriesPerRequest: null,
    };

    const queueConfig = QUEUE_CONFIGS.find((q) => q.name === 'sync-csv');

    this.worker = new Worker('sync-csv', async (job: Job<CsvSyncJobData>) => this.process(job), {
      connection,
      concurrency: queueConfig?.concurrency ?? 2,
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`CSV job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log('CSV sync worker started');
  }

  private async process(job: Job<CsvSyncJobData>): Promise<void> {
    const { dataSourceId, orgId, rows } = job.data;

    const syncJob = this.syncJobRepo.create({
      id: uuid(),
      data_source_id: dataSourceId,
      org_id: orgId,
      status: SyncJobStatus.RUNNING,
      job_type: SyncJobType.INITIAL,
      started_at: new Date(),
      rows_imported: 0,
      rows_updated: 0,
      rows_failed: 0,
    });
    await this.syncJobRepo.save(syncJob);

    await this.dataSourceRepo.update(dataSourceId, { status: DataSourceStatus.SYNCING });

    try {
      this.gateway.emitSyncProgress(orgId, {
        dataSourceId,
        progress: 0,
        rowsImported: 0,
      });

      // Insert rows into csv_data table
      const csvRows = rows.map((row, index) => ({
        id: uuid(),
        org_id: orgId,
        data_source_id: dataSourceId,
        row_data: JSON.stringify(row),
        row_number: index + 1,
        imported_at: new Date().toISOString().replace('T', ' ').split('.')[0],
      }));

      let imported = 0;
      for (let i = 0; i < csvRows.length; i += BATCH_SIZE) {
        const batch = csvRows.slice(i, i + BATCH_SIZE);
        await this.clickhouse.insert('csv_data', batch);
        imported += batch.length;

        const progress = Math.min(95, Math.round((imported / csvRows.length) * 95));
        this.gateway.emitSyncProgress(orgId, {
          dataSourceId,
          progress,
          rowsImported: imported,
        });
      }

      // Update data source
      await this.dataSourceRepo.update(dataSourceId, {
        status: DataSourceStatus.ACTIVE,
        last_sync_at: new Date(),
        total_rows: imported,
      });

      await this.syncJobRepo.update(syncJob.id, {
        status: SyncJobStatus.COMPLETED,
        completed_at: new Date(),
        rows_imported: imported,
      });

      this.gateway.emitSyncProgress(orgId, {
        dataSourceId,
        progress: 100,
        rowsImported: imported,
      });

      this.gateway.emitSyncComplete(orgId, {
        dataSourceId,
        totalRows: imported,
      });

      this.logger.log(`CSV import completed for ${dataSourceId}: ${imported} rows`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`CSV import failed for ${dataSourceId}: ${errorMessage}`);

      await this.dataSourceRepo.update(dataSourceId, {
        status: DataSourceStatus.ERROR,
      });

      await this.syncJobRepo.update(syncJob.id, {
        status: SyncJobStatus.FAILED,
        completed_at: new Date(),
        error_message: errorMessage,
      });

      this.gateway.emitSyncError(orgId, {
        dataSourceId,
        error: errorMessage,
      });

      throw error;
    }
  }
}
