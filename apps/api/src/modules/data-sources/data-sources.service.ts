import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataSourceEntity, DataSourceType, DataSourceStatus } from './entities/data-source.entity';
import { SmartBillConnector } from './connectors/smartbill.connector';
import { encryptToString, decryptFromString } from '../../common/utils/encryption';
import { syncSmartbillQueue } from '../sync/queues.config';
import { CreateDataSourceDto } from './dto/create-data-source.dto';

@Injectable()
export class DataSourcesService {
  private readonly logger = new Logger(DataSourcesService.name);

  constructor(
    @InjectRepository(DataSourceEntity)
    private readonly dataSourceRepo: Repository<DataSourceEntity>,
  ) {}

  async addDataSource(orgId: string, dto: CreateDataSourceDto): Promise<DataSourceEntity> {
    // Test connection before saving
    const connectionOk = await this.testCredentials(dto.type, dto.credentials);
    if (!connectionOk) {
      throw new BadRequestException('Credentiale invalide. Nu am putut conecta la SmartBill.');
    }

    // Encrypt credentials
    const credentialsEncrypted = encryptToString(JSON.stringify(dto.credentials));

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
      this.logger.log(`Queued initial sync for data source ${saved.id}`);
    }

    return saved;
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
    }

    this.logger.log(`Triggered sync for data source ${id}`);
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
    return false;
  }
}
