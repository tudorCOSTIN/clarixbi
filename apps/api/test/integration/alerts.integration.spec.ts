/**
 * Alerts Endpoints — Integration Tests
 *
 * Verifies CRUD, toggle, test, trigger history, and input validation.
 */
import {
  createTestApp,
  authGet,
  authPost,
  authPatch,
  authDelete,
  unauthGet,
  TEST_ORG_ID,
  TEST_ALERT_ID,
  TEST_DS_ID,
  type TestApp,
} from './helpers';

describe('Alerts Endpoints (Integration)', () => {
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

  const base = `/api/v1/organizations/${TEST_ORG_ID}/alerts`;

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
    it('GET / returns alert list', async () => {
      const res = await authGet(t.app, base, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('POST / creates alert with valid DTO', async () => {
      const res = await authPost(t.app, base, t.ownerToken)
        .send({
          name: 'High Error Rate',
          dataSourceId: TEST_DS_ID,
          metricQuery: 'SELECT count(*) FROM errors',
          conditionOperator: 'gt',
          thresholdValue: 100,
          checkFrequency: 'hourly',
        })
        .expect(201);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
    });

    it('POST / rejects empty body', async () => {
      await authPost(t.app, base, t.ownerToken).send({}).expect(400);
    });

    it('POST / rejects invalid conditionOperator', async () => {
      await authPost(t.app, base, t.ownerToken)
        .send({
          name: 'Test',
          dataSourceId: TEST_DS_ID,
          metricQuery: 'SELECT 1',
          conditionOperator: 'invalid_op',
          thresholdValue: 100,
          checkFrequency: 'hourly',
        })
        .expect(400);
    });

    it('GET /:id returns single alert', async () => {
      const res = await authGet(t.app, `${base}/${TEST_ALERT_ID}`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('PATCH /:id updates alert', async () => {
      const res = await authPatch(t.app, `${base}/${TEST_ALERT_ID}`, t.ownerToken)
        .send({ name: 'Updated Alert' })
        .expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('DELETE /:id removes alert', async () => {
      const res = await authDelete(t.app, `${base}/${TEST_ALERT_ID}`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // Toggle & test
  // =========================================================================

  describe('toggle and test', () => {
    it('PATCH /:id/toggle toggles alert active state', async () => {
      const res = await authPatch(t.app, `${base}/${TEST_ALERT_ID}/toggle`, t.ownerToken)
        .send({ isActive: true })
        .expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('PATCH /:id/toggle rejects missing isActive', async () => {
      await authPatch(t.app, `${base}/${TEST_ALERT_ID}/toggle`, t.ownerToken).send({}).expect(400);
    });

    it('POST /:id/test triggers test evaluation', async () => {
      const res = await authPost(t.app, `${base}/${TEST_ALERT_ID}/test`, t.ownerToken).expect(201);
      expect(res.body).toHaveProperty('data');
    });

    it('GET /:id/triggers returns trigger history', async () => {
      const res = await authGet(t.app, `${base}/${TEST_ALERT_ID}/triggers`, t.ownerToken).expect(
        200,
      );
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // Param validation
  // =========================================================================

  describe('param validation', () => {
    it('rejects invalid alert UUID', async () => {
      await authGet(t.app, `${base}/not-a-uuid`, t.ownerToken).expect(400);
    });
  });
});
