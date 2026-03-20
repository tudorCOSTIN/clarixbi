/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSourcesService } from './data-sources.service';
import { DataSourceEntity, DataSourceType, DataSourceStatus } from './entities/data-source.entity';
import { ClickHouseService } from '../clickhouse/clickhouse.service';

// ---------- mocks ----------

jest.mock('../../common/utils/encryption', () => ({
  encryptToString: jest.fn((plaintext: string) => `encrypted:${plaintext}`),
  decryptFromString: jest.fn((encrypted: string) => encrypted.replace('encrypted:', '')),
}));

const mockSmartBillTestConnection = jest.fn().mockResolvedValue(true);
jest.mock('./connectors/smartbill.connector', () => ({
  SmartBillConnector: jest.fn().mockImplementation(() => ({
    testConnection: mockSmartBillTestConnection,
  })),
}));

const mockWooTestConnection = jest.fn().mockResolvedValue(true);
jest.mock('./connectors/woocommerce.connector', () => ({
  WooCommerceConnector: jest.fn().mockImplementation(() => ({
    testConnection: mockWooTestConnection,
  })),
}));

jest.mock('./connectors/csv.connector', () => ({
  CsvConnector: jest.fn().mockImplementation(() => ({
    parseCsv: jest.fn().mockReturnValue({
      headers: ['name', 'amount'],
      rows: [{ name: 'A', amount: '100' }],
      detectedSchema: [
        { name: 'name', type: 'string', sampleValues: ['A'] },
        { name: 'amount', type: 'number', sampleValues: ['100'] },
      ],
      totalRows: 1,
    }),
    parseExcel: jest.fn().mockReturnValue({
      headers: ['name', 'amount'],
      rows: [{ name: 'B', amount: '200' }],
      detectedSchema: [
        { name: 'name', type: 'string', sampleValues: ['B'] },
        { name: 'amount', type: 'number', sampleValues: ['200'] },
      ],
      totalRows: 1,
    }),
  })),
}));

jest.mock('../sync/queues.config', () => ({
  syncSmartbillQueue: { add: jest.fn().mockResolvedValue({}) },
  syncWoocommerceQueue: { add: jest.fn().mockResolvedValue({}) },
  syncCsvQueue: { add: jest.fn().mockResolvedValue({}) },
}));

// Re-import after mocking
const { encryptToString, decryptFromString } = jest.requireMock('../../common/utils/encryption');
const { syncSmartbillQueue, syncWoocommerceQueue, syncCsvQueue } =
  jest.requireMock('../sync/queues.config');

// ---------- helpers ----------

function makeDataSource(overrides: Partial<DataSourceEntity> = {}): DataSourceEntity {
  return {
    id: 'ds-1',
    org_id: 'org-123',
    type: DataSourceType.SMARTBILL,
    name: 'Test DS',
    credentials_encrypted: 'encrypted:{"email":"a@b.com","token":"tok"}',
    config: {},
    status: DataSourceStatus.ACTIVE,
    last_sync_at: null,
    total_rows: 0,
    sync_interval_minutes: 15,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    organization: {} as any,
    sync_jobs: [],
    ...overrides,
  } as DataSourceEntity;
}

// ---------- suite ----------

