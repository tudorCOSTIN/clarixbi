import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSourcesService } from './data-sources.service';
import { DataSourceEntity, DataSourceType, DataSourceStatus } from './entities/data-source.entity';

// Mock encryption
jest.mock('../../common/utils/encryption', () => ({
  encryptToString: jest.fn((plaintext: string) => `encrypted:${plaintext}`),
  decryptFromString: jest.fn((encrypted: string) => encrypted.replace('encrypted:', '')),
}));

// Mock SmartBillConnector
jest.mock('./connectors/smartbill.connector', () => ({
  SmartBillConnector: jest.fn().mockImplementation(() => ({
    testConnection: jest.fn().mockResolvedValue(true),
  })),
}));

// Mock queue
jest.mock('../sync/queues.config', () => ({
  syncSmartbillQueue: {
    add: jest.fn().mockResolvedValue({}),
  },
}));

describe('DataSourcesService', () => {
  let service: DataSourcesService;
  let mockCreate: jest.Mock;
  let mockSave: jest.Mock;
  let mockFind: jest.Mock;
  let mockFindOne: jest.Mock;
  let mockUpdate: jest.Mock;

  beforeEach(async () => {
    mockCreate = jest.fn((dto) => ({ id: 'test-id', ...dto }));
    mockSave = jest.fn((entity) => Promise.resolve({ id: 'test-id', ...entity }));
    mockFind = jest.fn().mockResolvedValue([]);
    mockFindOne = jest.fn();
    mockUpdate = jest.fn().mockResolvedValue({});
    const mockRepo = {
      create: mockCreate,
      save: mockSave,
      find: mockFind,
      findOne: mockFindOne,
      update: mockUpdate,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataSourcesService,
        {
          provide: getRepositoryToken(DataSourceEntity),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<DataSourcesService>(DataSourcesService);
  });

  describe('addDataSource', () => {
    it('should create a data source with encrypted credentials', async () => {
      const dto = {
        type: DataSourceType.SMARTBILL,
        name: 'My SmartBill',
        credentials: { email: 'test@example.com', token: 'abc123' },
      };

      await service.addDataSource('org-123', dto);

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
    });

    it('should queue initial sync after creation', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { syncSmartbillQueue } = require('../sync/queues.config');

      const dto = {
        type: DataSourceType.SMARTBILL,
        name: 'SmartBill',
        credentials: { email: 'test@example.com', token: 'abc123' },
      };

      await service.addDataSource('org-123', dto);

      expect(syncSmartbillQueue.add).toHaveBeenCalledWith(
        'sync',
        expect.objectContaining({
          orgId: 'org-123',
          jobType: 'initial',
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return data sources for org', async () => {
      mockFind.mockResolvedValue([
        { id: '1', name: 'Source 1' },
        { id: '2', name: 'Source 2' },
      ]);

      const result = await service.findAll('org-123');
      expect(result).toHaveLength(2);
      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { org_id: 'org-123' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return data source by id and org', async () => {
      mockFindOne.mockResolvedValue({ id: 'ds-1', name: 'SmartBill' });

      const result = await service.findOne('org-123', 'ds-1');
      expect(result.name).toBe('SmartBill');
    });

    it('should throw NotFoundException when not found', async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(service.findOne('org-123', 'ds-missing')).rejects.toThrow();
    });
  });

  describe('triggerSync', () => {
    it('should throw if already syncing', async () => {
      mockFindOne.mockResolvedValue({
        id: 'ds-1',
        status: DataSourceStatus.SYNCING,
        org_id: 'org-123',
      });

      await expect(service.triggerSync('org-123', 'ds-1')).rejects.toThrow(
        'Sync is already in progress',
      );
    });
  });
});
