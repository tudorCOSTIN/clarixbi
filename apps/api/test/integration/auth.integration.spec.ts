/**
 * Auth Endpoints — Integration Tests
 *
 * Verifies auth flow: callback, me, refresh, logout, guard enforcement.
 * All external services (Auth0, Redis) are mocked.
 */
import {
  createTestApp,
  authGet,
  authPost,
  unauthGet,
  unauthPost,
  TEST_ORG_ID,
  type TestApp,
} from './helpers';

describe('Auth Endpoints (Integration)', () => {
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
  // Unauthenticated access
  // =========================================================================

  describe('unauthenticated access', () => {
    it('GET /auth/me without token returns 401', async () => {
      await unauthGet(t.app, '/api/v1/auth/me').expect(401);
    });

    it('POST /auth/logout without token returns 401', async () => {
      await unauthPost(t.app, '/api/v1/auth/logout').expect(401);
    });
  });

  // =========================================================================
  // Callback
  // =========================================================================

  describe('POST /auth/callback', () => {
    it('rejects empty body with 400', async () => {
      await unauthPost(t.app, '/api/v1/auth/callback').send({}).expect(400);
    });

    it('rejects missing code field with 400', async () => {
      await unauthPost(t.app, '/api/v1/auth/callback').send({ invalid: 'field' }).expect(400);
    });
  });

  // =========================================================================
  // Authenticated endpoints
  // =========================================================================

  describe('GET /auth/me', () => {
    it('returns user with valid JWT', async () => {
      const res = await authGet(t.app, '/api/v1/auth/me', t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
      expect(t.stubs.auth.getUserWithOrgs).toHaveBeenCalled();
    });

    it('returns 401 with expired/invalid token', async () => {
      await unauthGet(t.app, '/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-jwt-token')
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('succeeds with valid JWT', async () => {
      await authPost(t.app, '/api/v1/auth/logout', t.ownerToken).expect(201);
      expect(t.stubs.auth.revokeRefreshToken).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Guard verification on protected endpoints
  // =========================================================================

  describe('guard enforcement', () => {
    const protectedEndpoints = [
      { method: 'get', url: `/api/v1/organizations/${TEST_ORG_ID}/dashboards` },
      { method: 'get', url: `/api/v1/organizations/${TEST_ORG_ID}/alerts` },
      { method: 'get', url: `/api/v1/organizations/${TEST_ORG_ID}/reports` },
      { method: 'get', url: `/api/v1/organizations/${TEST_ORG_ID}/data-sources` },
      { method: 'get', url: `/api/v1/organizations/${TEST_ORG_ID}/billing` },
      { method: 'get', url: `/api/v1/organizations/${TEST_ORG_ID}/team` },
      { method: 'get', url: `/api/v1/organizations/${TEST_ORG_ID}/notifications` },
      { method: 'get', url: '/api/v1/users/me' },
      { method: 'get', url: '/api/v1/settings/preferences' },
    ];

    it.each(protectedEndpoints)('$method $url returns 401 without JWT', async ({ method, url }) => {
      const req = method === 'get' ? unauthGet(t.app, url) : unauthPost(t.app, url);
      await req.expect(401);
    });

    it.each(protectedEndpoints)(
      '$method $url returns 200 with valid JWT',
      async ({ method, url }) => {
        const req =
          method === 'get' ? authGet(t.app, url, t.ownerToken) : authPost(t.app, url, t.ownerToken);
        const res = await req;
        expect(res.status).toBeLessThan(500);
        expect([200, 201]).toContain(res.status);
      },
    );
  });
});
