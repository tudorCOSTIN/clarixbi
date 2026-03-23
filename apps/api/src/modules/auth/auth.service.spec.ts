import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { TeamMember, TeamRole } from '../teams/entities/team-member.entity';
import { BillingService } from '../billing/billing.service';

// Mock ioredis — factory returns a constructor that yields our mock instance
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  keys: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: Record<string, jest.Mock>;
  let orgRepo: Record<string, jest.Mock>;
  let teamMemberRepo: Record<string, jest.Mock>;
  let jwtService: { sign: jest.Mock };

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

  const mockAuth0Profile = {
    sub: 'auth0|123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/avatar.jpg',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string | number> = {
                'auth.redisUrl': 'redis://localhost:6379',
                'auth.auth0Domain': 'test.auth0.com',
                'auth.auth0ClientId': 'client-id',
                'auth.auth0ClientSecret': 'client-secret',
                'auth.auth0CallbackUrl': 'http://localhost:3000/callback',
                'auth.refreshTokenExpiresIn': 2592000,
              };
              return config[key];
            }),
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('mock-access-token') },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn(), create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(Organization),
          useValue: { findOne: jest.fn(), create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(TeamMember),
          useValue: { find: jest.fn(), create: jest.fn(), save: jest.fn() },
        },
        {
          provide: BillingService,
          useValue: { autoEnrollTrial: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepo = module.get(getRepositoryToken(User));
    orgRepo = module.get(getRepositoryToken(Organization));
    teamMemberRepo = module.get(getRepositoryToken(TeamMember));
    jwtService = module.get(JwtService);

    // Reset all mocks between tests
    jest.clearAllMocks();
    mockFetch.mockReset();
    mockRedis.get.mockReset();
    mockRedis.set.mockReset();
    mockRedis.keys.mockReset();
    mockRedis.del.mockReset();
    mockRedis.expire.mockReset();
  });

  // ---------------------------------------------------------------
  // findOrCreateUser
  // ---------------------------------------------------------------
  describe('findOrCreateUser', () => {
    it('should return existing user when found by auth0_id', async () => {
      userRepo.findOne!.mockResolvedValueOnce(mockUser);

      const result = await service.findOrCreateUser(mockAuth0Profile);

      expect(result).toEqual({ user: mockUser, isNew: false });
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { auth0_id: mockAuth0Profile.sub },
      });
      expect(userRepo.findOne).toHaveBeenCalledTimes(1);
      expect(orgRepo.create).not.toHaveBeenCalled();
    });

    it('should link auth0_id and update avatar when user found by email', async () => {
      const existingUser = { ...mockUser, auth0_id: null as unknown as string, avatar_url: null };
      userRepo
        .findOne!.mockResolvedValueOnce(null) // not found by auth0_id
        .mockResolvedValueOnce(existingUser); // found by email
      userRepo.save!.mockResolvedValue({
        ...existingUser,
        auth0_id: mockAuth0Profile.sub,
        avatar_url: mockAuth0Profile.picture,
      });

      const result = await service.findOrCreateUser(mockAuth0Profile);

      expect(result.isNew).toBe(false);
      expect(existingUser.auth0_id).toBe(mockAuth0Profile.sub);
      expect(existingUser.avatar_url).toBe(mockAuth0Profile.picture);
      expect(userRepo.save).toHaveBeenCalledWith(existingUser);
    });

    it('should not overwrite avatar when profile picture is absent', async () => {
      const existingUser = {
        ...mockUser,
        auth0_id: null as unknown as string,
        avatar_url: 'existing.jpg',
      };
      const profileNoPicture = { sub: 'auth0|456', email: 'test@example.com', name: 'Test' };
      userRepo.findOne!.mockResolvedValueOnce(null).mockResolvedValueOnce(existingUser);
      userRepo.save!.mockResolvedValue(existingUser);

      await service.findOrCreateUser(profileNoPicture);

      expect(existingUser.avatar_url).toBe('existing.jpg');
    });

    it('should create new user with default org and owner membership', async () => {
      userRepo
        .findOne!.mockResolvedValueOnce(null) // not by auth0_id
        .mockResolvedValueOnce(null); // not by email
      const newUser = { ...mockUser, id: 'new-user-uuid' };
      userRepo.create!.mockReturnValue(newUser);
      userRepo.save!.mockResolvedValue(newUser);

      const savedOrg = { ...mockOrg, id: 'new-org-uuid' };
      orgRepo.create!.mockReturnValue(savedOrg);
      orgRepo.save!.mockResolvedValue(savedOrg);

      const membership = { user_id: newUser.id, org_id: savedOrg.id, role: TeamRole.OWNER };
      teamMemberRepo.create!.mockReturnValue(membership);
      teamMemberRepo.save!.mockResolvedValue(membership);

      const result = await service.findOrCreateUser(mockAuth0Profile);

      expect(result.isNew).toBe(true);
      expect(result.user).toEqual(newUser);
      expect(userRepo.create).toHaveBeenCalledWith({
        auth0_id: mockAuth0Profile.sub,
        email: mockAuth0Profile.email,
        name: mockAuth0Profile.name,
        avatar_url: mockAuth0Profile.picture,
      });
      expect(orgRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: `${newUser.name} Workspace` }),
      );
      expect(teamMemberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: newUser.id,
          org_id: savedOrg.id,
          role: TeamRole.OWNER,
        }),
      );
      expect(teamMemberRepo.save).toHaveBeenCalled();
    });

    it('should fall back to email prefix when profile name is empty', async () => {
      userRepo.findOne!.mockResolvedValue(null);
      const noNameProfile = { sub: 'auth0|789', email: 'john@example.com', name: '' };
      const newUser = { ...mockUser, id: 'u-x', name: 'john' };
      userRepo.create!.mockReturnValue(newUser);
      userRepo.save!.mockResolvedValue(newUser);
      orgRepo.create!.mockReturnValue(mockOrg);
      orgRepo.save!.mockResolvedValue(mockOrg);
      teamMemberRepo.create!.mockReturnValue({});
      teamMemberRepo.save!.mockResolvedValue({});

      await service.findOrCreateUser(noNameProfile);

      expect(userRepo.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'john' }));
    });

    it('should set avatar_url to null when profile picture is undefined', async () => {
      userRepo.findOne!.mockResolvedValue(null);
      const noPicProfile = { sub: 'auth0|111', email: 'x@y.com', name: 'X' };
      userRepo.create!.mockReturnValue({ ...mockUser });
      userRepo.save!.mockResolvedValue({ ...mockUser });
      orgRepo.create!.mockReturnValue(mockOrg);
      orgRepo.save!.mockResolvedValue(mockOrg);
      teamMemberRepo.create!.mockReturnValue({});
      teamMemberRepo.save!.mockResolvedValue({});

      await service.findOrCreateUser(noPicProfile);

      expect(userRepo.create).toHaveBeenCalledWith(expect.objectContaining({ avatar_url: null }));
    });
  });

  // ---------------------------------------------------------------
  // generateTokenPair
  // ---------------------------------------------------------------
  describe('generateTokenPair', () => {
    it('should return access_token, refresh_token, and expires_in', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.generateTokenPair(mockUser as User);

      expect(result).toHaveProperty('access_token', 'mock-access-token');
      expect(result.refresh_token).toBeTruthy();
      expect(result.refresh_token.length).toBeGreaterThan(0);
      expect(result.expires_in).toBe(900);
    });

    it('should sign JWT with correct payload', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.generateTokenPair(mockUser as User);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        auth0_id: mockUser.auth0_id,
      });
    });

    it('should store refresh token in Redis with correct key and expiration', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.generateTokenPair(mockUser as User);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `refresh:${mockUser.id}:${result.refresh_token}`,
        expect.stringContaining(`"userId":"${mockUser.id}"`),
        'EX',
        2592000,
      );
    });
  });

  // ---------------------------------------------------------------
  // refreshAccessToken
  // ---------------------------------------------------------------
  describe('refreshAccessToken', () => {
    it('should rotate to a new token pair for a valid refresh token', async () => {
      const oldToken = 'old-refresh-token';
      const redisKey = `refresh:${mockUser.id}:${oldToken}`;
      mockRedis.keys.mockResolvedValue([redisKey]);
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ userId: mockUser.id, createdAt: Date.now() }),
      );
      mockRedis.del.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue('OK');
      userRepo.findOne!.mockResolvedValue(mockUser);

      const result = await service.refreshAccessToken(oldToken);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result).toHaveProperty('expires_in', 900);
      expect(mockRedis.del).toHaveBeenCalledWith(redisKey);
      expect(mockRedis.set).toHaveBeenCalled(); // new token stored
    });

    it('should throw UnauthorizedException when refresh token not found in Redis', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await expect(service.refreshAccessToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshAccessToken('invalid-token')).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('should throw UnauthorizedException when Redis data is null (expired)', async () => {
      mockRedis.keys.mockResolvedValue(['refresh:uid:tok']);
      mockRedis.get.mockResolvedValue(null);

      await expect(service.refreshAccessToken('tok')).rejects.toThrow('Refresh token expired');
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      mockRedis.keys.mockResolvedValue(['refresh:uid:tok']);
      mockRedis.get.mockResolvedValue(JSON.stringify({ userId: 'uid', createdAt: Date.now() }));
      userRepo.findOne!.mockResolvedValue(null);

      await expect(service.refreshAccessToken('tok')).rejects.toThrow('User not found or inactive');
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      mockRedis.keys.mockResolvedValue(['refresh:uid:tok']);
      mockRedis.get.mockResolvedValue(JSON.stringify({ userId: 'uid', createdAt: Date.now() }));
      userRepo.findOne!.mockResolvedValue({ ...mockUser, is_active: false });

      await expect(service.refreshAccessToken('tok')).rejects.toThrow(UnauthorizedException);
    });
  });

  // ---------------------------------------------------------------
  // revokeRefreshToken
  // ---------------------------------------------------------------
  describe('revokeRefreshToken', () => {
    it('should delete all refresh tokens for user from Redis', async () => {
      const keys = ['refresh:user-uuid-1:t1', 'refresh:user-uuid-1:t2'];
      mockRedis.keys.mockResolvedValue(keys);
      mockRedis.del.mockResolvedValue(2);

      await service.revokeRefreshToken('user-uuid-1');

      expect(mockRedis.keys).toHaveBeenCalledWith('refresh:user-uuid-1:*');
      expect(mockRedis.del).toHaveBeenCalledWith(...keys);
    });

    it('should not call del when no refresh tokens exist', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await service.revokeRefreshToken('user-uuid-1');

      expect(mockRedis.keys).toHaveBeenCalledWith('refresh:user-uuid-1:*');
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------
  // sendMagicLink
  // ---------------------------------------------------------------
  describe('sendMagicLink', () => {
    it('should obtain management token and call passwordless/start', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'mgmt-token' }),
        })
        .mockResolvedValueOnce({ ok: true });

      await service.sendMagicLink('user@example.com');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      // management token request
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://test.auth0.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('client_credentials'),
        }),
      );
      // passwordless/start request
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://test.auth0.com/passwordless/start',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('user@example.com'),
        }),
      );
    });

    it('should throw UnauthorizedException when management token request fails', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(service.sendMagicLink('user@example.com')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should include correct error message when management token fails', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(service.sendMagicLink('user@example.com')).rejects.toThrow(
        'Failed to initiate magic link',
      );
    });

    it('should throw when magic link send request fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'mgmt-token' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'Bad Request',
        });

      await expect(service.sendMagicLink('user@example.com')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should include authorization header with management token', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'super-mgmt-token' }),
        })
        .mockResolvedValueOnce({ ok: true });

      await service.sendMagicLink('user@example.com');

      const secondCallArgs = mockFetch.mock.calls[1];
      expect(secondCallArgs[1].headers).toEqual(
        expect.objectContaining({ Authorization: 'Bearer super-mgmt-token' }),
      );
    });
  });

  // ---------------------------------------------------------------
  // validateAuth0Token
  // ---------------------------------------------------------------
  describe('validateAuth0Token', () => {
    it('should exchange code for tokens and return user info', async () => {
      const expectedUserInfo = {
        sub: 'auth0|123',
        email: 'test@example.com',
        name: 'Test User',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'auth0-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => expectedUserInfo,
        });

      const result = await service.validateAuth0Token('auth-code-123');

      expect(result).toEqual(expectedUserInfo);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://test.auth0.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('auth-code-123'),
        }),
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://test.auth0.com/userinfo',
        expect.objectContaining({
          headers: { Authorization: 'Bearer auth0-access-token' },
        }),
      );
    });

    it('should send correct grant_type and redirect_uri in token exchange', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'tok' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sub: 's', email: 'e', name: 'n' }),
        });

      await service.validateAuth0Token('code');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.grant_type).toBe('authorization_code');
      expect(body.redirect_uri).toBe('http://localhost:3000/callback');
      expect(body.client_id).toBe('client-id');
      expect(body.client_secret).toBe('client-secret');
    });

    it('should throw UnauthorizedException when token exchange fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'invalid_grant',
      });

      await expect(service.validateAuth0Token('bad-code')).rejects.toThrow(UnauthorizedException);
    });

    it('should include correct error message when token exchange fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'invalid_grant',
      });

      await expect(service.validateAuth0Token('bad-code')).rejects.toThrow(
        'Invalid authorization code',
      );
    });

    it('should throw UnauthorizedException when userinfo fetch fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'token' }),
        })
        .mockResolvedValueOnce({ ok: false });

      await expect(service.validateAuth0Token('code')).rejects.toThrow(
        'Failed to fetch user info from Auth0',
      );
    });
  });

  // ---------------------------------------------------------------
  // getUserWithOrgs
  // ---------------------------------------------------------------
  describe('getUserWithOrgs', () => {
    it('should return user with organization memberships', async () => {
      userRepo.findOne!.mockResolvedValue(mockUser);
      const memberships = [
        {
          organization: { id: 'org-1', name: 'Org One', slug: 'org-one', logo_url: null },
          role: TeamRole.OWNER,
        },
        {
          organization: {
            id: 'org-2',
            name: 'Org Two',
            slug: 'org-two',
            logo_url: 'https://logo.png',
          },
          role: TeamRole.VIEWER,
        },
      ];
      teamMemberRepo.find!.mockResolvedValue(memberships);

      const result = await service.getUserWithOrgs('user-uuid-1');

      expect(result.organizations).toEqual([
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

    it('should return empty organizations array when user has no memberships', async () => {
      userRepo.findOne!.mockResolvedValue(mockUser);
      teamMemberRepo.find!.mockResolvedValue([]);

      const result = await service.getUserWithOrgs('user-uuid-1');

      expect(result.organizations).toEqual([]);
    });

    it('should spread user properties into result', async () => {
      userRepo.findOne!.mockResolvedValue(mockUser);
      teamMemberRepo.find!.mockResolvedValue([]);

      const result = await service.getUserWithOrgs('user-uuid-1');

      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
      expect(result.name).toBe(mockUser.name);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      await expect(service.getUserWithOrgs('nonexistent')).rejects.toThrow(UnauthorizedException);
      await expect(service.getUserWithOrgs('nonexistent')).rejects.toThrow('User not found');
    });
  });
});
