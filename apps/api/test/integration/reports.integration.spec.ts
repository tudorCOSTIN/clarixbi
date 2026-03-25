/**
 * Reports Endpoints — Integration Tests
 *
 * Verifies CRUD, generation, download, scheduling, and input validation.
 */
import {
  createTestApp,
  authGet,
  authPost,
  authPatch,
  authDelete,
  unauthGet,
  TEST_ORG_ID,
  TEST_REPORT_ID,
  TEST_DASHBOARD_ID,
  type TestApp,
} from './helpers';

describe('Reports Endpoints (Integration)', () => {
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

  const base = `/api/v1/organizations/${TEST_ORG_ID}/reports`;

  // =========================================================================
  // Auth guard
  // =========================================================================

  describe('auth guard', () => {
    it('GET / returns 401 without JWT', async () => {
      await unauthGet(t.app, base).expect(401);
    });
  });

  // =========================================================================
  // CRUD
  // =========================================================================

  describe('CRUD', () => {
    it('GET / returns report list', async () => {
      const res = await authGet(t.app, base, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('POST / creates report with valid DTO', async () => {
      const res = await authPost(t.app, base, t.ownerToken)
        .send({
          name: 'Monthly Revenue',
          dashboardId: TEST_DASHBOARD_ID,
          widgetIds: [TEST_DASHBOARD_ID],
        })
        .expect(201);
      expect(res.body).toHaveProperty('data');
    });

    it('POST / rejects empty body', async () => {
      await authPost(t.app, base, t.ownerToken).send({}).expect(400);
    });

    it('POST / rejects missing widgetIds', async () => {
      await authPost(t.app, base, t.ownerToken)
        .send({ name: 'Test', dashboardId: TEST_DASHBOARD_ID })
        .expect(400);
    });

    it('POST / rejects empty widgetIds array', async () => {
      await authPost(t.app, base, t.ownerToken)
        .send({ name: 'Test', dashboardId: TEST_DASHBOARD_ID, widgetIds: [] })
        .expect(400);
    });

    it('GET /:id returns single report', async () => {
      const res = await authGet(t.app, `${base}/${TEST_REPORT_ID}`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('PATCH /:id updates report', async () => {
      const res = await authPatch(t.app, `${base}/${TEST_REPORT_ID}`, t.ownerToken)
        .send({ name: 'Updated Report' })
        .expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('DELETE /:id removes report', async () => {
      const res = await authDelete(t.app, `${base}/${TEST_REPORT_ID}`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // Generation & download
  // =========================================================================

  describe('generation and download', () => {
    it('POST /:id/generate triggers report generation', async () => {
      const res = await authPost(t.app, `${base}/${TEST_REPORT_ID}/generate`, t.ownerToken).expect(
        201,
      );
      expect(res.body).toHaveProperty('data');
      expect(t.stubs.reports.generate).toHaveBeenCalled();
    });

    it('GET /:id/download returns download URL', async () => {
      const res = await authGet(t.app, `${base}/${TEST_REPORT_ID}/download`, t.ownerToken).expect(
        200,
      );
      expect(res.body).toHaveProperty('data');
    });

    it('GET /:id/history returns generated files', async () => {
      const res = await authGet(t.app, `${base}/${TEST_REPORT_ID}/history`, t.ownerToken).expect(
        200,
      );
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // Scheduling
  // =========================================================================

  describe('scheduling', () => {
    it('POST /:id/schedule creates a schedule', async () => {
      const res = await authPost(t.app, `${base}/${TEST_REPORT_ID}/schedule`, t.ownerToken)
        .send({
          frequency: 'weekly',
          recipients: ['user@clarixbi.com'],
        })
        .expect(201);
      expect(res.body).toHaveProperty('data');
    });

    it('POST /:id/schedule rejects invalid frequency', async () => {
      await authPost(t.app, `${base}/${TEST_REPORT_ID}/schedule`, t.ownerToken)
        .send({
          frequency: 'every_second',
          recipients: ['user@test.com'],
        })
        .expect(400);
    });

    it('POST /:id/schedule rejects empty recipients', async () => {
      await authPost(t.app, `${base}/${TEST_REPORT_ID}/schedule`, t.ownerToken)
        .send({
          frequency: 'daily',
          recipients: [],
        })
        .expect(400);
    });

    it('POST /:id/schedule rejects invalid email', async () => {
      await authPost(t.app, `${base}/${TEST_REPORT_ID}/schedule`, t.ownerToken)
        .send({
          frequency: 'daily',
          recipients: ['not-an-email'],
        })
        .expect(400);
    });

    it('DELETE /:id/schedule removes schedule', async () => {
      const res = await authDelete(
        t.app,
        `${base}/${TEST_REPORT_ID}/schedule`,
        t.ownerToken,
      ).expect(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // Param validation
  // =========================================================================

  describe('param validation', () => {
    it('rejects invalid report UUID', async () => {
      await authGet(t.app, `${base}/invalid`, t.ownerToken).expect(400);
    });
  });
});
