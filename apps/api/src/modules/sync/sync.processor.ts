import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Worker, Job } from 'bullmq';
import { v4 as uuid } from 'uuid';
import { DataSourceEntity, DataSourceStatus } from '../data-sources/entities/data-source.entity';
import { SyncJob, SyncJobStatus, SyncJobType } from './entities/sync-job.entity';
import {
  SmartBillConnector,
  SmartBillInvoice,
  SmartBillClient,
  SmartBillPayment,
} from '../data-sources/connectors/smartbill.connector';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { decryptFromString } from '../../common/utils/encryption';
import { QUEUE_CONFIGS } from './queues.config';

interface SyncJobData {
  dataSourceId: string;
  orgId: string;
  jobType: 'initial' | 'incremental';
}

const BATCH_SIZE = 1000;

@Injectable()
export class SyncProcessor implements OnModuleInit {
  private readonly logger = new Logger(SyncProcessor.name);
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

    const queueConfig = QUEUE_CONFIGS.find((q) => q.name === 'sync-smartbill');

    this.worker = new Worker('sync-smartbill', async (job: Job<SyncJobData>) => this.process(job), {
      connection,
      concurrency: queueConfig?.concurrency ?? 5,
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log('SmartBill sync worker started');
  }

  private async process(job: Job<SyncJobData>): Promise<void> {
    const { dataSourceId, orgId, jobType } = job.data;

    // Create sync job record
    const syncJob = this.syncJobRepo.create({
      id: uuid(),
      data_source_id: dataSourceId,
      org_id: orgId,
      status: SyncJobStatus.RUNNING,
      job_type: jobType === 'initial' ? SyncJobType.INITIAL : SyncJobType.INCREMENTAL,
      started_at: new Date(),
      rows_imported: 0,
      rows_updated: 0,
      rows_failed: 0,
    });
    await this.syncJobRepo.save(syncJob);

    // Update data source status
    await this.dataSourceRepo.update(dataSourceId, { status: DataSourceStatus.SYNCING });

    try {
      const dataSource = await this.dataSourceRepo.findOneOrFail({
        where: { id: dataSourceId },
      });

      if (!dataSource.credentials_encrypted) {
        throw new Error('No credentials found');
      }

      const credentials = JSON.parse(decryptFromString(dataSource.credentials_encrypted));
      const connector = new SmartBillConnector({
        email: credentials.email,
        token: credentials.token,
      });

      // Determine date range
      const endDate = new Date().toISOString().split('T')[0]!;
      let startDate: string;
      if (jobType === 'incremental' && dataSource.last_sync_at) {
        startDate = dataSource.last_sync_at.toISOString().split('T')[0]!;
      } else {
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        startDate = twoYearsAgo.toISOString().split('T')[0]!;
      }

      const cif = credentials.cif || credentials.email;
      let totalRows = 0;

      // Emit initial progress
      this.gateway.emitSyncProgress(orgId, {
        dataSourceId,
        progress: 0,
        rowsImported: 0,
      });

      // 1. Fetch and insert invoices (~60% of progress)
      this.logger.log(`Fetching invoices from ${startDate} to ${endDate}`);
      const invoices = await connector.fetchInvoices({ cif, startDate, endDate });
      const invoiceRows = this.transformInvoices(invoices, orgId, dataSourceId);
      await this.batchInsert('invoices', invoiceRows);
      totalRows += invoiceRows.length;

      this.gateway.emitSyncProgress(orgId, {
        dataSourceId,
        progress: 40,
        rowsImported: totalRows,
      });

      // 2. Fetch and insert clients (~20% of progress)
      this.logger.log('Fetching clients');
      const clients = await connector.fetchClients({ cif });
      const clientRows = this.transformClients(clients, orgId, dataSourceId);
      await this.batchInsert('customers', clientRows);
      totalRows += clientRows.length;

      this.gateway.emitSyncProgress(orgId, {
        dataSourceId,
        progress: 70,
        rowsImported: totalRows,
      });

      // 3. Fetch and insert payments (~20% of progress)
      this.logger.log(`Fetching payments from ${startDate} to ${endDate}`);
      const payments = await connector.fetchPayments({ cif, startDate, endDate });
      const paymentRows = this.transformPayments(payments, orgId, dataSourceId);
      await this.batchInsert('payments', paymentRows);
      totalRows += paymentRows.length;

      this.gateway.emitSyncProgress(orgId, {
        dataSourceId,
        progress: 95,
        rowsImported: totalRows,
      });

      // Update data source
      await this.dataSourceRepo.update(dataSourceId, {
        status: DataSourceStatus.ACTIVE,
        last_sync_at: new Date(),
        total_rows: totalRows,
      });

      // Update sync job
      await this.syncJobRepo.update(syncJob.id, {
        status: SyncJobStatus.COMPLETED,
        completed_at: new Date(),
        rows_imported: totalRows,
      });

      this.gateway.emitSyncProgress(orgId, {
        dataSourceId,
        progress: 100,
        rowsImported: totalRows,
      });

      this.gateway.emitSyncComplete(orgId, {
        dataSourceId,
        totalRows,
      });

      this.logger.log(`Sync completed for ${dataSourceId}: ${totalRows} rows`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Sync failed for ${dataSourceId}: ${errorMessage}`);

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

  private transformInvoices(
    invoices: SmartBillInvoice[],
    orgId: string,
    dataSourceId: string,
  ): Record<string, unknown>[] {
    return invoices.map((inv) => ({
      id: uuid(),
      org_id: orgId,
      data_source_id: dataSourceId,
      invoice_number: `${inv.seriesName || ''}${inv.number || ''}`,
      customer_id: inv.clientCif || '',
      customer_name: inv.clientName || '',
      issue_date: inv.date || '1970-01-01',
      due_date: inv.dueDate || inv.date || '1970-01-01',
      total_amount: inv.totalValue || 0,
      currency: inv.currency || 'RON',
      status: inv.status || '',
      tax_amount: inv.totalVatValue || 0,
      tax_type: 'TVA',
      payment_date: null,
      imported_at: new Date().toISOString().replace('T', ' ').split('.')[0],
    }));
  }

  private transformClients(
    clients: SmartBillClient[],
    orgId: string,
    dataSourceId: string,
  ): Record<string, unknown>[] {
    return clients.map((c) => ({
      id: uuid(),
      org_id: orgId,
      data_source_id: dataSourceId,
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
      company: c.name || '',
      tax_code: c.cif || '',
      total_revenue: 0,
      invoice_count: 0,
      first_invoice_date: null,
      last_invoice_date: null,
      imported_at: new Date().toISOString().replace('T', ' ').split('.')[0],
    }));
  }

  private transformPayments(
    payments: SmartBillPayment[],
    orgId: string,
    dataSourceId: string,
  ): Record<string, unknown>[] {
    return payments.map((p) => ({
      id: uuid(),
      org_id: orgId,
      data_source_id: dataSourceId,
      invoice_id: '',
      amount: p.value || 0,
      currency: p.currency || 'RON',
      payment_date: p.date || '1970-01-01',
      payment_method: p.type || '',
      imported_at: new Date().toISOString().replace('T', ' ').split('.')[0],
    }));
  }

  private async batchInsert(table: string, rows: Record<string, unknown>[]): Promise<void> {
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await this.clickhouse.insert(table, batch);
    }
  }
}
