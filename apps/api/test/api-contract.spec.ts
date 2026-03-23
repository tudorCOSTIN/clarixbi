/**
 * API Contract Tests for ClarixBI
 *
 * Tests HTTP status codes, response envelope format, and auth guard behavior
 * for all API endpoints. Uses NestJS testing utilities with mocked dependencies
 * so no real infrastructure (DB, Redis, ClickHouse, etc.) is needed.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before any NestJS imports that trigger module loading
// ---------------------------------------------------------------------------

// Mock Redis config (imported by HealthController)
jest.mock('../src/config/redis.config', () => ({
  cacheRedis: { ping: jest.fn().mockResolvedValue('PONG') },
  bullRedis: {},
  CACHE_TTL_DEFAULT: 300,
}));

// Mock queues config (uses process.env['REDIS_URL'] at module level)
const mockQueue = { add: jest.fn(), close: jest.fn() };
jest.mock('../src/modules/sync/queues.config', () => ({
  QUEUE_CONFIGS: [],
  queues: {},
  syncSmartbillQueue: mockQueue,
  syncWoocommerceQueue: mockQueue,
  syncCsvQueue: mockQueue,
  reportsGenerateQueue: mockQueue,
  reportsEmailQueue: mockQueue,
  alertsCheckQueue: mockQueue,
  gdprHardDeleteQueue: mockQueue,
  gdprExportQueue: mockQueue,
}));

// Mock Sentry
jest.mock('../src/config/sentry.config', () => ({}));
jest.mock('@sentry/nestjs/setup', () => ({
  SentryGlobalFilter: class {},
}));

// ---------------------------------------------------------------------------
// Service stubs
// ---------------------------------------------------------------------------

const TEST_ORG_ID = '00000000-0000-4000-a000-000000000001';
const TEST_DASHBOARD_ID = '00000000-0000-4000-a000-000000000002';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const MISSING_ID = '00000000-0000-4000-a000-ffffffffffff';

const mockDashboard = {
  id: TEST_DASHBOARD_ID,
  name: 'Test Dashboard',
  org_id: TEST_ORG_ID,
  layout: [],
  created_at: new Date().toISOString(),
};

const stubDashboardsService = {
  create: jest.fn().mockResolvedValue(mockDashboard),
  findAll: jest.fn().mockResolvedValue([mockDashboard]),
  findOne: jest.fn().mockImplementation((_orgId: string, id: string) => {
    if (id === TEST_DASHBOARD_ID) return Promise.resolve(mockDashboard);
    const err = new NotFoundException('Dashboard not found');
    return Promise.reject(err);
  }),
  update: jest.fn().mockResolvedValue(mockDashboard),
  remove: jest.fn().mockResolvedValue(undefined),
};

const stubWidgetsService = {
  create: jest.fn().mockResolvedValue({ id: 'w1' }),
  findByDashboard: jest.fn().mockResolvedValue([]),
  update: jest.fn().mockResolvedValue({ id: 'w1' }),
  remove: jest.fn().mockResolvedValue(undefined),
  bulkUpdatePositions: jest.fn().mockResolvedValue(undefined),
};

const stubAiService = {
  createConversation: jest.fn().mockResolvedValue({ id: 'c1' }),
  listConversations: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  getConversation: jest.fn().mockResolvedValue({ id: 'c1', messages: [] }),
  deleteConversation: jest.fn().mockResolvedValue(undefined),
  sendMessage: jest.fn().mockResolvedValue({ answer: 'hello' }),
  getUsage: jest.fn().mockResolvedValue({ used: 0, limit: 100 }),
};

const stubReportsService = {
  create: jest.fn().mockResolvedValue({ id: 'r1' }),
  list: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  findOne: jest.fn().mockResolvedValue({ id: 'r1' }),
  update: jest.fn().mockResolvedValue({ id: 'r1' }),
  remove: jest.fn().mockResolvedValue(undefined),
  generate: jest.fn().mockResolvedValue({ url: '/file.pdf' }),
  getLatestDownloadUrl: jest.fn().mockResolvedValue({ url: '/file.pdf' }),
  getGeneratedFiles: jest.fn().mockResolvedValue({ files: [] }),
  createSchedule: jest.fn().mockResolvedValue({ id: 's1' }),
  removeSchedule: jest.fn().mockResolvedValue(undefined),
};

const stubAlertsService = {
  create: jest.fn().mockResolvedValue({ id: 'a1' }),
  list: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  findOne: jest.fn().mockResolvedValue({ id: 'a1' }),
  update: jest.fn().mockResolvedValue({ id: 'a1' }),
  remove: jest.fn().mockResolvedValue(undefined),
  toggle: jest.fn().mockResolvedValue({ id: 'a1', isActive: true }),
  test: jest.fn().mockResolvedValue({ triggered: false }),
  getTriggerHistory: jest.fn().mockResolvedValue({ data: [], total: 0 }),
};

const stubDataSourcesService = {
  addDataSource: jest.fn().mockResolvedValue({ id: 'ds1' }),
  addCsvDataSource: jest.fn().mockResolvedValue({ id: 'ds1' }),
  findAll: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue({ id: 'ds1' }),
  getPreview: jest.fn().mockResolvedValue({ rows: [] }),
  updateSchema: jest.fn().mockResolvedValue(undefined),
  testConnection: jest.fn().mockResolvedValue(true),
  triggerSync: jest.fn().mockResolvedValue(undefined),
  getColumns: jest.fn().mockResolvedValue([]),
};

const stubAuthService = {
  validateAuth0Token: jest.fn(),
  findOrCreateUser: jest.fn(),
  generateTokenPair: jest.fn(),
  getUserWithOrgs: jest.fn().mockResolvedValue({ id: TEST_USER_ID, email: 'test@test.com' }),
  revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
  refreshAccessToken: jest.fn(),
  sendMagicLink: jest.fn().mockResolvedValue(undefined),
};

const stubUsersService = {
  findById: jest.fn().mockResolvedValue({ id: TEST_USER_ID }),
  update: jest.fn().mockResolvedValue({ id: TEST_USER_ID }),
  softDelete: jest.fn().mockResolvedValue(undefined),
  getUserOrganizations: jest.fn().mockResolvedValue([]),
};

const stubOrganizationsService = {
  create: jest.fn().mockResolvedValue({ id: TEST_ORG_ID }),
  findById: jest.fn().mockResolvedValue({ id: TEST_ORG_ID }),
  update: jest.fn().mockResolvedValue({ id: TEST_ORG_ID }),
  softDelete: jest.fn().mockResolvedValue(undefined),
};

const stubSyncJobRepo = {
  findAndCount: jest.fn().mockResolvedValue([[], 0]),
};

const stubBillingService = {
  checkPlanLimit: jest.fn().mockResolvedValue(null),
};

// ---------------------------------------------------------------------------
// Minimal module assembly (avoids bootstrapping the full AppModule which
// requires real TypeORM, Redis, ClickHouse, BullMQ, etc.)
// ---------------------------------------------------------------------------

import { HealthController } from '../src/modules/health/health.controller';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { DashboardsController } from '../src/modules/dashboards/dashboards.controller';
import { DashboardsService } from '../src/modules/dashboards/dashboards.service';
import { WidgetsController } from '../src/modules/widgets/widgets.controller';
import { WidgetsService } from '../src/modules/widgets/widgets.service';
import { AiController } from '../src/modules/ai/ai.controller';
import { AiService } from '../src/modules/ai/ai.service';
import { ReportsController } from '../src/modules/reports/reports.controller';
import { ReportsService } from '../src/modules/reports/reports.service';
import { AlertsController } from '../src/modules/alerts/alerts.controller';
import { AlertsService } from '../src/modules/alerts/alerts.service';
import { DataSourcesController } from '../src/modules/data-sources/data-sources.controller';
import { DataSourcesService } from '../src/modules/data-sources/data-sources.service';
import { UsersController } from '../src/modules/users/users.controller';
import { UsersService } from '../src/modules/users/users.service';
import { OrganizationsController } from '../src/modules/organizations/organizations.controller';
import { OrganizationsService } from '../src/modules/organizations/organizations.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../src/modules/auth/guards/org-member.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { PlanLimitGuard } from '../src/modules/billing/guards/plan-limit.guard';
import { BillingService } from '../src/modules/billing/billing.service';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SyncJob } from '../src/modules/sync/entities/sync-job.entity';
import { TeamMember } from '../src/modules/teams/entities/team-member.entity';

const JWT_SECRET = 'test-secret-for-contract-tests';

/**
 * Test-only JWT strategy that validates tokens signed with our test secret.
 * Replaces the production JwtStrategy which requires Auth0 JWKS.
 */
