/**
 * Session Persistence Tests
 *
 * Verifies that:
 * - User actions are persisted to DB immediately (not session-only)
 * - Token refresh works correctly
 * - Idle timeout is enforced
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/modules/auth/auth.service';
import { User } from '../src/modules/users/entities/user.entity';
import { Organization } from '../src/modules/organizations/entities/organization.entity';
import { TeamMember } from '../src/modules/teams/entities/team-member.entity';
import { BillingService } from '../src/modules/billing/billing.service';
import { DashboardsService } from '../src/modules/dashboards/dashboards.service';
import { Dashboard } from '../src/modules/dashboards/entities/dashboard.entity';
import { DashboardShare } from '../src/modules/dashboards/entities/dashboard-share.entity';
import { Widget } from '../src/modules/widgets/entities/widget.entity';
import { ClickHouseService } from '../src/modules/clickhouse/clickhouse.service';

jest.mock('../src/modules/clickhouse/clickhouse.service');

jest.mock('../src/config/redis.config', () => ({
  cacheRedis: { ping: jest.fn().mockResolvedValue('PONG') },
  bullRedis: {},
  CACHE_TTL_DEFAULT: 300,
}));

// ===========================================================================
// Dashboard persistence
// ===========================================================================
describe('Session Persistence — Dashboard', () => {
  let service: DashboardsService;
  const mockDashboardRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardsService,
        { provide: getRepositoryToken(Dashboard), useValue: mockDashboardRepo },
        { provide: getRepositoryToken(DashboardShare), useValue: {} },
        { provide: getRepositoryToken(Widget), useValue: {} },
        { provide: ClickHouseService, useValue: {} },
      ],
    }).compile();

    service = module.get<DashboardsService>(DashboardsService);
    jest.clearAllMocks();
  });

  it('create() should save to DB immediately (not session-only)', async () => {
    const orgId = 'org-1';
    const userId = 'user-1';
    const dto = { name: 'My Dashboard' };
    const savedDashboard = { id: 'dash-1', ...dto, org_id: orgId };

    mockDashboardRepo.create.mockReturnValue(savedDashboard);
    mockDashboardRepo.save.mockResolvedValue(savedDashboard);

    const result = await service.create(orgId, userId, dto);

    expect(mockDashboardRepo.save).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('dash-1');
  });

  it('created dashboard should be retrievable via findOne', async () => {
    const orgId = 'org-1';
    const dashId = 'dash-1';
    const dashboard = { id: dashId, org_id: orgId, name: 'My Dashboard' };

    mockDashboardRepo.findOne.mockResolvedValue(dashboard);

    const result = await service.findOne(orgId, dashId);
    expect(result.id).toBe(dashId);
    expect(result.name).toBe('My Dashboard');
  });
});

// ===========================================================================
// Auth token refresh + idle timeout
// ===========================================================================
describe('Session Persistence — Token Refresh + Idle Timeout', () => {
  let authService: AuthService;

  // Mock Redis as in-memory store
  const redisStore: Record<string, string> = {};
  const mockRedis = {
    set: jest.fn(async (key: string, value: string) => {
      redisStore[key] = value;
    }),
    get: jest.fn(async (key: string) => redisStore[key] || null),
    del: jest.fn(async (key: string) => {
      delete redisStore[key];
    }),
    keys: jest.fn(async (pattern: string) => {
      // Convert Redis glob pattern to regex: refresh:*:tokenValue → matches keys containing tokenValue
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');
      const regex = new RegExp(`^${escaped}$`);
      return Object.keys(redisStore).filter((k) => regex.test(k));
    }),
    scan: jest.fn(async (_cursor: string, _matchKey: string, pattern: string) => {
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');
      const regex = new RegExp(`^${escaped}$`);
      const matched = Object.keys(redisStore).filter((k) => regex.test(k));
      return ['0', matched];
    }),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-access-token'),
  };

  beforeEach(async () => {
    // Clear store
    for (const key of Object.keys(redisStore)) {
      delete redisStore[key];
    }

    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'auth.redisUrl') return 'redis://mock';
              if (key === 'auth.refreshTokenExpiresIn') return 2592000;
              return undefined;
            }),
          },
        },
        { provide: JwtService, useValue: mockJwtService },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Organization), useValue: {} },
        { provide: getRepositoryToken(TeamMember), useValue: {} },
        { provide: BillingService, useValue: { autoEnrollTrial: jest.fn() } },
        { provide: 'BILLING_SERVICE', useValue: { autoEnrollTrial: jest.fn() } },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);

    // Replace redis instance with our mock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (authService as any).redis = mockRedis;
  });

  it('generateTokenPair should store refresh token with lastActivity', async () => {
    const user = { id: 'user-1', email: 'test@test.com', auth0_id: 'auth0|123' } as User;

    const tokens = await authService.generateTokenPair(user);

    expect(tokens.access_token).toBe('mock-access-token');
    expect(tokens.refresh_token).toBeTruthy();

    // Verify Redis was called with lastActivity
    const setCall = mockRedis.set.mock.calls[0]!;
    const storedData = JSON.parse(setCall[1] as string);
    expect(storedData.lastActivity).toBeDefined();
    expect(storedData.userId).toBe('user-1');
  });

  it('refreshAccessToken should succeed with recent activity', async () => {
    const user = { id: 'user-1', email: 'test@test.com', is_active: true } as User;
    mockUserRepo.findOne.mockResolvedValue(user);

    const refreshToken = 'valid-refresh-token';
    const key = `refresh:user-1:${refreshToken}`;
    redisStore[key] = JSON.stringify({
      userId: 'user-1',
      createdAt: Date.now(),
      lastActivity: Date.now(), // Just now — not idle
    });

    const tokens = await authService.refreshAccessToken(refreshToken);
    expect(tokens.access_token).toBe('mock-access-token');
  });

  it('refreshAccessToken should reject when idle > 7 days', async () => {
    const refreshToken = 'idle-refresh-token';
    const key = `refresh:user-1:${refreshToken}`;
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;

    redisStore[key] = JSON.stringify({
      userId: 'user-1',
      createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
      lastActivity: eightDaysAgo,
    });

    try {
      await authService.refreshAccessToken(refreshToken);
      fail('Expected UnauthorizedException');
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect((err as UnauthorizedException).message).toMatch(/inactivity/i);
    }
  });

  it('refreshAccessToken should reject when token not found', async () => {
    await expect(authService.refreshAccessToken('nonexistent-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