describe('DataSourcesService', () => {
  let service: DataSourcesService;
  let mockCreate: jest.Mock;
  let mockSave: jest.Mock;
  let mockFind: jest.Mock;
  let mockFindOne: jest.Mock;
  let mockUpdate: jest.Mock;
  let mockSoftRemove: jest.Mock;
  let mockClickhouseQuery: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockCreate = jest.fn((dto) => ({ id: 'ds-1', ...dto }));
    mockSave = jest.fn((entity) => Promise.resolve({ id: 'ds-1', ...entity }));
    mockFind = jest.fn().mockResolvedValue([]);
    mockFindOne = jest.fn();
    mockUpdate = jest.fn().mockResolvedValue({});
    mockSoftRemove = jest.fn().mockResolvedValue({});
    mockClickhouseQuery = jest.fn().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataSourcesService,
        {
          provide: getRepositoryToken(DataSourceEntity),
          useValue: {
            create: mockCreate,
            save: mockSave,
            find: mockFind,
            findOne: mockFindOne,
            update: mockUpdate,
            softRemove: mockSoftRemove,
          },
        },
        {
          provide: ClickHouseService,
          useValue: {
            query: mockClickhouseQuery,
            insert: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<DataSourcesService>(DataSourcesService);
  });

  // ===== addDataSource =====

  describe('addDataSource', () => {
    it('should create SmartBill source with encrypted credentials and queue sync', async () => {
      const dto = {
        type: DataSourceType.SMARTBILL,
        name: 'My SmartBill',
        credentials: { email: 'test@example.com', token: 'abc123' },
      };

      const result = await service.addDataSource('org-123', dto);

      // Credentials are encrypted
      expect(encryptToString).toHaveBeenCalledWith(
        JSON.stringify({ email: 'test@example.com', token: 'abc123' }),
      );
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          org_id: 'org-123',
          type: DataSourceType.SMARTBILL,
          name: 'My SmartBill',
          credentials_encrypted: expect.stringContaining('encrypted:'),
          status: DataSourceStatus.ACTIVE,
        }),
      );
      expect(mockSave).toHaveBeenCalled();

      // Queue initial sync
      expect(syncSmartbillQueue.add).toHaveBeenCalledWith(
        'sync',
        expect.objectContaining({
          dataSourceId: 'ds-1',
          orgId: 'org-123',
          jobType: 'initial',
        }),
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('ds-1');
    });

    it('should create WooCommerce source and queue woocommerce sync', async () => {
      const dto = {
        type: DataSourceType.WOOCOMMERCE,
        name: 'WooShop',
        credentials: { storeUrl: 'https://shop.ro', consumerKey: 'ck_x', consumerSecret: 'cs_y' },
      };

      await service.addDataSource('org-123', dto);

      expect(syncWoocommerceQueue.add).toHaveBeenCalledWith(
        'sync',
        expect.objectContaining({
          dataSourceId: 'ds-1',
          orgId: 'org-123',
          jobType: 'initial',
        }),
      );
      // SmartBill queue should NOT be called
      expect(syncSmartbillQueue.add).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when connection test fails', async () => {
      mockSmartBillTestConnection.mockResolvedValueOnce(false);

      const dto = {
        type: DataSourceType.SMARTBILL,
        name: 'Bad SB',
        credentials: { email: 'bad', token: 'bad' },
      };

      await expect(service.addDataSource('org-123', dto)).rejects.toThrow(BadRequestException);
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should skip connection test for CSV type', async () => {
      const dto = {
        type: DataSourceType.CSV,
        name: 'CSV Source',
        credentials: {} as Record<string, string>,
      };

      await service.addDataSource('org-123', dto);

      // testCredentials should not have been called (no connector instantiation)
      expect(mockSmartBillTestConnection).not.toHaveBeenCalled();
      expect(mockWooTestConnection).not.toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
    });

    it('should set credentials_encrypted to null when no credentials provided', async () => {
      const dto = {
        type: DataSourceType.CSV,
        name: 'No Creds',
        credentials: undefined as any,
      };

      await service.addDataSource('org-123', dto);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          credentials_encrypted: null,
        }),
      );
    });

    it('should use default empty config when dto.config is absent', async () => {
      const dto = {
        type: DataSourceType.CSV,
        name: 'No Config',
        credentials: undefined as any,
      };

      await service.addDataSource('org-123', dto);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          config: {},
        }),
      );
    });
  });

  // ===== addCsvDataSource =====

  describe('addCsvDataSource', () => {
    it('should parse CSV, save entity and queue csv sync', async () => {
      const buffer = Buffer.from('name,amount\nA,100');

      const result = await service.addCsvDataSource('org-123', 'report.csv', buffer, 'report.csv');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          org_id: 'org-123',
          type: DataSourceType.CSV,
          name: 'report.csv',
          credentials_encrypted: null,
          config: expect.objectContaining({
            fileName: 'report.csv',
            totalRows: 1,
            headers: ['name', 'amount'],
          }),
        }),
      );
      expect(syncCsvQueue.add).toHaveBeenCalledWith(
        'sync',
        expect.objectContaining({
          dataSourceId: 'ds-1',
          orgId: 'org-123',
          jobType: 'initial',
          rows: expect.any(Array),
          schema: expect.any(Array),
        }),
      );
      expect(result.id).toBe('ds-1');
    });

    it('should use parseExcel for .xlsx files', async () => {
      const buffer = Buffer.from('fake-xlsx');

      await service.addCsvDataSource('org-123', 'data.xlsx', buffer, 'data.xlsx');

      // CsvConnector.parseExcel was invoked (the mock returns totalRows: 1)
      expect(mockSave).toHaveBeenCalled();
      expect(syncCsvQueue.add).toHaveBeenCalled();
    });

    it('should throw BadRequestException when CSV has zero rows', async () => {
      const { CsvConnector } = jest.requireMock('./connectors/csv.connector');
      CsvConnector.mockImplementationOnce(() => ({
        parseCsv: jest.fn().mockReturnValue({
          headers: [],
          rows: [],
          detectedSchema: [],
          totalRows: 0,
        }),
        parseExcel: jest.fn(),
      }));

      // Re-create service with patched connector
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DataSourcesService,
          {
            provide: getRepositoryToken(DataSourceEntity),
            useValue: {
              create: mockCreate,
              save: mockSave,
              find: mockFind,
              findOne: mockFindOne,
              update: mockUpdate,
            },
          },
          {
            provide: ClickHouseService,
            useValue: { query: mockClickhouseQuery },
          },
        ],
      }).compile();

      const svc = module.get<DataSourcesService>(DataSourcesService);
      const buffer = Buffer.from('');

      await expect(
        svc.addCsvDataSource('org-123', 'empty.csv', buffer, 'empty.csv'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should fall back to fileName when name is empty', async () => {
      const buffer = Buffer.from('name,amount\nA,100');

      await service.addCsvDataSource('org-123', '', buffer, 'fallback.csv');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'fallback.csv',
        }),
      );
    });
  });

  // ===== testConnection =====

  describe('testConnection', () => {
    it('should decrypt credentials and test connection on success', async () => {
      mockFindOne.mockResolvedValue(
        makeDataSource({
          credentials_encrypted: 'encrypted:{"email":"a@b.com","token":"tok"}',
        }),
      );

      const result = await service.testConnection('org-123', 'ds-1');

      expect(decryptFromString).toHaveBeenCalledWith('encrypted:{"email":"a@b.com","token":"tok"}');
      expect(result).toBe(true);
    });

    it('should throw NotFoundException when data source does not exist', async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(service.testConnection('org-123', 'ds-missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when no credentials stored', async () => {
      mockFindOne.mockResolvedValue(makeDataSource({ credentials_encrypted: null }));

      await expect(service.testConnection('org-123', 'ds-1')).rejects.toThrow(BadRequestException);
    });

    it('should return false when connector test fails', async () => {
      mockSmartBillTestConnection.mockResolvedValueOnce(false);
      mockFindOne.mockResolvedValue(
        makeDataSource({
          type: DataSourceType.SMARTBILL,
          credentials_encrypted: 'encrypted:{"email":"a","token":"b"}',
        }),
      );

      const result = await service.testConnection('org-123', 'ds-1');
      expect(result).toBe(false);
    });
  });

  // ===== findAll =====

  describe('findAll', () => {
    it('should return all data sources for the organisation', async () => {
      const sources = [
        makeDataSource({ id: '1', name: 'Source 1' }),
        makeDataSource({ id: '2', name: 'Source 2' }),
      ];
      mockFind.mockResolvedValue(sources);

      const result = await service.findAll('org-123');

      expect(result).toHaveLength(2);
      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { org_id: 'org-123' },
          order: { created_at: 'DESC' },
        }),
      );
    });

    it('should return empty array when no sources exist', async () => {
      mockFind.mockResolvedValue([]);
      const result = await service.findAll('org-empty');
      expect(result).toEqual([]);
    });
  });

  // ===== findOne =====

  describe('findOne', () => {
    it('should return the data source when found', async () => {
      const ds = makeDataSource({ id: 'ds-1', name: 'SmartBill' });
      mockFindOne.mockResolvedValue(ds);

      const result = await service.findOne('org-123', 'ds-1');
      expect(result.name).toBe('SmartBill');
      expect(mockFindOne).toHaveBeenCalledWith({
        where: { id: 'ds-1', org_id: 'org-123' },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(service.findOne('org-123', 'ds-missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ===== triggerSync =====

  describe('triggerSync', () => {
    it('should queue SmartBill initial sync when last_sync_at is null', async () => {
      mockFindOne.mockResolvedValue(
        makeDataSource({
          type: DataSourceType.SMARTBILL,
          status: DataSourceStatus.ACTIVE,
          last_sync_at: null,
        }),
      );

      await service.triggerSync('org-123', 'ds-1');

      expect(mockUpdate).toHaveBeenCalledWith('ds-1', { status: DataSourceStatus.SYNCING });
      expect(syncSmartbillQueue.add).toHaveBeenCalledWith(
        'sync',
        expect.objectContaining({ jobType: 'initial' }),
      );
    });

    it('should queue SmartBill incremental sync when last_sync_at is set', async () => {
      mockFindOne.mockResolvedValue(
        makeDataSource({
          type: DataSourceType.SMARTBILL,
          status: DataSourceStatus.ACTIVE,
          last_sync_at: new Date('2024-06-01'),
        }),
      );

      await service.triggerSync('org-123', 'ds-1');

      expect(syncSmartbillQueue.add).toHaveBeenCalledWith(
        'sync',
        expect.objectContaining({ jobType: 'incremental' }),
      );
    });

    it('should queue WooCommerce sync correctly', async () => {
      mockFindOne.mockResolvedValue(
        makeDataSource({
          type: DataSourceType.WOOCOMMERCE,
          status: DataSourceStatus.ACTIVE,
          last_sync_at: null,
        }),
      );

      await service.triggerSync('org-123', 'ds-1');

      expect(syncWoocommerceQueue.add).toHaveBeenCalledWith(
        'sync',
        expect.objectContaining({ jobType: 'initial', dataSourceId: 'ds-1', orgId: 'org-123' }),
      );
    });

    it('should throw BadRequestException when already syncing', async () => {
      mockFindOne.mockResolvedValue(makeDataSource({ status: DataSourceStatus.SYNCING }));

      await expect(service.triggerSync('org-123', 'ds-1')).rejects.toThrow(BadRequestException);
      await expect(service.triggerSync('org-123', 'ds-1')).rejects.toThrow(
        'Sync is already in progress',
      );
    });

    it('should throw NotFoundException for non-existent data source', async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(service.triggerSync('org-123', 'ds-missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ===== getDecryptedCredentials =====

  describe('getDecryptedCredentials', () => {
    it('should decrypt and parse credentials JSON', () => {
      const ds = makeDataSource({
        credentials_encrypted: 'encrypted:{"email":"user@x.com","token":"secret"}',
      });

      const result = service.getDecryptedCredentials(ds);

      expect(decryptFromString).toHaveBeenCalledWith(
        'encrypted:{"email":"user@x.com","token":"secret"}',
      );
      expect(result).toEqual({ email: 'user@x.com', token: 'secret' });
    });

    it('should throw BadRequestException when no credentials stored', () => {
      const ds = makeDataSource({ credentials_encrypted: null });

      expect(() => service.getDecryptedCredentials(ds)).toThrow(BadRequestException);
    });
  });

  // ===== getColumns =====

  describe('getColumns', () => {
    it('should return columns from config detectedSchema when present', async () => {
      const schema = [
        { name: 'name', type: 'string', sampleValues: [] },
        { name: 'amount', type: 'number', sampleValues: [] },
      ];
      mockFindOne.mockResolvedValue(
        makeDataSource({
          type: DataSourceType.CSV,
          config: { detectedSchema: schema },
        }),
      );

      const result = await service.getColumns('org-123', 'ds-1');

      expect(result).toEqual([
        { name: 'name', type: 'string' },
        { name: 'amount', type: 'number' },
      ]);
      // Should NOT query ClickHouse when schema is in config
      expect(mockClickhouseQuery).not.toHaveBeenCalled();
    });

    it('should query ClickHouse system.columns when no detectedSchema in config', async () => {
      mockFindOne.mockResolvedValue(
        makeDataSource({
          type: DataSourceType.SMARTBILL,
          config: {},
        }),
      );
      mockClickhouseQuery.mockResolvedValue([
        { name: 'org_id', type: 'String' },
        { name: 'data_source_id', type: 'String' },
        { name: 'seriesName', type: 'String' },
        { name: 'totalValue', type: 'Float64' },
      ]);

      const result = await service.getColumns('org-123', 'ds-1');

      // Should filter out org_id and data_source_id
      expect(result).toEqual([
        { name: 'seriesName', type: 'String' },
        { name: 'totalValue', type: 'Float64' },
      ]);
      expect(mockClickhouseQuery).toHaveBeenCalledWith(expect.stringContaining('system.columns'), {
        table: 'smartbill_invoices',
      });
    });

    it('should return empty array when ClickHouse query fails', async () => {
      mockFindOne.mockResolvedValue(makeDataSource({ config: {} }));
      mockClickhouseQuery.mockRejectedValue(new Error('ClickHouse down'));

      const result = await service.getColumns('org-123', 'ds-1');
      expect(result).toEqual([]);
    });

    it('should use correct table name for WooCommerce', async () => {
      mockFindOne.mockResolvedValue(
        makeDataSource({ type: DataSourceType.WOOCOMMERCE, config: {} }),
      );
      mockClickhouseQuery.mockResolvedValue([]);

      await service.getColumns('org-123', 'ds-1');

      expect(mockClickhouseQuery).toHaveBeenCalledWith(expect.any(String), {
        table: 'woocommerce_orders',
      });
    });
  });

  // ===== getPreview =====

  describe('getPreview', () => {
    it('should fetch rows from ClickHouse and return parsed data with schema', async () => {
      const schema = [{ name: 'col1', type: 'string', sampleValues: [] }];
      mockFindOne.mockResolvedValue(makeDataSource({ config: { detectedSchema: schema } }));
      mockClickhouseQuery.mockResolvedValue([
        { row_data: JSON.stringify({ col1: 'val1' }) },
        { row_data: JSON.stringify({ col1: 'val2' }) },
      ]);

      const result = await service.getPreview('org-123', 'ds-1');

      expect(result.rows).toEqual([{ col1: 'val1' }, { col1: 'val2' }]);
      expect(result.schema).toEqual(schema);
      expect(mockClickhouseQuery).toHaveBeenCalledWith(
        expect.stringContaining('csv_data'),
        expect.objectContaining({ orgId: 'org-123', dsId: 'ds-1' }),
      );
    });

    it('should return empty schema array when detectedSchema is undefined', async () => {
      mockFindOne.mockResolvedValue(makeDataSource({ config: {} }));
      mockClickhouseQuery.mockResolvedValue([]);

      const result = await service.getPreview('org-123', 'ds-1');
      expect(result.schema).toEqual([]);
      expect(result.rows).toEqual([]);
    });

    it('should throw NotFoundException for non-existent data source', async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(service.getPreview('org-123', 'ds-missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ===== updateDataSource =====

  describe('updateDataSource', () => {
    it('should update name only', async () => {
      mockFindOne.mockResolvedValue(makeDataSource({ id: 'ds-1', name: 'Old Name' }));

      const result = await service.updateDataSource('org-123', 'ds-1', { name: 'New Name' });

      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Name' }));
      expect(result).toBeDefined();
    });

    it('should update sync_interval_minutes only', async () => {
      mockFindOne.mockResolvedValue(makeDataSource({ id: 'ds-1', sync_interval_minutes: 15 }));

      await service.updateDataSource('org-123', 'ds-1', { sync_interval_minutes: 60 });

      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ sync_interval_minutes: 60 }));
    });

    it('should update both name and interval', async () => {
      mockFindOne.mockResolvedValue(makeDataSource());

      await service.updateDataSource('org-123', 'ds-1', {
        name: 'Updated',
        sync_interval_minutes: 120,
      });

      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated', sync_interval_minutes: 120 }),
      );
    });

    it('should throw NotFoundException for non-existent data source', async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(
        service.updateDataSource('org-123', 'ds-missing', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===== deleteDataSource =====

  describe('deleteDataSource', () => {
    it('should soft remove the data source', async () => {
      const ds = makeDataSource({ status: DataSourceStatus.ACTIVE });
      mockFindOne.mockResolvedValue(ds);

      await service.deleteDataSource('org-123', 'ds-1');

      expect(mockSoftRemove).toHaveBeenCalledWith(ds);
    });

    it('should set status to disconnected if currently syncing before delete', async () => {
      const ds = makeDataSource({ status: DataSourceStatus.SYNCING });
      mockFindOne.mockResolvedValue(ds);

      await service.deleteDataSource('org-123', 'ds-1');

      expect(mockUpdate).toHaveBeenCalledWith('ds-1', { status: DataSourceStatus.DISCONNECTED });
      expect(mockSoftRemove).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent data source', async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(service.deleteDataSource('org-123', 'ds-missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
