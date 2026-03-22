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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: DataSource,
          useValue: {
            query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
          },
        },
        {
          provide: ClickHouseService,
          useValue: {
            healthCheck: jest.fn().mockResolvedValue({ ok: true }),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('GET /health', () => {
    it('should return status ok with all services up', async () => {
      const result = await controller.check();

      expect(result.data.status).toBe('ok');
      expect(result.data.timestamp).toBeDefined();
      expect(result.data.services.postgres).toBe('up');
      expect(result.data.services.clickhouse).toBe('up');
      expect(result.data.services.redis).toBe('up');
    });
  });
});
