import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';
import { ClickHouseService } from '../clickhouse/clickhouse.service';

jest.mock('../../config/redis.config', () => ({
  cacheRedis: {
    ping: jest.fn().mockResolvedValue('PONG'),
  },
}));

describe('HealthController', () => {
  let controller: HealthController;

  const mockDataSource = {
    query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };

  const mockClickHouseService = {
    healthCheck: jest.fn().mockResolvedValue({ ok: true }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DataSource, useValue: mockDataSource },
        { provide: ClickHouseService, useValue: mockClickHouseService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('GET /health', () => {
    it('should return status ok with all services connected', async () => {
      const result = await controller.check();

      expect(result.data.status).toBe('ok');
      expect(result.data.timestamp).toBeDefined();
      expect(result.data.services.redis).toBe('connected');
      expect(result.data.services.postgres).toBe('connected');
      expect(result.data.services.clickhouse).toBe('connected');
    });

    it('should return degraded when a service is down', async () => {
      mockDataSource.query.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await controller.check();

      expect(result.data.status).toBe('degraded');
      expect(result.data.services.postgres).toBe('error');
      expect(result.data.services.redis).toBe('connected');
    });
  });
});
