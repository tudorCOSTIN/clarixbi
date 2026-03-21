import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TeamsService } from './teams.service';
import { TeamMember, TeamRole, InviteStatus } from './entities/team-member.entity';
import { EmailService } from '../email/email.service';

type MockRepository<T extends Record<string, any> = any> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockRepository = (): MockRepository<TeamMember> => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
  softRemove: jest.fn(),
});

describe('TeamsService', () => {
  let service: TeamsService;
  let repo: MockRepository<TeamMember>;

  const orgId = 'org-uuid-1';
  const userId = 'user-uuid-1';
  const memberId = 'member-uuid-1';
  const email = 'invite@example.com';

  beforeEach(async () => {
    repo = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        {
          provide: getRepositoryToken(TeamMember),
          useValue: repo,
        },
        {
          provide: EmailService,
          useValue: {
            sendTeamInvite: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
  });

  // ---------------------------------------------------------------------------
  // invite
  // ---------------------------------------------------------------------------
  describe('invite', () => {
    it('should create a pending team member with invite token', async () => {
      repo.findOne!.mockResolvedValue(null);

      const created: Partial<TeamMember> = {
        id: memberId,
        org_id: orgId,
        user_id: userId,
        role: TeamRole.EDITOR,
        invite_email: email,
        invite_status: InviteStatus.PENDING,
        invite_token: expect.any(String),
        invite_expires_at: expect.any(Date),
        invited_by: userId,
      };
      repo.create!.mockReturnValue(created);
      repo.save!.mockResolvedValue(created);

      const result = await service.invite(orgId, userId, email, TeamRole.EDITOR);

      expect(repo.findOne).toHaveBeenCalled();
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          org_id: orgId,
          invite_email: email,
          invite_status: InviteStatus.PENDING,
          role: TeamRole.EDITOR,
          invited_by: userId,
        }),
      );
      expect(repo.save).toHaveBeenCalledWith(created);
      expect(result).toEqual(created);
    });

    it('should throw ConflictException if email already has a pending invite', async () => {
      repo.findOne!.mockResolvedValue({
        id: 'existing',
        invite_status: InviteStatus.PENDING,
      } as TeamMember);

      await expect(service.invite(orgId, userId, email, TeamRole.VIEWER)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if email is already an accepted member', async () => {
      repo.findOne!.mockResolvedValue({
        id: 'existing',
        invite_status: InviteStatus.ACCEPTED,
      } as TeamMember);

      await expect(service.invite(orgId, userId, email, TeamRole.VIEWER)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // acceptInvite
  // ---------------------------------------------------------------------------
  describe('acceptInvite', () => {
    it('should link user and set status to ACCEPTED', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);

      const invite: Partial<TeamMember> = {
        id: memberId,
        org_id: orgId,
        invite_status: InviteStatus.PENDING,
        invite_expires_at: futureDate,
      };
      repo.findOne!.mockResolvedValue(invite);
      repo.save!.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.acceptInvite(memberId, userId);

      expect(result.user_id).toBe(userId);
      expect(result.invite_status).toBe(InviteStatus.ACCEPTED);
      expect(result.joined_at).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException if invite not found', async () => {
      repo.findOne!.mockResolvedValue(null);

      await expect(service.acceptInvite('bad-id', userId)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if invite has expired (>7 days)', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const invite: Partial<TeamMember> = {
        id: memberId,
        org_id: orgId,
        invite_status: InviteStatus.PENDING,
        invite_expires_at: pastDate,
      };
      repo.findOne!.mockResolvedValue(invite);
      repo.save!.mockImplementation((entity) => Promise.resolve(entity));

      await expect(service.acceptInvite(memberId, userId)).rejects.toThrow(BadRequestException);

      // Should also have persisted the EXPIRED status
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ invite_status: InviteStatus.EXPIRED }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // changeRole
  // ---------------------------------------------------------------------------
  describe('changeRole', () => {
    it('should update the role successfully', async () => {
      const member: Partial<TeamMember> = {
        id: memberId,
        org_id: orgId,
        role: TeamRole.EDITOR,
      };
      repo.findOne!.mockResolvedValue(member);
      repo.save!.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.changeRole(orgId, memberId, TeamRole.ADMIN);

      expect(result.role).toBe(TeamRole.ADMIN);
    });

    it('should throw NotFoundException if member not found', async () => {
      repo.findOne!.mockResolvedValue(null);

      await expect(service.changeRole(orgId, 'bad-id', TeamRole.VIEWER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if demoting the last OWNER', async () => {
      const member: Partial<TeamMember> = {
        id: memberId,
        org_id: orgId,
        role: TeamRole.OWNER,
      };
      repo.findOne!.mockResolvedValue(member);
      repo.count!.mockResolvedValue(1);

      await expect(service.changeRole(orgId, memberId, TeamRole.ADMIN)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow demoting an OWNER when another OWNER exists', async () => {
      const member: Partial<TeamMember> = {
        id: memberId,
        org_id: orgId,
        role: TeamRole.OWNER,
      };
      repo.findOne!.mockResolvedValue(member);
      repo.count!.mockResolvedValue(2);
      repo.save!.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.changeRole(orgId, memberId, TeamRole.EDITOR);

      expect(result.role).toBe(TeamRole.EDITOR);
    });
  });

  // ---------------------------------------------------------------------------
  // removeMember
  // ---------------------------------------------------------------------------
  describe('removeMember', () => {
    it('should soft-remove the member', async () => {
      const member: Partial<TeamMember> = {
        id: memberId,
        org_id: orgId,
        role: TeamRole.EDITOR,
      };
      repo.findOne!.mockResolvedValue(member);
      repo.softRemove!.mockResolvedValue(member);

      await service.removeMember(orgId, memberId);

      expect(repo.softRemove).toHaveBeenCalledWith(member);
    });

    it('should throw NotFoundException if member not found', async () => {
      repo.findOne!.mockResolvedValue(null);

      await expect(service.removeMember(orgId, 'bad-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if removing the last OWNER', async () => {
      const member: Partial<TeamMember> = {
        id: memberId,
        org_id: orgId,
        role: TeamRole.OWNER,
      };
      repo.findOne!.mockResolvedValue(member);
      repo.count!.mockResolvedValue(1);

      await expect(service.removeMember(orgId, memberId)).rejects.toThrow(BadRequestException);
    });

    it('should allow removing an OWNER when another OWNER exists', async () => {
      const member: Partial<TeamMember> = {
        id: memberId,
        org_id: orgId,
        role: TeamRole.OWNER,
      };
      repo.findOne!.mockResolvedValue(member);
      repo.count!.mockResolvedValue(2);
      repo.softRemove!.mockResolvedValue(member);

      await service.removeMember(orgId, memberId);

      expect(repo.softRemove).toHaveBeenCalledWith(member);
    });
  });

  // ---------------------------------------------------------------------------
  // listMembers
  // ---------------------------------------------------------------------------
  describe('listMembers', () => {
    it('should return active and pending members', async () => {
      const members: Partial<TeamMember>[] = [
        { id: '1', invite_status: InviteStatus.ACCEPTED },
        { id: '2', invite_status: InviteStatus.PENDING },
      ];
      repo.find!.mockResolvedValue(members);

      const result = await service.listMembers(orgId);

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ org_id: orgId }),
          relations: ['user'],
          order: { created_at: 'ASC' },
        }),
      );
      expect(result).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // getPendingInvites
  // ---------------------------------------------------------------------------
  describe('getPendingInvites', () => {
    it('should return only pending invites', async () => {
      const pending: Partial<TeamMember>[] = [{ id: '1', invite_status: InviteStatus.PENDING }];
      repo.find!.mockResolvedValue(pending);

      const result = await service.getPendingInvites(orgId);

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            org_id: orgId,
            invite_status: InviteStatus.PENDING,
          },
          order: { created_at: 'DESC' },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0]!.invite_status).toBe(InviteStatus.PENDING);
    });
  });
});
