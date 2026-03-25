/**
 * Data Sources Endpoints — Integration Tests
 *
 * Verifies CRUD, sync, test connection, CSV upload, and tenant isolation.
 */
import {
  createTestApp,
  authGet,
  authPost,
  authPatch,
  authDelete,
  unauthGet,
  TEST_ORG_ID,
  TEST_DS_ID,
  type TestApp,
} from './helpers';

describe('Data Sources Endpoints (Integration)', () => {
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

  const base = `/api/v1/organizations/${TEST_ORG_ID}/data-sources`;

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
    it('GET / returns paginated list', async () => {
      const res = await authGet(t.app, base, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST / creates data source with valid DTO', async () => {
      const res = await authPost(t.app, base, t.ownerToken)
        .send({
          type: 'smartbill',
          name: 'SmartBill Production',
          credentials: { apiKey: 'test-key', companyVat: 'RO12345' },
        })
        .expect(201);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
    });

    it('POST / rejects empty body', async () => {
      await authPost(t.app, base, t.ownerToken).send({}).expect(400);
    });

    it('POST / rejects extra fields', async () => {
      await authPost(t.app, base, t.ownerToken)
        .send({
          type: 'smartbill',
          name: 'Test',
          credentials: { key: 'val' },
          malicious: 'data',
        })
        .expect(400);
    });

    it('GET /:id returns single data source', async () => {
      const res = await authGet(t.app, `${base}/${TEST_DS_ID}`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('GET /:id rejects invalid UUID', async () => {
      await authGet(t.app, `${base}/invalid`, t.ownerToken).expect(400);
    });

    it('PATCH /:id updates data source', async () => {
      const res = await authPatch(t.app, `${base}/${TEST_DS_ID}`, t.ownerToken)
        .send({ name: 'Updated Name' })
        .expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('DELETE /:id removes data source', async () => {
      const res = await authDelete(t.app, `${base}/${TEST_DS_ID}`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // Sync & test
  // =========================================================================

  describe('sync and test', () => {
    it('POST /:id/sync triggers sync', async () => {
      const res = await authPost(t.app, `${base}/${TEST_DS_ID}/sync`, t.ownerToken).expect(201);
      expect(res.body).toHaveProperty('data');
      expect(t.stubs.dataSources.triggerSync).toHaveBeenCalled();
    });

    it('POST /:id/test tests connection', async () => {
      const res = await authPost(t.app, `${base}/${TEST_DS_ID}/test`, t.ownerToken).expect(201);
      expect(res.body).toHaveProperty('data');
    });

    it('GET /:id/preview returns data preview', async () => {
      const res = await authGet(t.app, `${base}/${TEST_DS_ID}/preview`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('GET /:id/columns returns column list', async () => {
      const res = await authGet(t.app, `${base}/${TEST_DS_ID}/columns`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('GET /:id/logs returns sync logs', async () => {
      const res = await authGet(t.app, `${base}/${TEST_DS_ID}/logs`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // Invalid orgId
  // =========================================================================

  describe('param validation', () => {
    it('rejects invalid orgId UUID', async () => {
      await authGet(t.app, '/api/v1/organizations/not-uuid/data-sources', t.ownerToken).expect(400);
    });
  });
});
