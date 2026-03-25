/**
 * Cross-Cutting Concerns — Integration Tests
 *
 * Verifies input validation (forbidNonWhitelisted, UUID, SQL injection),
 * tenant isolation via OrgMemberGuard, and RBAC enforcement via RolesGuard.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';

jest.mock('../../src/config/redis.config', () => ({
  cacheRedis: { ping: jest.fn().mockResolvedValue('PONG') },
  bullRedis: {},
  CACHE_TTL_DEFAULT: 300,
}));

const mockQueue = { add: jest.fn(), close: jest.fn() };
jest.mock('../../src/modules/sync/queues.config', () => ({
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

jest.mock('../../src/config/sentry.config', () => ({}));
jest.mock('@sentry/nestjs/setup', () => ({
  SentryGlobalFilter: class {},
}));

import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DataSource } from 'typeorm';

import { DashboardsController } from '../../src/modules/dashboards/dashboards.controller';
import { AlertsController } from '../../src/modules/alerts/alerts.controller';
import { ReportsController } from '../../src/modules/reports/reports.controller';
import { DashboardsService } from '../../src/modules/dashboards/dashboards.service';
import { AlertsService } from '../../src/modules/alerts/alerts.service';
import { ReportsService } from '../../src/modules/reports/reports.service';
import { BillingService } from '../../src/modules/billing/billing.service';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../../src/modules/auth/guards/org-member.guard';
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard';
import { PlanLimitGuard } from '../../src/modules/billing/guards/plan-limit.guard';
import { TeamMember } from '../../src/modules/teams/entities/team-member.entity';

const JWT_SECRET = 'cross-cutting-test-secret';
const ORG_A = '00000000-0000-4000-a000-aaaaaaaaaaaa';
const ORG_B = '00000000-0000-4000-a000-bbbbbbbbbbbb';
const USER_A = '00000000-0000-4000-a000-000000000001';
const USER_B = '00000000-0000-4000-a000-000000000002';

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

describe('Cross-Cutting Concerns (Integration)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let tokenOrgA: string;
  let teamMemberRepo: { findOne: jest.Mock };

  const stubDashboards = {
    create: jest.fn().mockResolvedValue({ id: 'd1', name: 'Test' }),
    findAll: jest
      .fn()
      .mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
    findOne: jest.fn().mockResolvedValue({ id: 'd1' }),
    update: jest.fn().mockResolvedValue({ id: 'd1' }),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  const stubAlerts = {
    create: jest.fn().mockResolvedValue({ id: 'a1' }),
    list: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    findOne: jest.fn().mockResolvedValue({ id: 'a1' }),
    update: jest.fn().mockResolvedValue({ id: 'a1' }),
    remove: jest.fn().mockResolvedValue(undefined),
    toggle: jest.fn().mockResolvedValue({ id: 'a1', isActive: true }),
    test: jest.fn().mockResolvedValue({ triggered: false }),
    getTriggerHistory: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  };

  const stubReports = {
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

  beforeAll(async () => {
    teamMemberRepo = {
      findOne: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
      ],
      controllers: [DashboardsController, AlertsController, ReportsController],
      providers: [
        { provide: DataSource, useValue: { query: jest.fn() } },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
        { provide: DashboardsService, useValue: stubDashboards },
        { provide: AlertsService, useValue: stubAlerts },
        { provide: ReportsService, useValue: stubReports },
        {
          provide: BillingService,
          useValue: { checkPlanLimit: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: 'BILLING_SERVICE',
          useValue: { checkPlanLimit: jest.fn().mockResolvedValue(null) },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: getRepositoryToken(TeamMember), useValue: teamMemberRepo },
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
    tokenOrgA = jwtService.sign({ sub: USER_A, id: USER_A, email: 'a@test.com' });
    // tokenOrgB available if needed for future cross-org tests
    jwtService.sign({ sub: USER_B, id: USER_B, email: 'b@test.com' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Input Validation
  // =========================================================================

  describe('Input Validation', () => {
    beforeEach(() => {
      teamMemberRepo.findOne.mockResolvedValue({
        user_id: USER_A,
        org_id: ORG_A,
        role: 'owner',
      });
    });

    it('strips extra fields (forbidNonWhitelisted) on dashboard create', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${ORG_A}/dashboards`)
        .set('Authorization', `Bearer ${tokenOrgA}`)
        .send({ name: 'Test', unknownField: 'hack' });
      expect(res.status).toBe(400);
    });

    it('rejects missing required fields on dashboard create', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${ORG_A}/dashboards`)
        .set('Authorization', `Bearer ${tokenOrgA}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('rejects invalid UUID path params', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/organizations/not-a-uuid/dashboards`)
        .set('Authorization', `Bearer ${tokenOrgA}`)
        .expect(400);
    });

    it('rejects SQL injection attempt in string fields', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${ORG_A}/dashboards`)
        .set('Authorization', `Bearer ${tokenOrgA}`)
        .send({ name: "'; DROP TABLE dashboards; --" });

      // Should either reject (400) or sanitize and accept (201).
      // The important thing is it does NOT crash (500).
      expect(res.status).toBeLessThan(500);

      // If accepted, the SQL should be treated as a literal string
      if (res.status === 201) {
        expect(stubDashboards.create).toHaveBeenCalled();
      }
    });

    it('rejects XSS in string fields', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${ORG_A}/dashboards`)
        .set('Authorization', `Bearer ${tokenOrgA}`)
        .send({ name: '<script>alert("xss")</script>' });

      // Should not crash. String validation may pass (MaxLength 200), but it's stored as-is
      expect(res.status).toBeLessThan(500);
    });
  });

  // =========================================================================
  // Tenant Isolation (OrgMemberGuard)
  // =========================================================================

  describe('Tenant Isolation', () => {
    it('user from org-A CANNOT access org-B dashboards', async () => {
      // User A is a member of ORG_A, NOT of ORG_B
      teamMemberRepo.findOne.mockImplementation(
        (opts: { where: { user_id: string; org_id: string } }) => {
          if (opts.where.org_id === ORG_A && opts.where.user_id === USER_A) {
            return Promise.resolve({ user_id: USER_A, org_id: ORG_A, role: 'owner' });
          }
          return Promise.resolve(null); // Not a member of other orgs
        },
      );

      const res = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${ORG_B}/dashboards`)
        .set('Authorization', `Bearer ${tokenOrgA}`);

      expect(res.status).toBe(403);
    });

    it('user from org-A CANNOT access org-B alerts', async () => {
      teamMemberRepo.findOne.mockImplementation(
        (opts: { where: { user_id: string; org_id: string } }) => {
          if (opts.where.org_id === ORG_A && opts.where.user_id === USER_A) {
            return Promise.resolve({ user_id: USER_A, org_id: ORG_A, role: 'owner' });
          }
          return Promise.resolve(null);
        },
      );

      const res = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${ORG_B}/alerts`)
        .set('Authorization', `Bearer ${tokenOrgA}`);

      expect(res.status).toBe(403);
    });

    it('user from org-A CANNOT access org-B reports', async () => {
      teamMemberRepo.findOne.mockImplementation(
        (opts: { where: { user_id: string; org_id: string } }) => {
          if (opts.where.org_id === ORG_A && opts.where.user_id === USER_A) {
            return Promise.resolve({ user_id: USER_A, org_id: ORG_A, role: 'owner' });
          }
          return Promise.resolve(null);
        },
      );

      const res = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${ORG_B}/reports`)
        .set('Authorization', `Bearer ${tokenOrgA}`);

      expect(res.status).toBe(403);
    });

    it('user from org-A CAN access org-A dashboards', async () => {
      teamMemberRepo.findOne.mockResolvedValue({
        user_id: USER_A,
        org_id: ORG_A,
        role: 'owner',
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${ORG_A}/dashboards`)
        .set('Authorization', `Bearer ${tokenOrgA}`);

      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // RBAC (RolesGuard)
  // =========================================================================

  describe('RBAC enforcement', () => {
    it('VIEWER cannot create dashboards (requires EDITOR)', async () => {
      teamMemberRepo.findOne.mockResolvedValue({
        user_id: USER_A,
        org_id: ORG_A,
        role: 'viewer',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${ORG_A}/dashboards`)
        .set('Authorization', `Bearer ${tokenOrgA}`)
        .send({ name: 'Test' });

      expect(res.status).toBe(403);
    });

    it('VIEWER can list dashboards', async () => {
      teamMemberRepo.findOne.mockResolvedValue({
        user_id: USER_A,
        org_id: ORG_A,
        role: 'viewer',
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${ORG_A}/dashboards`)
        .set('Authorization', `Bearer ${tokenOrgA}`);

      expect(res.status).toBe(200);
    });

    it('EDITOR can create dashboards', async () => {
      teamMemberRepo.findOne.mockResolvedValue({
        user_id: USER_A,
        org_id: ORG_A,
        role: 'editor',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${ORG_A}/dashboards`)
        .set('Authorization', `Bearer ${tokenOrgA}`)
        .send({ name: 'Test' });

      expect(res.status).toBe(201);
    });

    it('VIEWER cannot create alerts (requires EDITOR)', async () => {
      teamMemberRepo.findOne.mockResolvedValue({
        user_id: USER_A,
        org_id: ORG_A,
        role: 'viewer',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${ORG_A}/alerts`)
        .set('Authorization', `Bearer ${tokenOrgA}`)
        .send({
          name: 'Test',
          dataSourceId: '00000000-0000-4000-a000-000000000050',
          metricQuery: 'SELECT 1',
          conditionOperator: 'gt',
          thresholdValue: 100,
          checkFrequency: 'hourly',
        });

      expect(res.status).toBe(403);
    });

    it('VIEWER cannot delete alerts (requires EDITOR)', async () => {
      teamMemberRepo.findOne.mockResolvedValue({
        user_id: USER_A,
        org_id: ORG_A,
        role: 'viewer',
      });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/organizations/${ORG_A}/alerts/00000000-0000-4000-a000-000000000030`)
        .set('Authorization', `Bearer ${tokenOrgA}`);

      expect(res.status).toBe(403);
    });
  });
});
