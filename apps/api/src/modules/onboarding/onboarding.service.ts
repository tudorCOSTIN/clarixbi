/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import {
  DataSource,
  DataSourceType,
  DataSourceStatus,
} from '../data-sources/entities/data-source.entity';
import { SyncJob, SyncJobStatus } from '../sync/entities/sync-job.entity';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { DataSourcesService } from '../data-sources/data-sources.service';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const smartbillDemo: any = require('../../seeds/demo/smartbill-demo.json');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const woocommerceDemo: any = require('../../seeds/demo/woocommerce-demo.json');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const csvDemo: any = require('../../seeds/demo/csv-demo.json');

const DEMO_RATE_LIMIT = new Map<string, number[]>();
const MAX_DEMO_CALLS_PER_HOUR = 3;

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    @InjectRepository(DataSource)
    private readonly dataSourceRepo: Repository<DataSource>,
    @InjectRepository(SyncJob)
    private readonly syncJobRepo: Repository<SyncJob>,
    private readonly clickhouse: ClickHouseService,
    private readonly gateway: NotificationsGateway,
    private readonly dataSourcesService: DataSourcesService,
  ) {}

  async getStatus(orgId: string): Promise<{
    step: string;
    hasDataSource: boolean;
    hasSyncedData: boolean;
  }> {
    const dataSources = await this.dataSourceRepo.find({
      where: { org_id: orgId },
    });

    const hasDataSource = dataSources.length > 0;
    const hasSyncedData = dataSources.some(
      (ds) => ds.status === DataSourceStatus.ACTIVE && ds.total_rows > 0,
    );

    let step = 'select-source';
    if (hasDataSource && hasSyncedData) {
      step = 'complete';
    } else if (hasDataSource) {
      step = 'syncing';
    }

    return { step, hasDataSource, hasSyncedData };
  }

  async selectSource(orgId: string, sourceType: string): Promise<void> {
    this.logger.log(`Org ${orgId} selected source type: ${sourceType}`);
  }

  async testAndConnect(
    orgId: string,
    sourceType: string,
    credentials: Record<string, string>,
  ): Promise<{ dataSourceId: string }> {
    const ds = await this.dataSourcesService.addDataSource(orgId, {
      type: sourceType as DataSourceType,
      name: this.getSourceName(sourceType),
      credentials,
    });

    return { dataSourceId: ds.id };
  }

  async getSyncStatus(orgId: string): Promise<{
    syncing: boolean;
    progress: number;
    totalRows: number;
    error?: string;
  }> {
    const latestSync = await this.syncJobRepo.findOne({
      where: { org_id: orgId },
      order: { created_at: 'DESC' },
    });

    if (!latestSync) {
      return { syncing: false, progress: 0, totalRows: 0 };
    }

    return {
      syncing: latestSync.status === SyncJobStatus.RUNNING,
      progress: latestSync.status === SyncJobStatus.COMPLETED ? 100 : 50,
      totalRows: latestSync.rows_imported,
      error:
        latestSync.status === SyncJobStatus.FAILED
          ? latestSync.error_message || undefined
          : undefined,
    };
  }

  async completeOnboarding(orgId: string): Promise<void> {
    this.logger.log(`Onboarding completed for org ${orgId}`);
  }

  async loadDemoData(
    orgId: string,
    dataset?: string,
  ): Promise<{ totalRows: number; datasets: string[] }> {
    // Rate limit check
    this.checkDemoRateLimit(orgId);

    const loadedDatasets: string[] = [];
    let totalRows = 0;

    // Create demo data source
    const demoDs = this.dataSourceRepo.create({
      org_id: orgId,
      type: DataSourceType.CSV,
      name: 'Date Demo',
      credentials_encrypted: null,
      config: { isDemo: true, dataset: dataset || 'all' },
      status: DataSourceStatus.SYNCING,
    });
    const savedDs = await this.dataSourceRepo.save(demoDs);

    this.gateway.emitSyncProgress(orgId, {
      dataSourceId: savedDs.id,
      progress: 0,
      rowsImported: 0,
    });

    try {
      if (!dataset || dataset === 'all' || dataset === 'smartbill') {
        const rows = await this.loadSmartBillDemo(orgId, savedDs.id);
        totalRows += rows;
        loadedDatasets.push('smartbill');

        this.gateway.emitSyncProgress(orgId, {
          dataSourceId: savedDs.id,
          progress: 33,
          rowsImported: totalRows,
        });
      }

      if (!dataset || dataset === 'all' || dataset === 'woocommerce') {
        const rows = await this.loadWooCommerceDemo(orgId, savedDs.id);
        totalRows += rows;
        loadedDatasets.push('woocommerce');

        this.gateway.emitSyncProgress(orgId, {
          dataSourceId: savedDs.id,
          progress: 66,
          rowsImported: totalRows,
        });
      }

      if (!dataset || dataset === 'all' || dataset === 'csv') {
        const rows = await this.loadCsvDemo(orgId, savedDs.id);
        totalRows += rows;
        loadedDatasets.push('csv');
      }

      // Update data source
      await this.dataSourceRepo.update(savedDs.id, {
        status: DataSourceStatus.ACTIVE,
        last_sync_at: new Date(),
        total_rows: totalRows,
      });

      this.gateway.emitSyncProgress(orgId, {
        dataSourceId: savedDs.id,
        progress: 100,
        rowsImported: totalRows,
      });

      this.gateway.emitSyncComplete(orgId, {
        dataSourceId: savedDs.id,
        totalRows,
      });

      this.logger.log(
        `Demo data loaded for org ${orgId}: ${totalRows} rows (${loadedDatasets.join(', ')})`,
      );
    } catch (error) {
      await this.dataSourceRepo.update(savedDs.id, {
        status: DataSourceStatus.ERROR,
      });

      this.gateway.emitSyncError(orgId, {
        dataSourceId: savedDs.id,
        error: error instanceof Error ? error.message : 'Failed to load demo data',
      });

      throw error;
    }

    return { totalRows, datasets: loadedDatasets };
  }

  private async loadSmartBillDemo(orgId: string, dataSourceId: string): Promise<number> {
    const data = smartbillDemo as any;
    let rows = 0;

    // Insert invoices
    if (data.invoices?.length) {
      const invoiceRows = data.invoices.map((inv: any) => ({
        ...inv,
        id: uuid(),
        org_id: orgId,
        data_source_id: dataSourceId,
        imported_at: new Date().toISOString().replace('T', ' ').split('.')[0],
      }));
      await this.batchInsert('invoices', invoiceRows);
      rows += invoiceRows.length;
    }

    // Insert customers
    if (data.customers?.length) {
      const customerRows = data.customers.map((c: any) => ({
        ...c,
        id: uuid(),
        org_id: orgId,
        data_source_id: dataSourceId,
        imported_at: new Date().toISOString().replace('T', ' ').split('.')[0],
      }));
      await this.batchInsert('customers', customerRows);
      rows += customerRows.length;
    }

    // Insert payments
    if (data.payments?.length) {
      const paymentRows = data.payments.map((p: any) => ({
        ...p,
        id: uuid(),
        org_id: orgId,
        data_source_id: dataSourceId,
        imported_at: new Date().toISOString().replace('T', ' ').split('.')[0],
      }));
      await this.batchInsert('payments', paymentRows);
      rows += paymentRows.length;
    }

    return rows;
  }

  private async loadWooCommerceDemo(orgId: string, dataSourceId: string): Promise<number> {
    const data = woocommerceDemo as any;
    let rows = 0;

    if (data.orders?.length) {
      const orderRows = data.orders.map((o: any) => ({
        ...o,
        id: uuid(),
        org_id: orgId,
        data_source_id: dataSourceId,
        imported_at: new Date().toISOString().replace('T', ' ').split('.')[0],
      }));
      await this.batchInsert('orders', orderRows);
      rows += orderRows.length;
    }

    if (data.order_items?.length) {
      const itemRows = data.order_items.map((i: any) => ({
        ...i,
        id: uuid(),
        org_id: orgId,
        imported_at: new Date().toISOString().replace('T', ' ').split('.')[0],
      }));
      await this.batchInsert('order_items', itemRows);
      rows += itemRows.length;
    }

    if (data.products?.length) {
      const productRows = data.products.map((p: any) => ({
        ...p,
        id: uuid(),
        org_id: orgId,
        data_source_id: dataSourceId,
        imported_at: new Date().toISOString().replace('T', ' ').split('.')[0],
      }));
      await this.batchInsert('products', productRows);
      rows += productRows.length;
    }

    if (data.customers?.length) {
      const customerRows = data.customers.map((c: any) => ({
        ...c,
        id: uuid(),
        org_id: orgId,
        data_source_id: dataSourceId,
        imported_at: new Date().toISOString().replace('T', ' ').split('.')[0],
      }));
      await this.batchInsert('customers', customerRows);
      rows += customerRows.length;
    }

    return rows;
  }

  private async loadCsvDemo(orgId: string, dataSourceId: string): Promise<number> {
    const data = csvDemo as any;

    if (!data.rows?.length) return 0;

    const csvRows = data.rows.map((row: any, index: number) => ({
      id: uuid(),
      org_id: orgId,
      data_source_id: dataSourceId,
      row_data: JSON.stringify(row),
      row_number: index + 1,
      imported_at: new Date().toISOString().replace('T', ' ').split('.')[0],
    }));

    await this.batchInsert('csv_data', csvRows);
    return csvRows.length;
  }

  private async batchInsert(table: string, rows: Record<string, unknown>[]): Promise<void> {
    const BATCH_SIZE = 1000;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await this.clickhouse.insert(table, batch);
    }
  }

  private checkDemoRateLimit(orgId: string): void {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const calls = DEMO_RATE_LIMIT.get(orgId) || [];

    // Remove calls older than 1 hour
    const recent = calls.filter((t) => now - t < oneHour);

    if (recent.length >= MAX_DEMO_CALLS_PER_HOUR) {
      throw new BadRequestException(
        'Ai depasit limita de incarcari demo. Incearca din nou intr-o ora.',
      );
    }

    recent.push(now);
    DEMO_RATE_LIMIT.set(orgId, recent);
  }

  private getSourceName(type: string): string {
    const names: Record<string, string> = {
      smartbill: 'SmartBill',
      woocommerce: 'WooCommerce',
      csv: 'CSV Import',
    };
    return names[type] || type;
  }
}
