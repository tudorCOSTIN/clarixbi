/**
 * GDPR Endpoints — Integration Tests
 *
 * Verifies data export, deletion requests, and status checks.
 */
import { createTestApp, authGet, authPost, unauthGet, unauthPost, type TestApp } from './helpers';

describe('GDPR Endpoints (Integration)', () => {
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

  const base = '/api/v1/users/me/gdpr';

  // =========================================================================
  // Auth guard
  // =========================================================================

  describe('auth guard', () => {
    it('POST /delete returns 401 without JWT', async () => {
      await unauthPost(t.app, `${base}/delete`).expect(401);
    });

    it('POST /export returns 401 without JWT', async () => {
      await unauthPost(t.app, `${base}/export`).expect(401);
    });

    it('GET /delete/status returns 401 without JWT', async () => {
      await unauthGet(t.app, `${base}/delete/status`).expect(401);
    });
  });

  // =========================================================================
  // Deletion request
  // =========================================================================

  describe('deletion request', () => {
    it('POST /delete creates deletion request', async () => {
      const res = await authPost(t.app, `${base}/delete`, t.ownerToken).expect(201);
      expect(res.body).toHaveProperty('status');
      expect(t.stubs.gdpr.requestDeletion).toHaveBeenCalled();
    });

    it('GET /delete/status returns deletion status', async () => {
      const res = await authGet(t.app, `${base}/delete/status`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('status');
    });
  });

  // =========================================================================
  // Export request
  // =========================================================================

  describe('export request', () => {
    it('POST /export creates export request', async () => {
      const res = await authPost(t.app, `${base}/export`, t.ownerToken).expect(201);
      expect(res.body).toHaveProperty('status');
      expect(t.stubs.gdpr.requestExport).toHaveBeenCalled();
    });

    it('GET /export/:requestId/status returns export status', async () => {
      const requestId = '00000000-0000-4000-a000-000000000001';
      const res = await authGet(t.app, `${base}/export/${requestId}/status`, t.ownerToken).expect(
        200,
      );
      expect(res.body).toHaveProperty('status');
    });

    it('GET /export/:requestId/status rejects invalid UUID', async () => {
      await authGet(t.app, `${base}/export/bad-uuid/status`, t.ownerToken).expect(400);
    });
  });
});