@Injectable()
class TestJwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  validate(payload: { sub: string; email: string }) {
    return { id: payload.sub, email: payload.email };
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ClarixBI API Contract Tests', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let validToken: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
      ],
      controllers: [
        HealthController,
        AuthController,
        DashboardsController,
        WidgetsController,
        AiController,
        ReportsController,
        AlertsController,
        DataSourcesController,
        UsersController,
        OrganizationsController,
      ],
      providers: [
        { provide: AuthService, useValue: stubAuthService },
        { provide: DashboardsService, useValue: stubDashboardsService },
        { provide: WidgetsService, useValue: stubWidgetsService },
        { provide: AiService, useValue: stubAiService },
        { provide: ReportsService, useValue: stubReportsService },
        { provide: AlertsService, useValue: stubAlertsService },
        { provide: DataSourcesService, useValue: stubDataSourcesService },
        { provide: UsersService, useValue: stubUsersService },
        { provide: OrganizationsService, useValue: stubOrganizationsService },
        { provide: BillingService, useValue: stubBillingService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'NEXT_PUBLIC_APP_URL') return 'http://localhost:3000';
              return undefined;
            }),
          },
        },
        { provide: getRepositoryToken(SyncJob), useValue: stubSyncJobRepo },
        {
          provide: getRepositoryToken(TeamMember),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              user_id: TEST_USER_ID,
              org_id: TEST_ORG_ID,
              role: 'owner',
            }),
          },
        },
        TestJwtStrategy,
        JwtAuthGuard,
        OrgMemberGuard,
        RolesGuard,
        PlanLimitGuard,
        Reflector,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    jwtService = moduleRef.get<JwtService>(JwtService);
    validToken = jwtService.sign({ sub: TEST_USER_ID, id: TEST_USER_ID, email: 'test@test.com' });
  });

  afterAll(async () => {
    await app?.close();
  });

  // Helper to make authenticated requests
  const authGet = (url: string) =>
    request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${validToken}`);
  const authPost = (url: string) =>
    request(app.getHttpServer()).post(url).set('Authorization', `Bearer ${validToken}`);
  const authPatch = (url: string) =>
    request(app.getHttpServer()).patch(url).set('Authorization', `Bearer ${validToken}`);
  const authDelete = (url: string) =>
    request(app.getHttpServer()).delete(url).set('Authorization', `Bearer ${validToken}`);

  // =========================================================================
  // Health
  // =========================================================================

  describe('Health — GET /api/v1/health', () => {
    it('should return 200 with status ok', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('status', 'ok');
      expect(res.body.data).toHaveProperty('timestamp');
    });
  });

  // =========================================================================
  // Auth — unauthenticated
  // =========================================================================

  describe('Auth — unauthenticated', () => {
    it('GET /api/v1/auth/me → 401 (no JWT)', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('POST /api/v1/auth/callback → 400 (invalid body)', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/callback').send({}).expect(400);
    });

    it('POST /api/v1/auth/logout → 401 (no JWT)', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/logout').expect(401);
    });
  });

  // =========================================================================
  // Dashboards — protected by JwtAuthGuard + OrgMemberGuard + RolesGuard
  // =========================================================================

  describe('Dashboards — protected', () => {
    it('GET /api/v1/organizations/:orgId/dashboards → 401 (no JWT)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/organizations/${TEST_ORG_ID}/dashboards`)
        .expect(401);
    });

    it('GET /api/v1/organizations/:orgId/dashboards → 200 with JWT', async () => {
      const res = await authGet(`/api/v1/organizations/${TEST_ORG_ID}/dashboards`).expect(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/v1/organizations/:orgId/dashboards → 201 (create)', async () => {
      const res = await authPost(`/api/v1/organizations/${TEST_ORG_ID}/dashboards`)
        .send({ name: 'New Dashboard' })
        .expect(201);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
    });

    it('GET /api/v1/organizations/:orgId/dashboards/:id → 200 (found)', async () => {
      const res = await authGet(
        `/api/v1/organizations/${TEST_ORG_ID}/dashboards/${TEST_DASHBOARD_ID}`,
      ).expect(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id', TEST_DASHBOARD_ID);
    });

    it('GET /api/v1/organizations/:orgId/dashboards/:id → 404 (not found)', async () => {
      await authGet(`/api/v1/organizations/${TEST_ORG_ID}/dashboards/${MISSING_ID}`).expect(404);
    });

    it('PATCH /api/v1/organizations/:orgId/dashboards/:id → 200 (update)', async () => {
      const res = await authPatch(
        `/api/v1/organizations/${TEST_ORG_ID}/dashboards/${TEST_DASHBOARD_ID}`,
      )
        .send({ name: 'Updated' })
        .expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('DELETE /api/v1/organizations/:orgId/dashboards/:id → 200 (delete)', async () => {
      const res = await authDelete(
        `/api/v1/organizations/${TEST_ORG_ID}/dashboards/${TEST_DASHBOARD_ID}`,
      ).expect(200);
      expect(res.body.data).toHaveProperty('message');
    });

    it('rejects invalid UUID orgId → 400', async () => {
      await authGet('/api/v1/organizations/not-a-uuid/dashboards').expect(400);
    });
  });

  // =========================================================================
  // Widgets — protected
  // =========================================================================

  describe('Widgets — protected', () => {
    const widgetsBase = `/api/v1/organizations/${TEST_ORG_ID}/dashboards/${TEST_DASHBOARD_ID}/widgets`;

    it('GET → 401 (no JWT)', async () => {
      await request(app.getHttpServer()).get(widgetsBase).expect(401);
    });

    it('GET → 200 (list)', async () => {
      const res = await authGet(widgetsBase).expect(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST → 201 (create)', async () => {
      const res = await authPost(widgetsBase)
        .send({ type: 'bar', title: 'Revenue', config: {} })
        .expect(201);
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // AI — protected
  // =========================================================================

  describe('AI — protected', () => {
    const aiBase = `/api/v1/organizations/${TEST_ORG_ID}/ai`;

    it('GET /conversations → 401 (no JWT)', async () => {
      await request(app.getHttpServer()).get(`${aiBase}/conversations`).expect(401);
    });

    it('POST /conversations → 201', async () => {
      const res = await authPost(`${aiBase}/conversations`).expect(201);
      expect(res.body).toHaveProperty('data');
    });

    it('GET /conversations → 200 (list)', async () => {
      const res = await authGet(`${aiBase}/conversations`).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('GET /usage → 200', async () => {
      const res = await authGet(`${aiBase}/usage`).expect(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // Reports — protected
  // =========================================================================

  describe('Reports — protected', () => {
    const reportsBase = `/api/v1/organizations/${TEST_ORG_ID}/reports`;

    it('GET → 401 (no JWT)', async () => {
      await request(app.getHttpServer()).get(reportsBase).expect(401);
    });

    it('GET → 200 (list)', async () => {
      const res = await authGet(reportsBase).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('POST → 201 (create)', async () => {
      const res = await authPost(reportsBase)
        .send({
          name: 'Monthly Report',
          dashboardId: TEST_DASHBOARD_ID,
          widgetIds: [TEST_DASHBOARD_ID],
        })
        .expect(201);
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // Alerts — protected
  // =========================================================================

  describe('Alerts — protected', () => {
    const alertsBase = `/api/v1/organizations/${TEST_ORG_ID}/alerts`;

    it('GET → 401 (no JWT)', async () => {
      await request(app.getHttpServer()).get(alertsBase).expect(401);
    });

    it('GET → 200 (list)', async () => {
      const res = await authGet(alertsBase).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('POST → 201 (create)', async () => {
      const res = await authPost(alertsBase)
        .send({
          name: 'High Error Rate',
          dataSourceId: TEST_DASHBOARD_ID,
          metricQuery: 'SELECT count(*) FROM errors',
          conditionOperator: 'gt',
          thresholdValue: 100,
          checkFrequency: 'hourly',
        })
        .expect(201);
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // Data Sources — protected
  // =========================================================================

  describe('Data Sources — protected', () => {
    const dsBase = `/api/v1/organizations/${TEST_ORG_ID}/data-sources`;

    it('GET → 401 (no JWT)', async () => {
      await request(app.getHttpServer()).get(dsBase).expect(401);
    });

    it('GET → 200 (list)', async () => {
      const res = await authGet(dsBase).expect(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // =========================================================================
  // Users — protected by JwtAuthGuard at controller level
  // =========================================================================

  describe('Users — protected', () => {
    it('GET /api/v1/users/me → 401 (no JWT)', async () => {
      await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
    });

    it('GET /api/v1/users/me → 200 with valid JWT', async () => {
      const res = await authGet('/api/v1/users/me').expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('PATCH /api/v1/users/me → 401 (no JWT)', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .send({ name: 'Updated' })
        .expect(401);
    });

    it('DELETE /api/v1/users/me → 401 (no JWT)', async () => {
      await request(app.getHttpServer()).delete('/api/v1/users/me').expect(401);
    });

    it('GET /api/v1/users/me/organizations → 401 (no JWT)', async () => {
      await request(app.getHttpServer()).get('/api/v1/users/me/organizations').expect(401);
    });
  });

  // =========================================================================
  // Organizations — protected by JwtAuthGuard at controller level
  // =========================================================================

  describe('Organizations — protected', () => {
    it('POST /api/v1/organizations → 401 (no JWT)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .send({ name: 'Acme Corp' })
        .expect(401);
    });

    it('POST /api/v1/organizations → 201 with valid JWT', async () => {
      const res = await authPost('/api/v1/organizations').send({ name: 'Acme Corp' }).expect(201);
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // Auth — authenticated
  // =========================================================================

  describe('Auth — authenticated', () => {
    it('GET /api/v1/auth/me → 200 with valid JWT', async () => {
      const res = await authGet('/api/v1/auth/me').expect(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // Response envelope format validation
  // =========================================================================

  describe('Response envelope format', () => {
    it('list endpoints return { data: [...] }', async () => {
      const res = await authGet(`/api/v1/organizations/${TEST_ORG_ID}/dashboards`).expect(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('detail endpoints return { data: {...} }', async () => {
      const res = await authGet(
        `/api/v1/organizations/${TEST_ORG_ID}/dashboards/${TEST_DASHBOARD_ID}`,
      ).expect(200);
      expect(res.body).toHaveProperty('data');
      expect(typeof res.body.data).toBe('object');
      expect(Array.isArray(res.body.data)).toBe(false);
    });

    it('paginated endpoints return { data: [...], total: number }', async () => {
      const res = await authGet(`/api/v1/organizations/${TEST_ORG_ID}/reports`).expect(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(typeof res.body.total).toBe('number');
    });

    it('delete endpoints return { data: { message: string } }', async () => {
      const res = await authDelete(
        `/api/v1/organizations/${TEST_ORG_ID}/dashboards/${TEST_DASHBOARD_ID}`,
      ).expect(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('message');
      expect(typeof res.body.data.message).toBe('string');
    });

    it('health returns { data: { status, timestamp, services } }', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
      expect(res.body.data).toHaveProperty('status');
      expect(res.body.data).toHaveProperty('timestamp');
      expect(res.body.data).toHaveProperty('services');
    });
  });
});
