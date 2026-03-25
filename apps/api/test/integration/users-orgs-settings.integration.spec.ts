/**
 * Users, Organizations, Settings — Integration Tests
 *
 * Verifies user profile, org management, and settings endpoints.
 */
import {
  createTestApp,
  authGet,
  authPost,
  authPatch,
  authDelete,
  unauthGet,
  unauthPost,
  TEST_ORG_ID,
  type TestApp,
} from './helpers';

describe('Users, Organizations, Settings (Integration)', () => {
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
  // Users
  // =========================================================================

  describe('Users — /api/v1/users/me', () => {
    it('GET /me returns 401 without JWT', async () => {
      await unauthGet(t.app, '/api/v1/users/me').expect(401);
    });

    it('GET /me returns user profile', async () => {
      const res = await authGet(t.app, '/api/v1/users/me', t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('PATCH /me updates user profile', async () => {
      const res = await authPatch(t.app, '/api/v1/users/me', t.ownerToken)
        .send({ name: 'New Name' })
        .expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('PATCH /me rejects extra fields', async () => {
      await authPatch(t.app, '/api/v1/users/me', t.ownerToken)
        .send({ name: 'Test', admin: true })
        .expect(400);
    });

    it('DELETE /me soft-deletes user', async () => {
      const res = await authDelete(t.app, '/api/v1/users/me', t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('GET /me/organizations returns org list', async () => {
      const res = await authGet(t.app, '/api/v1/users/me/organizations', t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // Organizations
  // =========================================================================

  describe('Organizations — /api/v1/organizations', () => {
    it('POST / returns 401 without JWT', async () => {
      await unauthPost(t.app, '/api/v1/organizations').expect(401);
    });

    it('POST / creates organization', async () => {
      const res = await authPost(t.app, '/api/v1/organizations', t.ownerToken)
        .send({ name: 'Acme Corp' })
        .expect(201);
      expect(res.body).toHaveProperty('data');
    });

    it('POST / rejects empty name', async () => {
      await authPost(t.app, '/api/v1/organizations', t.ownerToken).send({}).expect(400);
    });

    it('GET /:orgId returns org details', async () => {
      const res = await authGet(t.app, `/api/v1/organizations/${TEST_ORG_ID}`, t.ownerToken).expect(
        200,
      );
      expect(res.body).toHaveProperty('data');
    });

    it('PATCH /:orgId updates organization', async () => {
      const res = await authPatch(t.app, `/api/v1/organizations/${TEST_ORG_ID}`, t.ownerToken)
        .send({ name: 'New Org Name' })
        .expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('DELETE /:orgId soft-deletes organization', async () => {
      const res = await authDelete(
        t.app,
        `/api/v1/organizations/${TEST_ORG_ID}`,
        t.ownerToken,
      ).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('rejects invalid UUID', async () => {
      await authGet(t.app, '/api/v1/organizations/not-valid', t.ownerToken).expect(400);
    });
  });

  // =========================================================================
  // Settings
  // =========================================================================

  describe('Settings — /api/v1/settings', () => {
    it('GET /preferences returns 401 without JWT', async () => {
      await unauthGet(t.app, '/api/v1/settings/preferences').expect(401);
    });

    it('GET /preferences returns user preferences', async () => {
      const res = await authGet(t.app, '/api/v1/settings/preferences', t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('PATCH /preferences updates preferences', async () => {
      const res = await authPatch(t.app, '/api/v1/settings/preferences', t.ownerToken)
        .send({ language: 'ro' })
        .expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('GET /organizations/:orgId returns org settings', async () => {
      const res = await authGet(
        t.app,
        `/api/v1/settings/organizations/${TEST_ORG_ID}`,
        t.ownerToken,
      ).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('PATCH /organizations/:orgId updates org settings', async () => {
      const res = await authPatch(
        t.app,
        `/api/v1/settings/organizations/${TEST_ORG_ID}`,
        t.ownerToken,
      )
        .send({ name: 'Updated Org' })
        .expect(200);
      expect(res.body).toHaveProperty('data');
    });
  });
});
