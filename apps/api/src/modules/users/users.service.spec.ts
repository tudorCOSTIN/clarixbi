/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User, PreferredLanguage } from './entities/user.entity';
import { TeamMember, TeamRole } from '../teams/entities/team-member.entity';

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: any;
  let teamMemberRepo: any;

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

  describe('findById', () => {
    it('should return a user by id', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      const result = await service.findById('user-uuid-1');
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('should return user by email', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      const result = await service.findByEmail('test@example.com');
      expect(result).toEqual(mockUser);
    });

    it('should return null when email not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const result = await service.findByEmail('unknown@example.com');
      expect(result).toBeNull();
    });
  });

  describe('findByAuth0Id', () => {
    it('should return user by auth0_id', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      const result = await service.findByAuth0Id('auth0|123');
      expect(result).toEqual(mockUser);
    });
  });

  describe('update', () => {
    it('should update user fields', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser });
      userRepo.save.mockResolvedValue({ ...mockUser, name: 'Updated Name' });

      const result = await service.update('user-uuid-1', { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });
  });

  describe('softDelete', () => {
    it('should deactivate and soft delete user', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser });
      userRepo.save.mockResolvedValue({ ...mockUser, is_active: false });
      userRepo.softDelete.mockResolvedValue({ affected: 1 });

      await service.softDelete('user-uuid-1');
      expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }));
      expect(userRepo.softDelete).toHaveBeenCalledWith('user-uuid-1');
    });
  });

  describe('getUserOrganizations', () => {
    it('should return organizations with roles', async () => {
      teamMemberRepo.find.mockResolvedValue([
        {
          role: TeamRole.OWNER,
          organization: {
            id: 'org-1',
            name: 'Test Org',
            slug: 'test-org',
            logo_url: null,
          },
        },
      ]);

      const result = await service.getUserOrganizations('user-uuid-1');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
        logo_url: null,
        role: TeamRole.OWNER,
      });
    });
  });
});
