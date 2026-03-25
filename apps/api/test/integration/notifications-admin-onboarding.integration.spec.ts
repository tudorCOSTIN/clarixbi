/**
 * Notifications, Admin, Onboarding, Overview — Integration Tests
 *
 * Verifies notification management, audit logs, onboarding flow, and overview.
 */
import {
  createTestApp,
  authGet,
  authPost,
  authPatch,
  authDelete,
  unauthGet,
  TEST_ORG_ID,
  TEST_NOTIF_ID,
  type TestApp,
} from './helpers';

describe('Notifications, Admin, Onboarding, Overview (Integration)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Notifications
  // =========================================================================

  describe('Notifications — /organizations/:orgId/notifications', () => {
    const base = `/api/v1/organizations/${TEST_ORG_ID}/notifications`;

    it('GET / returns 401 without JWT', async () => {
      await unauthGet(t.app, base).expect(401);
    });

    it('GET / returns notification list', async () => {
      const res = await authGet(t.app, base, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('GET /unread-count returns count', async () => {
      const res = await authGet(t.app, `${base}/unread-count`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('count');
    });

    it('PATCH /:id/read marks notification as read', async () => {
      const res = await authPatch(t.app, `${base}/${TEST_NOTIF_ID}/read`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('POST /mark-all-read marks all as read', async () => {
      await authPost(t.app, `${base}/mark-all-read`, t.ownerToken).expect(201);
      expect(t.stubs.notifications.markAllRead).toHaveBeenCalled();
    });

    it('DELETE /:id removes notification', async () => {
      const res = await authDelete(t.app, `${base}/${TEST_NOTIF_ID}`, t.ownerToken).expect(200);
      expect(res.body.data).toHaveProperty('message');
    });

    it('rejects invalid notification UUID', async () => {
      await authPatch(t.app, `${base}/bad-id/read`, t.ownerToken).expect(400);
    });
  });

  // =========================================================================
  // Admin
  // =========================================================================

  describe('Admin — /organizations/:orgId/admin', () => {
    const base = `/api/v1/organizations/${TEST_ORG_ID}/admin`;

    it('GET /audit-logs returns 401 without JWT', async () => {
      await unauthGet(t.app, `${base}/audit-logs`).expect(401);
    });

    it('GET /audit-logs returns audit log list', async () => {
      const res = await authGet(t.app, `${base}/audit-logs`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('GET /audit-logs/:id returns single audit log', async () => {
      const auditId = '00000000-0000-4000-a000-000000000001';
      const res = await authGet(t.app, `${base}/audit-logs/${auditId}`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('GET /stats returns org stats', async () => {
      const res = await authGet(t.app, `${base}/stats`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('rejects invalid orgId', async () => {
      await authGet(t.app, '/api/v1/organizations/bad/admin/stats', t.ownerToken).expect(400);
    });
  });

  // =========================================================================
  // Onboarding
  // =========================================================================

  describe('Onboarding — /organizations/:orgId/onboarding', () => {
    const base = `/api/v1/organizations/${TEST_ORG_ID}/onboarding`;

    it('GET /status returns 401 without JWT', async () => {
      await unauthGet(t.app, `${base}/status`).expect(401);
    });

    it('GET /status returns onboarding status', async () => {
      const res = await authGet(t.app, `${base}/status`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('POST /select-source selects data source type', async () => {
      const res = await authPost(t.app, `${base}/select-source`, t.ownerToken)
        .send({ sourceType: 'smartbill' })
        .expect(201);
      expect(res.body).toHaveProperty('data');
    });

    it('POST /select-source rejects empty body', async () => {
      await authPost(t.app, `${base}/select-source`, t.ownerToken).send({}).expect(400);
    });

    it('POST /connect tests and connects', async () => {
      const res = await authPost(t.app, `${base}/connect`, t.ownerToken)
        .send({ sourceType: 'smartbill', credentials: { apiKey: 'test' } })
        .expect(201);
      expect(res.body).toHaveProperty('data');
    });

    it('GET /sync-status returns sync status', async () => {
      const res = await authGet(t.app, `${base}/sync-status`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('POST /complete marks onboarding as complete', async () => {
      const res = await authPost(t.app, `${base}/complete`, t.ownerToken).expect(201);
      expect(res.body).toHaveProperty('data');
    });

    it('POST /demo-data loads demo data', async () => {
      const res = await authPost(t.app, `${base}/demo-data`, t.ownerToken).send({}).expect(201);
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // Overview
  // =========================================================================

  describe('Overview — /organizations/:orgId/overview', () => {
    it('GET / returns 401 without JWT', async () => {
      await unauthGet(t.app, `/api/v1/organizations/${TEST_ORG_ID}/overview`).expect(401);
    });

    it('GET / returns overview data', async () => {
      const res = await authGet(
        t.app,
        `/api/v1/organizations/${TEST_ORG_ID}/overview`,
        t.ownerToken,
      ).expect(200);
      expect(res.body).toHaveProperty('data');
    });
  });
});
