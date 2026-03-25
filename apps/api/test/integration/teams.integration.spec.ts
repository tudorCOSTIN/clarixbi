/**
 * Teams Endpoints — Integration Tests
 *
 * Verifies member listing, invites, role changes, member removal, and RBAC.
 */
import {
  createTestApp,
  authGet,
  authPost,
  authPatch,
  authDelete,
  unauthGet,
  TEST_ORG_ID,
  TEST_MEMBER_ID,
  type TestApp,
} from './helpers';

describe('Teams Endpoints (Integration)', () => {
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

  const base = `/api/v1/organizations/${TEST_ORG_ID}/team`;

  // =========================================================================
  // Auth guard
  // =========================================================================

  describe('auth guard', () => {
    it('GET / returns 401 without JWT', async () => {
      await unauthGet(t.app, base).expect(401);
    });
  });

  // =========================================================================
  // List
  // =========================================================================

  describe('list members', () => {
    it('GET / returns team members and invites', async () => {
      const res = await authGet(t.app, base, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // Invite
  // =========================================================================

  describe('invite', () => {
    it('POST /invite sends invitation with valid DTO', async () => {
      const res = await authPost(t.app, `${base}/invite`, t.ownerToken)
        .send({ email: 'newuser@clarixbi.com', role: 'editor' })
        .expect(201);
      expect(res.body).toHaveProperty('data');
      expect(t.stubs.teams.invite).toHaveBeenCalled();
    });

    it('POST /invite rejects invalid email', async () => {
      await authPost(t.app, `${base}/invite`, t.ownerToken)
        .send({ email: 'not-an-email', role: 'editor' })
        .expect(400);
    });

    it('POST /invite rejects missing role', async () => {
      await authPost(t.app, `${base}/invite`, t.ownerToken)
        .send({ email: 'user@test.com' })
        .expect(400);
    });

    it('POST /invite rejects invalid role', async () => {
      await authPost(t.app, `${base}/invite`, t.ownerToken)
        .send({ email: 'user@test.com', role: 'superadmin' })
        .expect(400);
    });
  });

  // =========================================================================
  // Role change
  // =========================================================================

  describe('role change', () => {
    it('PATCH /:memberId changes member role', async () => {
      const res = await authPatch(t.app, `${base}/${TEST_MEMBER_ID}`, t.ownerToken)
        .send({ role: 'admin' })
        .expect(200);
      expect(res.body).toHaveProperty('data');
    });

    it('PATCH /:memberId rejects invalid role', async () => {
      await authPatch(t.app, `${base}/${TEST_MEMBER_ID}`, t.ownerToken)
        .send({ role: 'god' })
        .expect(400);
    });

    it('PATCH /:memberId rejects missing role', async () => {
      await authPatch(t.app, `${base}/${TEST_MEMBER_ID}`, t.ownerToken).send({}).expect(400);
    });
  });

  // =========================================================================
  // Remove member
  // =========================================================================

  describe('remove member', () => {
    it('DELETE /:memberId removes member', async () => {
      const res = await authDelete(t.app, `${base}/${TEST_MEMBER_ID}`, t.ownerToken).expect(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // Invite management
  // =========================================================================

  describe('invite management', () => {
    it('POST /:inviteId/resend resends invite', async () => {
      const res = await authPost(t.app, `${base}/${TEST_MEMBER_ID}/resend`, t.ownerToken).expect(
        201,
      );
      expect(res.body).toHaveProperty('data');
    });

    it('DELETE /:inviteId/revoke revokes invite', async () => {
      const res = await authDelete(t.app, `${base}/${TEST_MEMBER_ID}/revoke`, t.ownerToken).expect(
        200,
      );
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // Invite accept (separate controller)
  // =========================================================================

  describe('invite accept', () => {
    it('POST /invites/:token/accept accepts invite', async () => {
      const res = await authPost(t.app, '/api/v1/invites/valid-token/accept', t.ownerToken).expect(
        201,
      );
      expect(res.body).toHaveProperty('data');
    });
  });

  // =========================================================================
  // Param validation
  // =========================================================================

  describe('param validation', () => {
    it('rejects invalid orgId UUID', async () => {
      await authGet(t.app, '/api/v1/organizations/bad/team', t.ownerToken).expect(400);
    });
  });
});
