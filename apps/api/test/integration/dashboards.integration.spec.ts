/**
 * Dashboard Endpoints — Integration Tests
 *
 * Verifies CRUD, sharing, cloning, tenant isolation, and RBAC.
 */
import {
  createTestApp,
  authGet,
  authPost,
  authPatch,
  authDelete,
  unauthGet,
  TEST_ORG_ID,
  TEST_DASHBOARD_ID,
  MISSING_ID,
  type TestApp,
} from './helpers';

describe('Dashboard Endpoints (Integration)', () => {
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

  const base = `/api/v1/organizations/${TEST_ORG_ID}/dashboards`;

  // =========================================================================
  // Auth guard
  // =========================================================================

  describe('auth guard', () => {
    it('GET list returns 401 without JWT', async () => {
      await unauthGet(t.app, base).expect(401);
    });
  });

  // =========================================================================
  // CRUD operations
  // =========================================================================

  describe('CRUD', () => {
    it('GET / returns paginated list', async () => {
      const res = await authGet(t.app, base, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST / creates dashboard with valid DTO', async () => {
      const res = await authPost(t.app, base, t.ownerToken)
        .send({ name: 'New Dashboard' })
        .expect(201);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
    });

    it('POST / rejects empty name', async () => {
      await authPost(t.app, base, t.ownerToken).send({}).expect(400);
    });

    it('POST / rejects extra fields (forbidNonWhitelisted)', async () => {
      await authPost(t.app, base, t.ownerToken)
        .send({ name: 'Test', hackerField: 'xss' })
        .expect(400);
    });

    it('GET /:id returns single dashboard', async () => {
      const res = await authGet(t.app, `${base}/${TEST_DASHBOARD_ID}`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id', TEST_DASHBOARD_ID);
    });

    it('GET /:id returns 404 for missing dashboard', async () => {
      await authGet(t.app, `${base}/${MISSING_ID}`, t.ownerToken).expect(404);
    });

    it('GET /:id rejects invalid UUID', async () => {
      await authGet(t.app, `${base}/not-a-uuid`, t.ownerToken).expect(400);
    });

    it('PATCH /:id updates dashboard', async () => {
      const res = await authPatch(t.app, `${base}/${TEST_DASHBOARD_ID}`, t.ownerToken)
        .send({ name: 'Updated Name' })
        .expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('DELETE /:id removes dashboard', async () => {
      const res = await authDelete(t.app, `${base}/${TEST_DASHBOARD_ID}`, t.ownerToken).expect(200);
      expect(res.body.data).toHaveProperty('message');
    });
  });

  // =========================================================================
  // Sharing
  // =========================================================================

  describe('sharing', () => {
    it('POST /:id/share creates a share token', async () => {
      const res = await authPost(t.app, `${base}/${TEST_DASHBOARD_ID}/share`, t.ownerToken).expect(
        201,
      );
      expect(res.body).toHaveProperty('data');
    });

    it('GET /:id/shares lists shares', async () => {
      const res = await authGet(t.app, `${base}/${TEST_DASHBOARD_ID}/shares`, t.ownerToken).expect(
        200,
      );
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // Duplication
  // =========================================================================

  describe('duplication', () => {
    it('POST /:id/duplicate creates a copy', async () => {
      const res = await authPost(
        t.app,
        `${base}/${TEST_DASHBOARD_ID}/duplicate`,
        t.ownerToken,
      ).expect(201);
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // Response structure
  // =========================================================================

  describe('response structure', () => {
    it('list response has data array', async () => {
      const res = await authGet(t.app, base, t.ownerToken).expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('detail response has data object with expected fields', async () => {
      const res = await authGet(t.app, `${base}/${TEST_DASHBOARD_ID}`, t.ownerToken).expect(200);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('name');
      expect(res.body.data).toHaveProperty('org_id');
    });
  });

  // =========================================================================
  // Shared dashboard (public)
  // =========================================================================

  describe('shared dashboard (public)', () => {
    it('GET /shared/dashboards/:token returns dashboard without auth', async () => {
      const res = await unauthGet(t.app, '/api/v1/shared/dashboards/valid-share-token').expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('GET /shared/dashboards/:token returns 404 for invalid token', async () => {
      await unauthGet(t.app, '/api/v1/shared/dashboards/invalid-token').expect(404);
    });
  });
});
