import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataSourceEntity, DataSourceType, DataSourceStatus } from './entities/data-source.entity';
import { SmartBillConnector } from './connectors/smartbill.connector';
import { WooCommerceConnector } from './connectors/woocommerce.connector';
import { CsvConnector, DetectedColumn } from './connectors/csv.connector';
import { encryptToString, decryptFromString } from '../../common/utils/encryption';
import { syncSmartbillQueue, syncWoocommerceQueue, syncCsvQueue } from '../sync/queues.config';
import { CreateDataSourceDto } from './dto/create-data-source.dto';
import { ClickHouseService } from '../clickhouse/clickhouse.service';

@Injectable()
export class DataSourcesService {
  private readonly logger = new Logger(DataSourcesService.name);

  constructor(
    @InjectRepository(DataSourceEntity)
    private readonly dataSourceRepo: Repository<DataSourceEntity>,
    private readonly clickhouse: ClickHouseService,
  ) {}

  async addDataSource(orgId: string, dto: CreateDataSourceDto): Promise<DataSourceEntity> {
    // Test connection before saving (skip for CSV and demo)
    if (dto.type !== DataSourceType.CSV) {
      const connectionOk = await this.testCredentials(dto.type, dto.credentials);
      if (!connectionOk) {
        throw new BadRequestException('Credentiale invalide. Nu am putut conecta.');
      }
    }

    // Encrypt credentials (if any)
    const credentialsEncrypted = dto.credentials
      ? encryptToString(JSON.stringify(dto.credentials))
      : null;

    const dataSource = this.dataSourceRepo.create({
      org_id: orgId,
      type: dto.type,
      name: dto.name,
      credentials_encrypted: credentialsEncrypted,
      config: dto.config || {},
      status: DataSourceStatus.ACTIVE,
    });

    const saved = await this.dataSourceRepo.save(dataSource);

    // Queue initial sync
    if (dto.type === DataSourceType.SMARTBILL) {
      await syncSmartbillQueue.add('sync', {
        dataSourceId: saved.id,
        orgId,
        jobType: 'initial',
      });
      this.logger.log(`Queued initial sync for SmartBill data source ${saved.id}`);
    } else if (dto.type === DataSourceType.WOOCOMMERCE) {
      await syncWoocommerceQueue.add('sync', {
        dataSourceId: saved.id,
        orgId,
        jobType: 'initial',
      });
      this.logger.log(`Queued initial sync for WooCommerce data source ${saved.id}`);
    }

    return saved;
  }

  async addCsvDataSource(
    orgId: string,
    name: string,
    fileBuffer: Buffer,
    fileName: string,
  ): Promise<DataSourceEntity> {
    const csvConnector = new CsvConnector();
    const isExcel = /\.xlsx?$/i.test(fileName);

    const parsed = isExcel
      ? csvConnector.parseExcel(fileBuffer)
      : csvConnector.parseCsv(fileBuffer.toString('utf-8'));

    if (parsed.totalRows === 0) {
      throw new BadRequestException('Fisierul nu contine date.');
    }

    const dataSource = this.dataSourceRepo.create({
      org_id: orgId,
      type: DataSourceType.CSV,
      name: name || fileName,
      credentials_encrypted: null,
      config: {
        fileName,
        detectedSchema: parsed.detectedSchema,
        totalRows: parsed.totalRows,
        headers: parsed.headers,
      },
      status: DataSourceStatus.ACTIVE,
    });

    const saved = await this.dataSourceRepo.save(dataSource);

    // Store parsed rows in memory for sync job via config
    // Queue CSV import
    await syncCsvQueue.add('sync', {
      dataSourceId: saved.id,
      orgId,
      jobType: 'initial',
      rows: parsed.rows,
      schema: parsed.detectedSchema,
    });

    this.logger.log(`Queued CSV import for data source ${saved.id} (${parsed.totalRows} rows)`);
    return saved;
  }

  async getPreview(
    orgId: string,
    id: string,
  ): Promise<{ rows: Record<string, string>[]; schema: DetectedColumn[] }> {
    const ds = await this.findOne(orgId, id);
    const schema = (ds.config as Record<string, unknown>)['detectedSchema'] as DetectedColumn[];

    // Fetch first 20 rows from csv_data table
    const rows = await this.clickhouse.query<{ row_data: string }>(
      `SELECT row_data FROM csv_data WHERE org_id = {orgId:String} AND data_source_id = {dsId:String} ORDER BY row_number LIMIT 20`,
      { orgId, dsId: id },
    );

    const parsedRows = rows.map((r) => JSON.parse(r.row_data));
    return { rows: parsedRows, schema: schema || [] };
  }

