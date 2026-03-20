import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User, PreferredLanguage } from './entities/user.entity';
import { TeamMember, TeamRole } from '../teams/entities/team-member.entity';

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: Record<string, jest.Mock>;
  let teamMemberRepo: Record<string, jest.Mock>;

  const mockUser: Partial<User> = {
    id: 'user-uuid-1',
    auth0_id: 'auth0|123',
    email: 'test@example.com',
    name: 'Test User',
    avatar_url: null,
    preferred_language: PreferredLanguage.RO,
    preferred_timezone: 'Europe/Bucharest',
    is_active: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TeamMember),
          useValue: {
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepo = module.get(getRepositoryToken(User));
    teamMemberRepo = module.get(getRepositoryToken(TeamMember));
  });

  // ---------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------
  describe('findById', () => {
    it('should return a user when found', async () => {
      userRepo.findOne!.mockResolvedValue(mockUser);

      const result = await service.findById('user-uuid-1');

      expect(result).toEqual(mockUser);
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: 'user-uuid-1' } });
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.findById('nonexistent')).rejects.toThrow('User not found');
    });
  });

  // ---------------------------------------------------------------
  // findByEmail
  // ---------------------------------------------------------------
  describe('findByEmail', () => {
    it('should return a user when found by email', async () => {
      userRepo.findOne!.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
    });

    it('should return null when user not found by email', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      const result = await service.findByEmail('unknown@example.com');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // findByAuth0Id
  // ---------------------------------------------------------------
  describe('findByAuth0Id', () => {
    it('should return a user when found by auth0_id', async () => {
      userRepo.findOne!.mockResolvedValue(mockUser);

      const result = await service.findByAuth0Id('auth0|123');

      expect(result).toEqual(mockUser);
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { auth0_id: 'auth0|123' } });
    });

    it('should return null when user not found by auth0_id', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      const result = await service.findByAuth0Id('auth0|nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // update
  // ---------------------------------------------------------------
  describe('update', () => {
    it('should update and return the user on success', async () => {
      const existingUser = { ...mockUser };
      userRepo.findOne!.mockResolvedValue(existingUser);
      userRepo.save!.mockResolvedValue({ ...existingUser, name: 'Updated Name' });

      const result = await service.update('user-uuid-1', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated Name' }));
    });

    it('should merge multiple dto fields onto the user', async () => {
      const existingUser = { ...mockUser };
      userRepo.findOne!.mockResolvedValue(existingUser);
      userRepo.save!.mockImplementation((u) => Promise.resolve(u));

      const dto = {
        name: 'New Name',
        preferred_language: PreferredLanguage.EN,
        preferred_timezone: 'UTC',
      };

      const result = await service.update('user-uuid-1', dto);

      expect(result.name).toBe('New Name');
      expect(result.preferred_language).toBe(PreferredLanguage.EN);
      expect(result.preferred_timezone).toBe('UTC');
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(NotFoundException);
      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow('User not found');
    });
  });

  // ---------------------------------------------------------------
  // softDelete
  // ---------------------------------------------------------------
  describe('softDelete', () => {
    it('should set is_active to false, save, and call softDelete', async () => {
      const user = { ...mockUser, is_active: true };
      userRepo.findOne!.mockResolvedValue(user);
      userRepo.save!.mockResolvedValue({ ...user, is_active: false });
      userRepo.softDelete!.mockResolvedValue({ affected: 1 });

      await service.softDelete('user-uuid-1');

      expect(user.is_active).toBe(false);
      expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }));
      expect(userRepo.softDelete).toHaveBeenCalledWith('user-uuid-1');
    });

    it('should call save before softDelete', async () => {
      const callOrder: string[] = [];
      const user = { ...mockUser };
      userRepo.findOne!.mockResolvedValue(user);
      userRepo.save!.mockImplementation(() => {
        callOrder.push('save');
        return Promise.resolve(user);
      });
      userRepo.softDelete!.mockImplementation(() => {
        callOrder.push('softDelete');
        return Promise.resolve({ affected: 1 });
      });

      await service.softDelete('user-uuid-1');

      expect(callOrder).toEqual(['save', 'softDelete']);
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      await expect(service.softDelete('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.softDelete('nonexistent')).rejects.toThrow('User not found');
    });
  });

  // ---------------------------------------------------------------
  // getUserOrganizations
  // ---------------------------------------------------------------
  describe('getUserOrganizations', () => {
    it('should return mapped organization memberships with roles', async () => {
      const memberships = [
        {
          role: TeamRole.OWNER,
          organization: { id: 'org-1', name: 'Org One', slug: 'org-one', logo_url: null },
        },
        {
          role: TeamRole.VIEWER,
          organization: {
            id: 'org-2',
            name: 'Org Two',
            slug: 'org-two',
            logo_url: 'https://logo.png',
          },
        },
      ];
      teamMemberRepo.find!.mockResolvedValue(memberships);

      const result = await service.getUserOrganizations('user-uuid-1');

      expect(result).toEqual([
        { id: 'org-1', name: 'Org One', slug: 'org-one', logo_url: null, role: TeamRole.OWNER },
        {
          id: 'org-2',
          name: 'Org Two',
          slug: 'org-two',
          logo_url: 'https://logo.png',
          role: TeamRole.VIEWER,
        },
      ]);
      expect(teamMemberRepo.find).toHaveBeenCalledWith({
        where: { user_id: 'user-uuid-1' },
        relations: ['organization'],
      });
    });

    it('should return empty array when no memberships exist', async () => {
      teamMemberRepo.find!.mockResolvedValue([]);

      const result = await service.getUserOrganizations('user-uuid-1');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should query with the correct user_id and relations', async () => {
      teamMemberRepo.find!.mockResolvedValue([]);

      await service.getUserOrganizations('specific-user-id');

      expect(teamMemberRepo.find).toHaveBeenCalledWith({
        where: { user_id: 'specific-user-id' },
        relations: ['organization'],
      });
    });
  });
});
