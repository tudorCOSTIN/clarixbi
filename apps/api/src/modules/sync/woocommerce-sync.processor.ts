import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Worker, Job } from 'bullmq';
import { v4 as uuid } from 'uuid';
import { DataSourceEntity, DataSourceStatus } from '../data-sources/entities/data-source.entity';
import { SyncJob, SyncJobStatus, SyncJobType } from './entities/sync-job.entity';
import {
  WooCommerceConnector,
  WooCommerceOrder,
  WooCommerceProduct,
  WooCommerceCustomer,
} from '../data-sources/connectors/woocommerce.connector';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { decryptFromString } from '../../common/utils/encryption';
import { QUEUE_CONFIGS } from './queues.config';

interface WooCommerceSyncJobData {
  dataSourceId: string;
  orgId: string;
  jobType: 'initial' | 'incremental';
}

const BATCH_SIZE = 1000;

@Injectable()
export class WooCommerceSyncProcessor implements OnModuleInit {
  private readonly logger = new Logger(WooCommerceSyncProcessor.name);
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
    const redisUrl = process.env['REDIS_URL'] || 'redis://localhost:6379';
    const parsed = new URL(redisUrl);
    const connection = {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password || undefined,
      maxRetriesPerRequest: null,
    };

    const queueConfig = QUEUE_CONFIGS.find((q) => q.name === 'sync-woocommerce');

