/**
 * AI Endpoints — Integration Tests
 *
 * Verifies conversation CRUD, messaging, usage, and input validation.
 * Claude API is fully mocked.
 */
import {
  createTestApp,
  authGet,
  authPost,
  authDelete,
  unauthGet,
  TEST_ORG_ID,
  type TestApp,
} from './helpers';

describe('AI Endpoints (Integration)', () => {
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

  const base = `/api/v1/organizations/${TEST_ORG_ID}/ai`;

  // =========================================================================
  // Auth guard
  // =========================================================================

  describe('auth guard', () => {
    it('GET /conversations returns 401 without JWT', async () => {
      await unauthGet(t.app, `${base}/conversations`).expect(401);
    });
  });

  // =========================================================================
  // Conversations
  // =========================================================================

  describe('conversations', () => {
    it('POST /conversations creates a conversation', async () => {
      const res = await authPost(t.app, `${base}/conversations`, t.ownerToken).expect(201);
      expect(res.body).toHaveProperty('data');
    });

    it('GET /conversations lists conversations', async () => {
      const res = await authGet(t.app, `${base}/conversations`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('GET /conversations/:id returns single conversation', async () => {
      const convId = '00000000-0000-4000-a000-000000000001';
      const res = await authGet(t.app, `${base}/conversations/${convId}`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('DELETE /conversations/:id deletes conversation', async () => {
      const convId = '00000000-0000-4000-a000-000000000001';
      const res = await authDelete(t.app, `${base}/conversations/${convId}`, t.ownerToken).expect(
        200,
      );
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // Messaging
  // =========================================================================

  describe('messaging', () => {
    it('POST /conversations/:id/messages sends a message', async () => {
      const convId = '00000000-0000-4000-a000-000000000001';
      const res = await authPost(t.app, `${base}/conversations/${convId}/messages`, t.ownerToken)
        .send({ content: 'What are my top revenue sources?' })
        .expect(201);
      expect(res.body).toHaveProperty('data');
    });

    it('POST /conversations/:id/messages rejects empty content', async () => {
      const convId = '00000000-0000-4000-a000-000000000001';
      await authPost(t.app, `${base}/conversations/${convId}/messages`, t.ownerToken)
        .send({})
        .expect(400);
    });

    it('POST /conversations/:id/messages rejects extra fields', async () => {
      const convId = '00000000-0000-4000-a000-000000000001';
      await authPost(t.app, `${base}/conversations/${convId}/messages`, t.ownerToken)
        .send({ content: 'test', role: 'system' })
        .expect(400);
    });
  });

  // =========================================================================
  // Usage
  // =========================================================================

  describe('usage', () => {
    it('GET /usage returns usage data', async () => {
      const res = await authGet(t.app, `${base}/usage`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('used');
      expect(res.body.data).toHaveProperty('limit');
    });
  });

  // =========================================================================
  // Param validation
  // =========================================================================

  describe('param validation', () => {
    it('rejects invalid conversation UUID', async () => {
      await authGet(t.app, `${base}/conversations/invalid`, t.ownerToken).expect(400);
    });
  });
});
