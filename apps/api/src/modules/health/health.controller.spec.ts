import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

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
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('GET /health', () => {
    it('should return status ok with redis connected', async () => {
      const result = await controller.check();

      expect(result.data.status).toBe('ok');
      expect(result.data.timestamp).toBeDefined();
      expect(result.data.services.redis).toBe('connected');
    });
  });
});
