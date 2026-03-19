/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { TeamMember, TeamRole } from '../teams/entities/team-member.entity';

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
  }));
});

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: any;
  let orgRepo: any;
  let teamMemberRepo: any;
  let jwtService: any;

  const mockUser: Partial<User> = {
    id: 'user-uuid-1',
    auth0_id: 'auth0|123',
    email: 'test@example.com',
    name: 'Test User',
    avatar_url: null,
    is_active: true,
  };

  const mockOrg: Partial<Organization> = {
    id: 'org-uuid-1',
    name: 'Test User Workspace',
    slug: 'test-user-abc123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                'auth.auth0Domain': 'test.auth0.com',
                'auth.auth0ClientId': 'client-id',
                'auth.auth0ClientSecret': 'client-secret',
                'auth.auth0CallbackUrl': 'http://localhost:3000/api/auth/callback',
                'auth.auth0Audience': 'https://api.clarixbi.com',
                'auth.jwtSecret': 'test-secret',
                'auth.jwtExpiresIn': '1h',
                'auth.refreshTokenExpiresIn': 2592000,
                'auth.redisUrl': 'redis://localhost:6379',
              };
              return config[key];
            }),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Organization),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TeamMember),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepo = module.get(getRepositoryToken(User));
    orgRepo = module.get(getRepositoryToken(Organization));
    teamMemberRepo = module.get(getRepositoryToken(TeamMember));
    jwtService = module.get(JwtService);
  });

  describe('findOrCreateUser', () => {
    it('should return existing user when found by auth0_id', async () => {
      userRepo.findOne.mockResolvedValueOnce(mockUser);

      const result = await service.findOrCreateUser({
        sub: 'auth0|123',
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result.user).toEqual(mockUser);
      expect(result.isNew).toBe(false);
      expect(orgRepo.create).not.toHaveBeenCalled();
    });

    it('should create new user, org, and team member when user does not exist', async () => {
      userRepo.findOne.mockResolvedValueOnce(null); // not found by auth0_id
      userRepo.findOne.mockResolvedValueOnce(null); // not found by email
      userRepo.create.mockReturnValue(mockUser);
      userRepo.save.mockResolvedValue(mockUser);
      orgRepo.create.mockReturnValue(mockOrg);
      orgRepo.save.mockResolvedValue(mockOrg);
      teamMemberRepo.create.mockReturnValue({});
      teamMemberRepo.save.mockResolvedValue({});

      const result = await service.findOrCreateUser({
        sub: 'auth0|123',
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result.user).toEqual(mockUser);
      expect(result.isNew).toBe(true);
      expect(userRepo.create).toHaveBeenCalled();
      expect(orgRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Test User Workspace' }),
      );
      expect(teamMemberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: TeamRole.OWNER }),
      );
    });

    it('should link existing user found by email to auth0_id', async () => {
      const existingUser = { ...mockUser, auth0_id: '' };
      userRepo.findOne.mockResolvedValueOnce(null); // not found by auth0_id
      userRepo.findOne.mockResolvedValueOnce(existingUser); // found by email
      userRepo.save.mockResolvedValue({ ...existingUser, auth0_id: 'auth0|123' });

      const result = await service.findOrCreateUser({
        sub: 'auth0|123',
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result.isNew).toBe(false);
      expect(userRepo.save).toHaveBeenCalled();
    });
  });

  describe('generateTokenPair', () => {
    it('should return access_token and refresh_token', async () => {
      const result = await service.generateTokenPair(mockUser as User);

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.refresh_token).toBeDefined();
      expect(result.refresh_token.length).toBeGreaterThan(0);
      expect(result.expires_in).toBe(3600);
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          email: mockUser.email,
        }),
      );
    });
  });

  describe('refreshAccessToken', () => {
    it('should throw when refresh token not found', async () => {
      await expect(service.refreshAccessToken('invalid-token')).rejects.toThrow(
        'Invalid refresh token',
      );
    });
  });
});