  async updateSchema(orgId: string, id: string, schema: DetectedColumn[]): Promise<void> {
    const ds = await this.findOne(orgId, id);
    const config = ds.config as Record<string, unknown>;
    config['detectedSchema'] = schema;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.dataSourceRepo.update(id, { config: config as any });
    this.logger.log(`Updated schema for data source ${id}`);
  }

  async findAll(orgId: string): Promise<DataSourceEntity[]> {
    return this.dataSourceRepo.find({
      where: { org_id: orgId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(orgId: string, id: string): Promise<DataSourceEntity> {
    const ds = await this.dataSourceRepo.findOne({
      where: { id, org_id: orgId },
    });
    if (!ds) {
      throw new NotFoundException('Data source not found');
    }
    return ds;
  }

  async testConnection(orgId: string, id: string): Promise<boolean> {
    const ds = await this.findOne(orgId, id);
    if (!ds.credentials_encrypted) {
      throw new BadRequestException('No credentials stored');
    }

    const credentials = JSON.parse(decryptFromString(ds.credentials_encrypted));
    return this.testCredentials(ds.type, credentials);
  }

  async triggerSync(orgId: string, id: string): Promise<void> {
    const ds = await this.findOne(orgId, id);

    if (ds.status === DataSourceStatus.SYNCING) {
      throw new BadRequestException('Sync is already in progress');
    }

    await this.dataSourceRepo.update(id, { status: DataSourceStatus.SYNCING });

    if (ds.type === DataSourceType.SMARTBILL) {
      const jobType = ds.last_sync_at ? 'incremental' : 'initial';
      await syncSmartbillQueue.add('sync', {
        dataSourceId: id,
        orgId,
        jobType,
      });
    } else if (ds.type === DataSourceType.WOOCOMMERCE) {
      const jobType = ds.last_sync_at ? 'incremental' : 'initial';
      await syncWoocommerceQueue.add('sync', {
        dataSourceId: id,
        orgId,
        jobType,
      });
    }

    this.logger.log(`Triggered sync for data source ${id}`);
  }

  async getColumns(orgId: string, id: string): Promise<{ name: string; type: string }[]> {
    const ds = await this.findOne(orgId, id);

    // For CSV sources, get columns from stored config schema
    const config = ds.config as Record<string, unknown>;
    const detectedSchema = config['detectedSchema'] as { name: string; type: string }[] | undefined;
    if (detectedSchema) {
      return detectedSchema.map((col) => ({ name: col.name, type: col.type }));
    }

    // For other sources, try to get from ClickHouse table
    const tableMap: Record<string, string> = {
      smartbill: 'smartbill_invoices',
      woocommerce: 'woocommerce_orders',
      csv: 'csv_data',
    };
    const tableName = tableMap[ds.type] || 'csv_data';

    try {
      const columns = await this.clickhouse.query<{ name: string; type: string }>(
        `SELECT name, type FROM system.columns WHERE database = currentDatabase() AND table = {table:String}`,
        { table: tableName },
      );
      return columns.filter((c) => !['org_id', 'data_source_id'].includes(c.name));
    } catch {
      return [];
    }
  }

  getDecryptedCredentials(ds: DataSourceEntity): Record<string, string> {
    if (!ds.credentials_encrypted) {
      throw new BadRequestException('No credentials stored');
    }
    return JSON.parse(decryptFromString(ds.credentials_encrypted));
  }

  private async testCredentials(
    type: DataSourceType,
    credentials: Record<string, string>,
  ): Promise<boolean> {
    if (type === DataSourceType.SMARTBILL) {
      const connector = new SmartBillConnector({
        email: credentials['email'] || '',
        token: credentials['token'] || '',
      });
      return connector.testConnection();
    }

    if (type === DataSourceType.WOOCOMMERCE) {
      const connector = new WooCommerceConnector({
        storeUrl: credentials['storeUrl'] || '',
        consumerKey: credentials['consumerKey'] || '',
        consumerSecret: credentials['consumerSecret'] || '',
      });
      return connector.testConnection();
    }

    return false;
  }
}
