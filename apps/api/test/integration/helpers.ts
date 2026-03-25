/**
 * Shared helpers and mocks for integration tests.
 *
 * Provides a reusable NestJS testing module with all controllers,
 * mocked services, test JWT strategy, and supertest request helpers.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before NestJS imports that trigger module loading
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

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

// Controllers
import { HealthController } from '../../src/modules/health/health.controller';
import { AuthController } from '../../src/modules/auth/auth.controller';
import { DashboardsController } from '../../src/modules/dashboards/dashboards.controller';
import { SharedDashboardController } from '../../src/modules/dashboards/shared-dashboard.controller';
import { WidgetsController } from '../../src/modules/widgets/widgets.controller';
import { AiController } from '../../src/modules/ai/ai.controller';
import { ReportsController } from '../../src/modules/reports/reports.controller';
import { AlertsController } from '../../src/modules/alerts/alerts.controller';
import { DataSourcesController } from '../../src/modules/data-sources/data-sources.controller';
import { UsersController } from '../../src/modules/users/users.controller';
import { OrganizationsController } from '../../src/modules/organizations/organizations.controller';
import { BillingController } from '../../src/modules/billing/billing.controller';
import { TeamsController } from '../../src/modules/teams/teams.controller';
import { InviteAcceptController } from '../../src/modules/teams/invite-accept.controller';
import { NotificationsController } from '../../src/modules/notifications/notifications.controller';
import { SettingsController } from '../../src/modules/settings/settings.controller';
import { GdprController } from '../../src/modules/gdpr/gdpr.controller';
import { AdminController } from '../../src/modules/admin/admin.controller';
import { OnboardingController } from '../../src/modules/onboarding/onboarding.controller';
import { OverviewController } from '../../src/modules/overview/overview.controller';

// Services
import { AuthService } from '../../src/modules/auth/auth.service';
import { DashboardsService } from '../../src/modules/dashboards/dashboards.service';
import { WidgetsService } from '../../src/modules/widgets/widgets.service';
import { AiService } from '../../src/modules/ai/ai.service';
import { ReportsService } from '../../src/modules/reports/reports.service';
import { AlertsService } from '../../src/modules/alerts/alerts.service';
import { DataSourcesService } from '../../src/modules/data-sources/data-sources.service';
import { UsersService } from '../../src/modules/users/users.service';
import { OrganizationsService } from '../../src/modules/organizations/organizations.service';
import { BillingService } from '../../src/modules/billing/billing.service';
import { TeamsService } from '../../src/modules/teams/teams.service';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { SettingsService } from '../../src/modules/settings/settings.service';
import { GdprService } from '../../src/modules/gdpr/gdpr.service';
import { AdminService } from '../../src/modules/admin/admin.service';
import { OnboardingService } from '../../src/modules/onboarding/onboarding.service';
import { OverviewService } from '../../src/modules/overview/overview.service';

// Guards
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../../src/modules/auth/guards/org-member.guard';
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard';
import { PlanLimitGuard } from '../../src/modules/billing/guards/plan-limit.guard';

// Entities (for repository tokens)
import { ClickHouseService } from '../../src/modules/clickhouse/clickhouse.service';
import { SyncJob } from '../../src/modules/sync/entities/sync-job.entity';
import { TeamMember } from '../../src/modules/teams/entities/team-member.entity';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const JWT_SECRET = 'test-secret-for-integration-tests';
export const TEST_ORG_ID = '00000000-0000-4000-a000-000000000001';
export const TEST_ORG_B_ID = '00000000-0000-4000-a000-000000000002';
export const TEST_DASHBOARD_ID = '00000000-0000-4000-a000-000000000010';
export const TEST_WIDGET_ID = '00000000-0000-4000-a000-000000000020';
export const TEST_ALERT_ID = '00000000-0000-4000-a000-000000000030';
export const TEST_REPORT_ID = '00000000-0000-4000-a000-000000000040';
export const TEST_DS_ID = '00000000-0000-4000-a000-000000000050';
export const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
export const TEST_MEMBER_ID = '00000000-0000-4000-a000-000000000088';
export const TEST_NOTIF_ID = '00000000-0000-4000-a000-000000000077';
export const MISSING_ID = '00000000-0000-4000-a000-ffffffffffff';

// ---------------------------------------------------------------------------
// Test JWT Strategy
// ---------------------------------------------------------------------------

@Injectable()
class TestJwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  validate(payload: { sub: string; email: string; role?: string }) {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}

// ---------------------------------------------------------------------------
// Service stubs
// ---------------------------------------------------------------------------

const mockDashboard = {
  id: TEST_DASHBOARD_ID,
  name: 'Test Dashboard',
  org_id: TEST_ORG_ID,
  layout: [],
  created_at: new Date().toISOString(),
};

export const stubs = {
  auth: {
    validateAuth0Token: jest.fn(),
    findOrCreateUser: jest.fn(),
    generateTokenPair: jest.fn(),
    getUserWithOrgs: jest.fn().mockResolvedValue({ id: TEST_USER_ID, email: 'test@test.com' }),
    revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
    refreshAccessToken: jest.fn(),
    sendMagicLink: jest.fn().mockResolvedValue(undefined),
  },
  dashboards: {
    create: jest.fn().mockResolvedValue(mockDashboard),
    findAll: jest.fn().mockResolvedValue({
      items: [mockDashboard],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    }),
    findOne: jest.fn().mockImplementation((_orgId: string, id: string) => {
      if (id === TEST_DASHBOARD_ID) return Promise.resolve(mockDashboard);
      return Promise.reject(new NotFoundException('Dashboard not found'));
    }),
    update: jest.fn().mockResolvedValue(mockDashboard),
    remove: jest.fn().mockResolvedValue(undefined),
    createShare: jest.fn().mockResolvedValue({ shareToken: 'share-token-123' }),
    getShares: jest.fn().mockResolvedValue([]),
    revokeShare: jest.fn().mockResolvedValue(undefined),
    revokeAllShares: jest.fn().mockResolvedValue(undefined),
    exportPdf: jest.fn().mockResolvedValue(Buffer.from('PDF')),
    duplicate: jest.fn().mockResolvedValue({ ...mockDashboard, id: 'dup-id' }),
    restore: jest.fn().mockResolvedValue(mockDashboard),
    getSharedDashboard: jest.fn().mockImplementation((token: string) => {
      if (token === 'valid-share-token') return Promise.resolve(mockDashboard);
      return Promise.reject(new NotFoundException('Not found'));
    }),
  },
  widgets: {
    create: jest.fn().mockResolvedValue({ id: TEST_WIDGET_ID }),
    findByDashboard: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({ id: TEST_WIDGET_ID }),
    remove: jest.fn().mockResolvedValue(undefined),
    bulkUpdatePositions: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn().mockResolvedValue({ id: TEST_WIDGET_ID }),
  },
  ai: {
    createConversation: jest.fn().mockResolvedValue({ id: 'conv-1' }),
    listConversations: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    getConversation: jest.fn().mockResolvedValue({ id: 'conv-1', messages: [] }),
    deleteConversation: jest.fn().mockResolvedValue(undefined),
    sendMessage: jest.fn().mockResolvedValue({ answer: 'hello' }),
    getUsage: jest.fn().mockResolvedValue({ used: 0, limit: 100 }),
  },
  reports: {
    create: jest.fn().mockResolvedValue({ id: TEST_REPORT_ID }),
    list: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    findOne: jest.fn().mockResolvedValue({ id: TEST_REPORT_ID }),
    update: jest.fn().mockResolvedValue({ id: TEST_REPORT_ID }),
    remove: jest.fn().mockResolvedValue(undefined),
    generate: jest.fn().mockResolvedValue({ url: '/file.pdf' }),
    getLatestDownloadUrl: jest.fn().mockResolvedValue({ url: '/file.pdf' }),
    getGeneratedFiles: jest.fn().mockResolvedValue({ files: [] }),
    createSchedule: jest.fn().mockResolvedValue({ id: 'sched-1' }),
    removeSchedule: jest.fn().mockResolvedValue(undefined),
  },
  alerts: {
    create: jest.fn().mockResolvedValue({ id: TEST_ALERT_ID }),
    list: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    findOne: jest.fn().mockResolvedValue({ id: TEST_ALERT_ID }),
    update: jest.fn().mockResolvedValue({ id: TEST_ALERT_ID }),
    remove: jest.fn().mockResolvedValue(undefined),
    toggle: jest.fn().mockResolvedValue({ id: TEST_ALERT_ID, isActive: true }),
    test: jest.fn().mockResolvedValue({ triggered: false }),
    getTriggerHistory: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  },
  dataSources: {
    addDataSource: jest.fn().mockResolvedValue({ id: TEST_DS_ID }),
    addCsvDataSource: jest.fn().mockResolvedValue({ id: TEST_DS_ID }),
    findAll: jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    }),
    findOne: jest.fn().mockResolvedValue({ id: TEST_DS_ID }),
    getPreview: jest.fn().mockResolvedValue({ rows: [] }),
    updateSchema: jest.fn().mockResolvedValue(undefined),
    testConnection: jest.fn().mockResolvedValue(true),
    triggerSync: jest.fn().mockResolvedValue(undefined),
    getColumns: jest.fn().mockResolvedValue([]),
    updateDataSource: jest.fn().mockResolvedValue({ id: TEST_DS_ID }),
    deleteDataSource: jest.fn().mockResolvedValue(undefined),
  },
  users: {
    findById: jest.fn().mockResolvedValue({ id: TEST_USER_ID, name: 'Test User' }),
    update: jest.fn().mockResolvedValue({ id: TEST_USER_ID }),
    softDelete: jest.fn().mockResolvedValue(undefined),
    getUserOrganizations: jest.fn().mockResolvedValue([]),
  },
  organizations: {
    create: jest.fn().mockResolvedValue({ id: TEST_ORG_ID }),
    findById: jest.fn().mockResolvedValue({ id: TEST_ORG_ID }),
    update: jest.fn().mockResolvedValue({ id: TEST_ORG_ID }),
    softDelete: jest.fn().mockResolvedValue(undefined),
  },
  billing: {
    getCurrentSubscription: jest.fn().mockResolvedValue({
      plan: 'pro',
      status: 'active',
      current_period_end: '2026-04-01',
    }),
    getUsage: jest.fn().mockResolvedValue({ dashboards: 3, data_sources: 2 }),
    getPlans: jest.fn().mockResolvedValue([
      { id: 'plan-free', name: 'Free' },
      { id: 'plan-pro', name: 'Pro' },
    ]),
    createCheckoutSession: jest.fn().mockResolvedValue('https://checkout.stripe.com/session'),
    changePlan: jest.fn().mockResolvedValue({ plan: 'enterprise' }),
    cancelSubscription: jest.fn().mockResolvedValue({ status: 'canceled' }),
    getInvoices: jest.fn().mockResolvedValue([]),
    createPortalSession: jest.fn().mockResolvedValue('https://billing.stripe.com/portal'),
    checkPlanLimit: jest.fn().mockResolvedValue(null),
  },
  teams: {
    listMembers: jest.fn().mockResolvedValue([]),
    getPendingInvites: jest.fn().mockResolvedValue([]),
    invite: jest.fn().mockResolvedValue({ id: 'invite-1', status: 'pending' }),
    changeRole: jest.fn().mockResolvedValue({ role: 'editor' }),
    removeMember: jest.fn().mockResolvedValue(undefined),
    resendInvite: jest.fn().mockResolvedValue({ id: 'invite-1', status: 'pending' }),
    revokeInvite: jest.fn().mockResolvedValue({ message: 'Invite revoked' }),
    acceptInviteByToken: jest.fn().mockResolvedValue({ orgId: TEST_ORG_ID }),
  },
  notifications: {
    findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    markRead: jest.fn().mockResolvedValue({ id: 'notif-1', read: true }),
    markAllRead: jest.fn().mockResolvedValue({ updated: 5 }),
    remove: jest.fn().mockResolvedValue(undefined),
    getUnreadCount: jest.fn().mockResolvedValue({ count: 0 }),
  },
  settings: {
    getUserPreferences: jest
      .fn()
      .mockResolvedValue({ language: 'en', notifications_enabled: true }),
    updateUserPreferences: jest.fn().mockResolvedValue({ language: 'ro' }),
    getOrganizationSettings: jest.fn().mockResolvedValue({ name: 'Test Org' }),
    updateOrganizationSettings: jest.fn().mockResolvedValue({ name: 'Updated Org' }),
  },
  gdpr: {
    requestDeletion: jest.fn().mockResolvedValue({ id: 'req-1', status: 'pending' }),
    requestExport: jest.fn().mockResolvedValue({ id: 'req-2', status: 'pending' }),
    getExportStatus: jest.fn().mockResolvedValue({ status: 'completed' }),
    getExportDownload: jest.fn().mockResolvedValue(Buffer.from('ZIP')),
    getDeletionStatus: jest.fn().mockResolvedValue({ status: 'pending' }),
  },
  admin: {
    findAllAuditLogs: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    findOneAuditLog: jest.fn().mockResolvedValue({ id: 'log-1', action: 'create' }),
    getOrgStats: jest.fn().mockResolvedValue({ members: 5, dashboards: 10 }),
  },
  onboarding: {
    getStatus: jest.fn().mockResolvedValue({ step: 'select-source', completed: false }),
    selectSource: jest.fn().mockResolvedValue({ step: 'connect' }),
    testAndConnect: jest.fn().mockResolvedValue({ connected: true }),
    getSyncStatus: jest.fn().mockResolvedValue({ status: 'syncing', progress: 50 }),
    completeOnboarding: jest.fn().mockResolvedValue({ completed: true }),
    loadDemoData: jest.fn().mockResolvedValue({ status: 'loading' }),
  },
  overview: {
    getOverview: jest.fn().mockResolvedValue({
      kpis: { totalRevenue: 100000 },
      activity: [],
    }),
  },
};

// ---------------------------------------------------------------------------
// TeamMember mock repository factory
// ---------------------------------------------------------------------------

/**
 * Creates a team member repo mock that returns the specified role for any query.
 * The RolesGuard and OrgMemberGuard query TeamMember to determine access.
 */
