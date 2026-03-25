/**
 * Health Check — Integration Tests
 *
 * Verifies health endpoint returns service status without auth.
 */
import { createTestApp, unauthGet, type TestApp } from './helpers';

describe('Health Endpoint (Integration)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('GET /health returns 200 without auth', async () => {
    const res = await unauthGet(t.app, '/api/v1/health').expect(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('status', 'ok');
  });

  it('GET /health includes timestamp', async () => {
    const res = await unauthGet(t.app, '/api/v1/health').expect(200);
    expect(res.body.data).toHaveProperty('timestamp');
  });

  it('GET /health includes services status', async () => {
    const res = await unauthGet(t.app, '/api/v1/health').expect(200);
    expect(res.body.data).toHaveProperty('services');
    expect(res.body.data.services).toHaveProperty('redis');
    expect(res.body.data.services).toHaveProperty('postgres');
    expect(res.body.data.services).toHaveProperty('clickhouse');
  });
});
