jest.mock('../../config/clickhouse.config', () => ({
  createClickHouseClient: jest.fn().mockReturnValue({
    query: jest.fn(),
    insert: jest.fn(),
    close: jest.fn(),
  }),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ClickHouseService } from './clickhouse.service';
import { createClickHouseClient } from '../../config/clickhouse.config';

describe('ClickHouseService', () => {
  let service: ClickHouseService;
  let mockClient: {
    query: jest.Mock;
    insert: jest.Mock;
    close: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClickHouseService],
    }).compile();

    service = module.get<ClickHouseService>(ClickHouseService);
    mockClient = (createClickHouseClient as jest.Mock).mock.results[0]!.value;
    jest.clearAllMocks();
  });

  describe('query', () => {
    it('should execute query and return JSON rows', async () => {
      const rows = [{ id: '1', name: 'test' }];
      mockClient.query.mockResolvedValue({
        json: jest.fn().mockResolvedValue(rows),
      });

      const result = await service.query('SELECT * FROM test_table');

      expect(result).toEqual(rows);
      expect(mockClient.query).toHaveBeenCalledWith({
        query: 'SELECT * FROM test_table',
        query_params: undefined,
        format: 'JSONEachRow',
      });
    });

    it('should pass query params when provided', async () => {
      mockClient.query.mockResolvedValue({
        json: jest.fn().mockResolvedValue([]),
      });

      await service.query('SELECT * FROM t WHERE org_id = {orgId:String}', { orgId: 'org-1' });

      expect(mockClient.query).toHaveBeenCalledWith({
        query: 'SELECT * FROM t WHERE org_id = {orgId:String}',
        query_params: { orgId: 'org-1' },
        format: 'JSONEachRow',
      });
    });
  });

  describe('insert', () => {
    it('should insert rows into the specified table', async () => {
      mockClient.insert.mockResolvedValue(undefined);
      const rows = [
        { id: '1', value: 100 },
        { id: '2', value: 200 },
      ];

      await service.insert('metrics', rows);

      expect(mockClient.insert).toHaveBeenCalledWith({
        table: 'metrics',
        values: rows,
        format: 'JSONEachRow',
      });
    });

    it('should return immediately for empty array', async () => {
      await service.insert('metrics', []);

      expect(mockClient.insert).not.toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return ok:true when SELECT 1 succeeds', async () => {
      mockClient.query.mockResolvedValue({
        json: jest.fn().mockResolvedValue([{ ping: 1 }]),
      });

      const result = await service.healthCheck();

      expect(result).toEqual({ ok: true });
      expect(mockClient.query).toHaveBeenCalledWith({
        query: 'SELECT 1 AS ping',
        format: 'JSONEachRow',
      });
    });

    it('should return ok:false on error', async () => {
      mockClient.query.mockRejectedValue(new Error('Connection refused'));

      const result = await service.healthCheck();

      expect(result).toEqual({ ok: false, error: 'Connection refused' });
    });
  });

  describe('onModuleDestroy', () => {
    it('should close the ClickHouse client', async () => {
      mockClient.close.mockResolvedValue(undefined);

      await service.onModuleDestroy();

      expect(mockClient.close).toHaveBeenCalledTimes(1);
    });
  });
});