export function createTeamMemberRepo(role: string = 'owner') {
  return {
    findOne: jest.fn().mockResolvedValue({
      user_id: TEST_USER_ID,
      org_id: TEST_ORG_ID,
      role,
    }),
  };
}

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

export interface TestApp {
  app: INestApplication;
  jwtService: JwtService;
  ownerToken: string;
  adminToken: string;
  editorToken: string;
  viewerToken: string;
  /** Token for a user in a different org */
  otherOrgToken: string;
  stubs: typeof stubs;
  teamMemberRepo: ReturnType<typeof createTeamMemberRepo>;
}

export async function createTestApp(role: string = 'owner'): Promise<TestApp> {
  const teamMemberRepo = createTeamMemberRepo(role);

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [
      PassportModule.register({ defaultStrategy: 'jwt' }),
      JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
    ],
    controllers: [
      HealthController,
      AuthController,
      DashboardsController,
      SharedDashboardController,
      WidgetsController,
      AiController,
      ReportsController,
      AlertsController,
      DataSourcesController,
      UsersController,
      OrganizationsController,
      BillingController,
      TeamsController,
      InviteAcceptController,
      NotificationsController,
      SettingsController,
      GdprController,
      AdminController,
      OnboardingController,
      OverviewController,
    ],
    providers: [
      {
        provide: DataSource,
        useValue: { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) },
      },
      {
        provide: CACHE_MANAGER,
        useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
      },
      {
        provide: ClickHouseService,
        useValue: { healthCheck: jest.fn().mockResolvedValue({ ok: true }) },
      },
      { provide: AuthService, useValue: stubs.auth },
      { provide: DashboardsService, useValue: stubs.dashboards },
      { provide: WidgetsService, useValue: stubs.widgets },
      { provide: AiService, useValue: stubs.ai },
      { provide: ReportsService, useValue: stubs.reports },
      { provide: AlertsService, useValue: stubs.alerts },
      { provide: DataSourcesService, useValue: stubs.dataSources },
      { provide: UsersService, useValue: stubs.users },
      { provide: OrganizationsService, useValue: stubs.organizations },
      { provide: BillingService, useValue: stubs.billing },
      { provide: 'BILLING_SERVICE', useValue: stubs.billing },
      { provide: TeamsService, useValue: stubs.teams },
      { provide: NotificationsService, useValue: stubs.notifications },
      { provide: SettingsService, useValue: stubs.settings },
      { provide: GdprService, useValue: stubs.gdpr },
      { provide: AdminService, useValue: stubs.admin },
      { provide: OnboardingService, useValue: stubs.onboarding },
      { provide: OverviewService, useValue: stubs.overview },
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((key: string) => {
            if (key === 'NEXT_PUBLIC_APP_URL') return 'http://localhost:3000';
            return undefined;
          }),
        },
      },
      {
        provide: getRepositoryToken(SyncJob),
        useValue: { findAndCount: jest.fn().mockResolvedValue([[], 0]) },
      },
      { provide: getRepositoryToken(TeamMember), useValue: teamMemberRepo },
      TestJwtStrategy,
      JwtAuthGuard,
      OrgMemberGuard,
      RolesGuard,
      PlanLimitGuard,
      Reflector,
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  const jwtService = moduleRef.get<JwtService>(JwtService);
  const ownerToken = jwtService.sign({
    sub: TEST_USER_ID,
    id: TEST_USER_ID,
    email: 'owner@test.com',
    role: 'owner',
  });
  const adminToken = jwtService.sign({
    sub: TEST_USER_ID,
    id: TEST_USER_ID,
    email: 'admin@test.com',
    role: 'admin',
  });
  const editorToken = jwtService.sign({
    sub: TEST_USER_ID,
    id: TEST_USER_ID,
    email: 'editor@test.com',
    role: 'editor',
  });
  const viewerToken = jwtService.sign({
    sub: TEST_USER_ID,
    id: TEST_USER_ID,
    email: 'viewer@test.com',
    role: 'viewer',
  });
  const otherOrgToken = jwtService.sign({
    sub: 'other-user-id',
    id: 'other-user-id',
    email: 'other@test.com',
  });

  return {
    app,
    jwtService,
    ownerToken,
    adminToken,
    editorToken,
    viewerToken,
    otherOrgToken,
    stubs,
    teamMemberRepo,
  };
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

export function authGet(app: INestApplication, url: string, token: string) {
  return request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${token}`);
}

export function authPost(app: INestApplication, url: string, token: string) {
  return request(app.getHttpServer()).post(url).set('Authorization', `Bearer ${token}`);
}

export function authPatch(app: INestApplication, url: string, token: string) {
  return request(app.getHttpServer()).patch(url).set('Authorization', `Bearer ${token}`);
}

export function authDelete(app: INestApplication, url: string, token: string) {
  return request(app.getHttpServer()).delete(url).set('Authorization', `Bearer ${token}`);
}

export function unauthGet(app: INestApplication, url: string) {
  return request(app.getHttpServer()).get(url);
}

export function unauthPost(app: INestApplication, url: string) {
  return request(app.getHttpServer()).post(url);
}

export { request };
