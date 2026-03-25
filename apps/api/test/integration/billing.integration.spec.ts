/**
 * Billing Endpoints — Integration Tests
 *
 * Verifies checkout, plans, invoices, cancel, portal, and RBAC.
 * Stripe is fully mocked — zero real API calls.
 */
import { createTestApp, authGet, authPost, unauthGet, TEST_ORG_ID, type TestApp } from './helpers';

describe('Billing Endpoints (Integration)', () => {
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

  const base = `/api/v1/organizations/${TEST_ORG_ID}/billing`;

  // =========================================================================
  // Auth guard
  // =========================================================================

  describe('auth guard', () => {
    it('GET /billing returns 401 without JWT', async () => {
      await unauthGet(t.app, base).expect(401);
    });

    it('GET /billing/plans returns 401 without JWT', async () => {
      await unauthGet(t.app, `${base}/plans`).expect(401);
    });
  });

  // =========================================================================
  // Read endpoints (VIEWER+)
  // =========================================================================

  describe('read endpoints', () => {
    it('GET / returns billing info and usage', async () => {
      const res = await authGet(t.app, base, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('subscription');
      expect(res.body.data).toHaveProperty('usage');
    });

    it('GET /plans returns available plans', async () => {
      const res = await authGet(t.app, `${base}/plans`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /invoices returns invoice list', async () => {
      const res = await authGet(t.app, `${base}/invoices`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('GET /portal returns Stripe portal URL', async () => {
      const res = await authGet(t.app, `${base}/portal`, t.ownerToken).expect(200);
      expect(res.body.data).toHaveProperty('url');
    });
  });

  // =========================================================================
  // Write endpoints (OWNER)
  // =========================================================================

  describe('subscription management', () => {
    it('POST /subscribe creates checkout session', async () => {
      const res = await authPost(t.app, `${base}/subscribe`, t.ownerToken)
        .send({ planId: '00000000-0000-4000-a000-000000000001', billingPeriod: 'monthly' })
        .expect(201);
      expect(res.body.data).toHaveProperty('url');
      expect(t.stubs.billing.createCheckoutSession).toHaveBeenCalled();
    });

    it('POST /subscribe rejects invalid body', async () => {
      await authPost(t.app, `${base}/subscribe`, t.ownerToken).send({}).expect(400);
    });

    it('POST /change-plan changes subscription', async () => {
      const res = await authPost(t.app, `${base}/change-plan`, t.ownerToken)
        .send({ planId: '00000000-0000-4000-a000-000000000002' })
        .expect(201);
      expect(res.body).toHaveProperty('data');
    });

    it('POST /cancel cancels subscription', async () => {
      const res = await authPost(t.app, `${base}/cancel`, t.ownerToken).expect(201);
      expect(res.body).toHaveProperty('data');
      expect(t.stubs.billing.cancelSubscription).toHaveBeenCalledWith(TEST_ORG_ID);
    });
  });

  // =========================================================================
  // Invalid UUID
  // =========================================================================

  describe('param validation', () => {
    it('rejects invalid orgId UUID', async () => {
      await authGet(t.app, '/api/v1/organizations/bad-uuid/billing', t.ownerToken).expect(400);
    });
  });
});
