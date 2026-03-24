import { TeamsController } from './teams.controller';
import { InviteAcceptController } from './invite-accept.controller';
import { TeamsService } from './teams.service';
import { TeamRole, InviteStatus } from './entities/team-member.entity';

describe('TeamsController', () => {
  let controller: TeamsController;
  let teamsService: Record<string, jest.Mock>;

  const orgId = 'org-uuid-1';
  const mockUser = { id: 'user-1', email: 'test@test.com', auth0_id: 'auth0|123' };

  const mockMember = {
    id: 'member-1',
    user_id: 'user-1',
    org_id: orgId,
    role: TeamRole.EDITOR,
    invite_status: InviteStatus.ACCEPTED,
    joined_at: new Date(),
    user: { id: 'user-1', name: 'Test User', email: 'test@test.com' },
  };

  const mockInvite = {
    id: 'invite-1',
    org_id: orgId,
    role: TeamRole.VIEWER,
    invite_email: 'new@test.com',
    invite_status: InviteStatus.PENDING,
    invite_token: 'token-123',
    invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };

  beforeEach(() => {
    teamsService = {
      listMembers: jest.fn().mockResolvedValue([mockMember]),
      getPendingInvites: jest.fn().mockResolvedValue([mockInvite]),
      invite: jest.fn().mockResolvedValue(mockInvite),
      changeRole: jest.fn().mockResolvedValue({ ...mockMember, role: TeamRole.ADMIN }),
      removeMember: jest.fn().mockResolvedValue(undefined),
      resendInvite: jest.fn().mockResolvedValue(mockInvite),
      revokeInvite: jest.fn().mockResolvedValue(undefined),
      acceptInviteByToken: jest
        .fn()
        .mockResolvedValue({ ...mockInvite, invite_status: InviteStatus.ACCEPTED }),
    };

    controller = new TeamsController(teamsService as unknown as TeamsService);
  });

  describe('listMembers', () => {
    it('should return members and pending invites', async () => {
      const result = await controller.listMembers(orgId);
      expect(result.data.members).toHaveLength(1);
      expect(result.data.pendingInvites).toHaveLength(1);
    });
  });

  describe('invite', () => {
    it('should create a pending invite', async () => {
      const result = await controller.invite(orgId, mockUser, {
        email: 'new@test.com',
        role: TeamRole.VIEWER,
      });
      expect(teamsService['invite']).toHaveBeenCalledWith(
        orgId,
        mockUser.id,
        'new@test.com',
        TeamRole.VIEWER,
      );
      expect(result.data.invite_status).toBe(InviteStatus.PENDING);
    });
  });

  describe('changeRole', () => {
    it('should update role', async () => {
      const result = await controller.changeRole(orgId, 'member-1', { role: TeamRole.ADMIN });
      expect(result.data.role).toBe(TeamRole.ADMIN);
    });
  });

  describe('removeMember', () => {
    it('should remove member', async () => {
      const result = await controller.removeMember(orgId, 'member-1');
      expect(result.data.message).toBe('Member removed');
      expect(teamsService['removeMember']).toHaveBeenCalledWith(orgId, 'member-1');
    });
  });

  describe('resendInvite', () => {
    it('should resend invite', async () => {
      const result = await controller.resendInvite(orgId, 'invite-1');
      expect(result.data).toBeDefined();
      expect(teamsService['resendInvite']).toHaveBeenCalledWith(orgId, 'invite-1');
    });
  });

  describe('revokeInvite', () => {
    it('should revoke invite', async () => {
      const result = await controller.revokeInvite(orgId, 'invite-1');
      expect(result.data.message).toBe('Invite revoked');
    });
  });
});

describe('InviteAcceptController', () => {
  let controller: InviteAcceptController;
  let teamsService: Record<string, jest.Mock>;

  beforeEach(() => {
    teamsService = {
      acceptInviteByToken: jest.fn().mockResolvedValue({
        id: 'member-1',
        invite_status: InviteStatus.ACCEPTED,
        joined_at: new Date(),
      }),
    };

    controller = new InviteAcceptController(teamsService as unknown as TeamsService);
  });

  it('should accept invite by token', async () => {
    const result = await controller.acceptInvite('token-123', {
      id: 'user-2',
      email: 'new@test.com',
      auth0_id: 'auth0|456',
    });
    expect(result.data.invite_status).toBe(InviteStatus.ACCEPTED);
    expect(teamsService['acceptInviteByToken']).toHaveBeenCalledWith('token-123', 'user-2');
  });
});
