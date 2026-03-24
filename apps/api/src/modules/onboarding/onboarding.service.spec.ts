process.env['REDIS_URL'] = 'redis://localhost:6379';

jest.mock('../../seeds/demo/smartbill-demo.json', () => ({
  invoices: [{ number: 'INV-001', total: 100 }],
  customers: [{ name: 'Test Customer' }],
  payments: [{ amount: 100 }],
}));
jest.mock('../../seeds/demo/woocommerce-demo.json', () => ({
  orders: [{ number: 'ORD-001', total: 50 }],
  order_items: [{ product: 'Test' }],
  products: [{ name: 'Product 1' }],
  customers: [{ name: 'Customer 1' }],
}));
jest.mock('../../seeds/demo/csv-demo.json', () => ({
  rows: [{ col1: 'val1' }, { col2: 'val2' }],
}));
jest.mock('uuid', () => ({ v4: jest.fn().mockReturnValue('mock-uuid') }));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { DataSource, DataSourceStatus } from '../data-sources/entities/data-source.entity';
import { SyncJob, SyncJobStatus } from '../sync/entities/sync-job.entity';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { DataSourcesService } from '../data-sources/data-sources.service';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let dataSourceRepo: { [k: string]: jest.Mock } & {
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    find: jest.Mock;
  };
  let syncJobRepo: { [k: string]: jest.Mock } & { findOne: jest.Mock };
  let mockClickhouse: { query: jest.Mock; insert: jest.Mock };
  let mockGateway: Record<string, jest.Mock>;
  let mockDataSourcesService: { [k: string]: jest.Mock } & {
    addDataSource: jest.Mock;
  };

  const orgId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    dataSourceRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as typeof dataSourceRepo;

    syncJobRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as typeof syncJobRepo;

    mockClickhouse = {
      query: jest.fn(),
      insert: jest.fn().mockResolvedValue(undefined),
    };

    mockGateway = {
      emitSyncProgress: jest.fn(),
      emitSyncComplete: jest.fn(),
      emitSyncError: jest.fn(),
    };

    mockDataSourcesService = {
      addDataSource: jest.fn(),
    } as typeof mockDataSourcesService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: getRepositoryToken(DataSource), useValue: dataSourceRepo },
        { provide: getRepositoryToken(SyncJob), useValue: syncJobRepo },
        { provide: ClickHouseService, useValue: mockClickhouse },
        { provide: NotificationsGateway, useValue: mockGateway },
        { provide: DataSourcesService, useValue: mockDataSourcesService },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);

    jest.clearAllMocks();
  });

  describe('getStatus', () => {
    it('should return step=select-source when no data sources exist', async () => {
      dataSourceRepo.find.mockResolvedValue([]);

      const result = await service.getStatus(orgId);

      expect(result).toEqual({
        step: 'select-source',
        hasDataSource: false,
        hasSyncedData: false,
      });
    });

    it('should return step=syncing when data source exists but not synced', async () => {
      dataSourceRepo.find.mockResolvedValue([
        { id: 'ds-1', status: DataSourceStatus.SYNCING, total_rows: 0 },
      ]);

      const result = await service.getStatus(orgId);

      expect(result).toEqual({
        step: 'syncing',
        hasDataSource: true,
        hasSyncedData: false,
      });
    });

    it('should return step=complete when active data source with rows exists', async () => {
      dataSourceRepo.find.mockResolvedValue([
        { id: 'ds-1', status: DataSourceStatus.ACTIVE, total_rows: 500 },
      ]);

      const result = await service.getStatus(orgId);

      expect(result).toEqual({
        step: 'complete',
        hasDataSource: true,
        hasSyncedData: true,
      });
    });
  });

  describe('selectSource', () => {
    it('should log and return without error', async () => {
      await expect(service.selectSource(orgId, 'smartbill')).resolves.toBeUndefined();
    });
  });

  describe('testAndConnect', () => {
    it('should call dataSourcesService.addDataSource and return dataSourceId', async () => {
      const mockDs = { id: 'ds-new' };
      mockDataSourcesService.addDataSource.mockResolvedValue(mockDs);

      const result = await service.testAndConnect(orgId, 'smartbill', { apiKey: 'abc' });

      expect(mockDataSourcesService.addDataSource).toHaveBeenCalledWith(orgId, {
        type: 'smartbill',
        name: 'SmartBill',
        credentials: { apiKey: 'abc' },
      });
      expect(result).toEqual({ dataSourceId: 'ds-new' });
    });
  });

  describe('getSyncStatus', () => {
    it('should return defaults when no sync job exists', async () => {
      syncJobRepo.findOne.mockResolvedValue(null);

      const result = await service.getSyncStatus(orgId);

      expect(result).toEqual({ syncing: false, progress: 0, totalRows: 0 });
    });

    it('should return syncing=true for running job', async () => {
      syncJobRepo.findOne.mockResolvedValue({
        status: SyncJobStatus.RUNNING,
        rows_imported: 250,
      });

      const result = await service.getSyncStatus(orgId);

      expect(result.syncing).toBe(true);
      expect(result.progress).toBe(50);
      expect(result.totalRows).toBe(250);
    });

    it('should return progress=100 for completed job', async () => {
      syncJobRepo.findOne.mockResolvedValue({
        status: SyncJobStatus.COMPLETED,
        rows_imported: 1000,
      });

      const result = await service.getSyncStatus(orgId);

      expect(result.syncing).toBe(false);
      expect(result.progress).toBe(100);
      expect(result.totalRows).toBe(1000);
      expect(result.error).toBeUndefined();
    });

    it('should return error for failed job', async () => {
      syncJobRepo.findOne.mockResolvedValue({
        status: SyncJobStatus.FAILED,
        rows_imported: 0,
        error_message: 'Connection timeout',
      });

      const result = await service.getSyncStatus(orgId);

      expect(result.syncing).toBe(false);
      expect(result.error).toBe('Connection timeout');
    });
  });

  describe('completeOnboarding', () => {
    it('should log and return without error', async () => {
      await expect(service.completeOnboarding(orgId)).resolves.toBeUndefined();
    });
  });

  describe('loadDemoData', () => {
    it('should create data source, load demo data, and emit events', async () => {
      const savedDs = { id: 'demo-ds-1' };
      dataSourceRepo.create.mockReturnValue({ org_id: orgId });
      dataSourceRepo.save.mockResolvedValue(savedDs);
      dataSourceRepo.update.mockResolvedValue(undefined);

      const result = await service.loadDemoData(orgId);

      expect(dataSourceRepo.create).toHaveBeenCalled();
      expect(dataSourceRepo.save).toHaveBeenCalled();
      expect(mockClickhouse.insert).toHaveBeenCalled();
      expect(mockGateway.emitSyncProgress).toHaveBeenCalled();
      expect(mockGateway.emitSyncComplete).toHaveBeenCalledWith(orgId, {
        dataSourceId: 'demo-ds-1',
        totalRows: expect.any(Number),
      });
      expect(dataSourceRepo.update).toHaveBeenCalledWith('demo-ds-1', {
        status: DataSourceStatus.ACTIVE,
        last_sync_at: expect.any(Date),
        total_rows: expect.any(Number),
      });
      expect(result.totalRows).toBeGreaterThan(0);
      expect(result.datasets).toEqual(expect.arrayContaining(['smartbill', 'woocommerce', 'csv']));
    });

    it('should throw BadRequestException when rate limit exceeded', async () => {
      const rateLimitOrgId = '99999999-9999-9999-9999-999999999999';
      const savedDs = { id: 'demo-ds-rl' };
      dataSourceRepo.create.mockReturnValue({ org_id: rateLimitOrgId });
      dataSourceRepo.save.mockResolvedValue(savedDs);
      dataSourceRepo.update.mockResolvedValue(undefined);

      // Exhaust the rate limit (3 calls per hour)
      await service.loadDemoData(rateLimitOrgId);
      await service.loadDemoData(rateLimitOrgId);
      await service.loadDemoData(rateLimitOrgId);

      await expect(service.loadDemoData(rateLimitOrgId)).rejects.toThrow(BadRequestException);
    });
  });
});