    this.worker = new Worker(
      'sync-woocommerce',
      async (job: Job<WooCommerceSyncJobData>) => this.process(job),
      {
        connection,
        concurrency: queueConfig?.concurrency ?? 5,
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log('WooCommerce sync worker started');
  }

  private async process(job: Job<WooCommerceSyncJobData>): Promise<void> {
    const { dataSourceId, orgId, jobType } = job.data;

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

    await this.dataSourceRepo.update(dataSourceId, { status: DataSourceStatus.SYNCING });

    try {
      const dataSource = await this.dataSourceRepo.findOneOrFail({
        where: { id: dataSourceId },
      });

      if (!dataSource.credentials_encrypted) {
        throw new Error('No credentials found');
      }

      const credentials = JSON.parse(decryptFromString(dataSource.credentials_encrypted));
      const connector = new WooCommerceConnector({
        storeUrl: credentials.storeUrl,
        consumerKey: credentials.consumerKey,
        consumerSecret: credentials.consumerSecret,
      });

      // Determine date range for incremental
      let after: string | undefined;
      if (jobType === 'incremental' && dataSource.last_sync_at) {
        after = dataSource.last_sync_at.toISOString();
      }

      let totalRows = 0;

      this.gateway.emitSyncProgress(orgId, {
        dataSourceId,
        progress: 0,
        rowsImported: 0,
      });

      // 1. Fetch and insert orders + order items (~50% of progress)
      this.logger.log(`Fetching WooCommerce orders${after ? ` after ${after}` : ''}`);
      const orders = await connector.fetchAllOrders(after);
      const orderRows = this.transformOrders(orders, orgId, dataSourceId);
      await this.batchInsert('orders', orderRows);
      totalRows += orderRows.length;

      // Insert order line items
      const orderItemRows = this.transformOrderItems(orders, orgId);
      await this.batchInsert('order_items', orderItemRows);
      totalRows += orderItemRows.length;

      this.gateway.emitSyncProgress(orgId, {
        dataSourceId,
        progress: 40,
        rowsImported: totalRows,
      });

      // 2. Fetch and insert products (~30% of progress)
      this.logger.log('Fetching WooCommerce products');
      const products = await connector.fetchAllProducts();

      // Calculate derived fields from orders
      const productSales = this.calculateProductSales(orders);
      const productRows = this.transformProducts(products, orgId, dataSourceId, productSales);
      await this.batchInsert('products', productRows);
      totalRows += productRows.length;

      this.gateway.emitSyncProgress(orgId, {
        dataSourceId,
        progress: 70,
        rowsImported: totalRows,
      });

      // 3. Fetch and insert customers (~20% of progress)
      this.logger.log('Fetching WooCommerce customers');
      const customers = await connector.fetchAllCustomers();
      const customerRows = this.transformCustomers(customers, orgId, dataSourceId);
      await this.batchInsert('customers', customerRows);
      totalRows += customerRows.length;

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

      this.logger.log(`WooCommerce sync completed for ${dataSourceId}: ${totalRows} rows`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`WooCommerce sync failed for ${dataSourceId}: ${errorMessage}`);

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

  private transformOrders(
    orders: WooCommerceOrder[],
    orgId: string,
    dataSourceId: string,
  ): Record<string, unknown>[] {
    return orders.map((o) => ({
      id: uuid(),
      org_id: orgId,
      data_source_id: dataSourceId,
      order_number: String(o.number || o.id),
      customer_id: String(o.customer_id || ''),
      customer_email: o.billing?.email || '',
      order_date: o.date_created ? o.date_created.split('T')[0] : '1970-01-01',
      status: o.status || '',
      total_amount: parseFloat(o.total) || 0,
      currency: o.currency || 'RON',
      discount: parseFloat(o.discount_total) || 0,
      shipping: parseFloat(o.shipping_total) || 0,
      tax: parseFloat(o.total_tax) || 0,
      payment_method: o.payment_method_title || o.payment_method || '',
      items_count: o.line_items?.length || 0,
      imported_at: new Date().toISOString().replace('T', ' ').split('.')[0],
    }));
  }

  private transformOrderItems(
    orders: WooCommerceOrder[],
    orgId: string,
  ): Record<string, unknown>[] {
    const rows: Record<string, unknown>[] = [];
    for (const order of orders) {
      for (const item of order.line_items || []) {
        rows.push({
          id: uuid(),
          org_id: orgId,
          order_id: String(order.id),
          product_id: String(item.product_id),
          product_name: item.name || '',
          quantity: item.quantity || 0,
          unit_price: item.price || 0,
          total_price: parseFloat(item.total) || 0,
          sku: item.sku || '',
          imported_at: new Date().toISOString().replace('T', ' ').split('.')[0],
        });
      }
    }
    return rows;
  }

  private calculateProductSales(
    orders: WooCommerceOrder[],
  ): Map<number, { totalSold: number; totalRevenue: number }> {
    const sales = new Map<number, { totalSold: number; totalRevenue: number }>();

    for (const order of orders) {
      if (order.status === 'cancelled' || order.status === 'refunded') continue;
      for (const item of order.line_items || []) {
        const existing = sales.get(item.product_id) || { totalSold: 0, totalRevenue: 0 };
        existing.totalSold += item.quantity || 0;
        existing.totalRevenue += parseFloat(item.total) || 0;
        sales.set(item.product_id, existing);
      }
    }

    return sales;
  }

  private transformProducts(
    products: WooCommerceProduct[],
    orgId: string,
    dataSourceId: string,
    productSales: Map<number, { totalSold: number; totalRevenue: number }>,
  ): Record<string, unknown>[] {
    return products.map((p) => {
      const sales = productSales.get(p.id) || { totalSold: p.total_sales || 0, totalRevenue: 0 };
      return {
        id: uuid(),
        org_id: orgId,
        data_source_id: dataSourceId,
        name: p.name || '',
        sku: p.sku || '',
        price: parseFloat(p.price) || 0,
        category: p.categories?.[0]?.name || '',
        stock_quantity: p.stock_quantity ?? 0,
        status: p.status || '',
        total_sold: sales.totalSold,
        total_revenue: sales.totalRevenue,
        imported_at: new Date().toISOString().replace('T', ' ').split('.')[0],
      };
    });
  }

  private transformCustomers(
    customers: WooCommerceCustomer[],
    orgId: string,
    dataSourceId: string,
  ): Record<string, unknown>[] {
    return customers.map((c) => ({
      id: uuid(),
      org_id: orgId,
      data_source_id: dataSourceId,
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
      email: c.email || '',
      phone: c.billing?.phone || '',
      company: c.billing?.company || '',
      tax_code: '',
      total_revenue: parseFloat(c.total_spent) || 0,
      invoice_count: c.orders_count || 0,
      first_invoice_date: c.date_created ? c.date_created.split('T')[0] : null,
      last_invoice_date: null,
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
