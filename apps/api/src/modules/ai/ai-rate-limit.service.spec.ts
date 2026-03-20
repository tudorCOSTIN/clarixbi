import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiRateLimitService } from './ai-rate-limit.service';
import { Subscription } from '../billing/entities/subscription.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { TeamMember } from '../teams/entities/team-member.entity';
import { NotificationsGateway } from '../notifications/notifications.gateway';

// Mock Redis
const mockRedisGet = jest.fn();
const mockRedisIncr = jest.fn();
const mockRedisExpire = jest.fn();

jest.mock('../../config/redis.config', () => ({
  cacheRedis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    incr: (...args: unknown[]) => mockRedisIncr(...args),
    expire: (...args: unknown[]) => mockRedisExpire(...args),
  },
}));

describe('AiRateLimitService', () => {
  let service: AiRateLimitService;
  const mockSubscriptionRepo = {
    findOne: jest.fn(),
  };
  const mockNotificationRepo = {
    create: jest.fn((data) => ({ id: 'notif-1', ...data })),
    save: jest.fn((data) => data),
  };
  const mockTeamMemberRepo = {
    find: jest.fn(),
  };
  const mockGateway = {
    emitNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiRateLimitService,
        { provide: getRepositoryToken(Subscription), useValue: mockSubscriptionRepo },
        { provide: getRepositoryToken(Notification), useValue: mockNotificationRepo },
        { provide: getRepositoryToken(TeamMember), useValue: mockTeamMemberRepo },
        { provide: NotificationsGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<AiRateLimitService>(AiRateLimitService);
    jest.clearAllMocks();
  });

  describe('checkAndIncrement', () => {
    it('should allow query when under limit (Starter)', async () => {
      mockSubscriptionRepo.findOne.mockResolvedValue({
        plan: { name: 'starter', limits: { max_ai_queries_monthly: 100 } },
      });
      mockRedisGet.mockResolvedValue('50');
      mockRedisIncr.mockResolvedValue(51);
      mockTeamMemberRepo.find.mockResolvedValue([]);

      const result = await service.checkAndIncrement('org-1', 'user-1');
      expect(result.allowed).toBe(true);
      expect(result.usage.used).toBe(51);
    });

    it('should block 101st query on Starter plan with HTTP 429 data', async () => {
      mockSubscriptionRepo.findOne.mockResolvedValue({
        plan: { name: 'starter', limits: { max_ai_queries_monthly: 100 } },
      });
      mockRedisGet.mockResolvedValue('100');

      const result = await service.checkAndIncrement('org-1', 'user-1');
      expect(result.allowed).toBe(false);
      expect(result.usage.used).toBe(100);
      expect(result.usage.limit).toBe(100);
    });

    it('should allow Enterprise past soft limit', async () => {
      mockSubscriptionRepo.findOne.mockResolvedValue({
        plan: { name: 'enterprise', limits: { max_ai_queries_monthly: 2000 } },
      });
      mockRedisGet.mockResolvedValue('2100');
      mockRedisIncr.mockResolvedValue(2101);
      mockTeamMemberRepo.find.mockResolvedValue([]);

      const result = await service.checkAndIncrement('org-1', 'user-1');
      expect(result.allowed).toBe(true);
    });

    it('should trigger warning notification at 70% threshold', async () => {
      mockSubscriptionRepo.findOne.mockResolvedValue({
        plan: { name: 'pro', limits: { max_ai_queries_monthly: 500 } },
      });
      mockRedisGet.mockResolvedValue('349'); // 349/500 = 69.8% (below 70)
      mockRedisIncr.mockResolvedValue(350); // 350/500 = 70% (hits threshold)
      mockTeamMemberRepo.find.mockResolvedValue([{ user_id: 'user-1', org_id: 'org-1' }]);

      await service.checkAndIncrement('org-1', 'user-1');

      expect(mockNotificationRepo.save).toHaveBeenCalled();
      expect(mockGateway.emitNotification).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          type: 'plan_limit_warning',
        }),
      );
    });
  });

  describe('getRetryConfig', () => {
    it('should return 0 retries for Starter', async () => {
      mockSubscriptionRepo.findOne.mockResolvedValue({
        plan: { name: 'starter', limits: { max_ai_queries_monthly: 100 } },
      });
      const config = await service.getRetryConfig('org-1');
      expect(config.maxRetries).toBe(0);
    });

    it('should return 3 retries for Pro', async () => {
      mockSubscriptionRepo.findOne.mockResolvedValue({
        plan: { name: 'pro', limits: { max_ai_queries_monthly: 500 } },
      });
      const config = await service.getRetryConfig('org-1');
      expect(config.maxRetries).toBe(3);
    });

    it('should return 5 retries for Enterprise', async () => {
      mockSubscriptionRepo.findOne.mockResolvedValue({
        plan: { name: 'enterprise', limits: { max_ai_queries_monthly: 2000 } },
      });
      const config = await service.getRetryConfig('org-1');
      expect(config.maxRetries).toBe(5);
      expect(config.notifyOnFinalFailure).toBe(true);
    });
  });

  describe('getUsage', () => {
    it('should return correct usage info', async () => {
      mockSubscriptionRepo.findOne.mockResolvedValue({
        plan: { name: 'pro', limits: { max_ai_queries_monthly: 500 } },
      });
      mockRedisGet.mockResolvedValue('250');

      const usage = await service.getUsage('org-1');
      expect(usage.used).toBe(250);
      expect(usage.limit).toBe(500);
      expect(usage.percentage).toBe(50);
      expect(usage.tier).toBe('pro');
    });
  });
});
