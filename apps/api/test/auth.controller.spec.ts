import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { JwtUser } from '../src/modules/auth/interfaces/jwt-user.interface';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Record<string, jest.Mock>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;

  const mockTokens = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
  };

  const mockAuth0Profile = {
    sub: 'auth0|123',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockUser = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    auth0_id: 'auth0|123',
    name: 'Test User',
  };

  const mockJwtUser: JwtUser = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    auth0_id: 'auth0|123',
  };

  const mockResponse = () => {
    const res: any = {};
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    authService = {
      validateAuth0Token: jest.fn(),
      findOrCreateUser: jest.fn(),
      generateTokenPair: jest.fn(),
      sendMagicLink: jest.fn(),
      getUserWithOrgs: jest.fn(),
      revokeRefreshToken: jest.fn(),
      refreshAccessToken: jest.fn(),
    };

    configService = {
      get: jest.fn().mockReturnValue('http://localhost:3000'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  // 1. GET /auth/callback - success redirects with cookies
  it('GET /auth/callback — success redirects with cookies set', async () => {
    authService.validateAuth0Token.mockResolvedValue(mockAuth0Profile);
    authService.findOrCreateUser.mockResolvedValue({ user: mockUser, isNew: false });
    authService.generateTokenPair.mockResolvedValue(mockTokens);
    const res = mockResponse();

    await controller.callbackGet('valid-code', res);

    expect(authService.validateAuth0Token).toHaveBeenCalledWith('valid-code');
    expect(res.cookie).toHaveBeenCalledWith(
      'access_token',
      mockTokens.access_token,
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      mockTokens.refresh_token,
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      }),
    );
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/ro');
  });

  // 2. GET /auth/callback - fails with invalid code
  it('GET /auth/callback — redirects to login with error when code is invalid', async () => {
    authService.validateAuth0Token.mockRejectedValue(new Error('Invalid authorization code'));
    const res = mockResponse();

    await controller.callbackGet('bad-code', res);

    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/ro/login?error=auth_failed');
  });

  // 3. POST /auth/callback - success returns tokens
  it('POST /auth/callback — success returns tokens and sets cookies', async () => {
    authService.validateAuth0Token.mockResolvedValue(mockAuth0Profile);
    authService.findOrCreateUser.mockResolvedValue({ user: mockUser, isNew: false });
    authService.generateTokenPair.mockResolvedValue(mockTokens);
    const res = mockResponse();

    const result = await controller.callback({ code: 'valid-code' }, res);

    expect(result).toEqual({
      data: {
        access_token: mockTokens.access_token,
        refresh_token: mockTokens.refresh_token,
        expires_in: mockTokens.expires_in,
        is_new_user: false,
      },
    });
    expect(res.cookie).toHaveBeenCalledTimes(2);
  });

  // 4. POST /auth/callback - fails with invalid code
  it('POST /auth/callback — throws when Auth0 code is invalid', async () => {
    authService.validateAuth0Token.mockRejectedValue(new UnauthorizedException('Invalid code'));
    const res = mockResponse();

    await expect(controller.callback({ code: 'invalid-code' }, res)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // 5. POST /auth/magic-link - success sends email
  it('POST /auth/magic-link — success sends magic link email', async () => {
    authService.sendMagicLink.mockResolvedValue(undefined);

    const result = await controller.magicLink({ email: 'test@example.com' });

    expect(authService.sendMagicLink).toHaveBeenCalledWith('test@example.com');
    expect(result).toEqual({
      data: { message: 'Magic link sent successfully' },
    });
  });

  // 6. POST /auth/magic-link - fails with invalid email
  it('POST /auth/magic-link — throws when service rejects invalid email', async () => {
    authService.sendMagicLink.mockRejectedValue(new BadRequestException('Invalid email address'));

    await expect(controller.magicLink({ email: 'not-an-email' })).rejects.toThrow(
      BadRequestException,
    );
  });

  // 7. GET /auth/me - success returns user with orgs
  it('GET /auth/me — success returns user data with organizations', async () => {
    const userWithOrgs = {
      id: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
      organizations: [{ id: 'org-1', name: 'Test Org', role: 'admin' }],
    };
    authService.getUserWithOrgs.mockResolvedValue(userWithOrgs);

    const result = await controller.me(mockJwtUser);

    expect(authService.getUserWithOrgs).toHaveBeenCalledWith(mockJwtUser.id);
    expect(result).toEqual({ data: userWithOrgs });
  });

  // 8. GET /auth/me - fails when user not found
  it('GET /auth/me — throws when user is not found', async () => {
    authService.getUserWithOrgs.mockRejectedValue(new UnauthorizedException('User not found'));

    await expect(controller.me(mockJwtUser)).rejects.toThrow(UnauthorizedException);
  });

  // 9. POST /auth/logout - success invalidates token
  it('POST /auth/logout — success revokes token and clears cookies', async () => {
    authService.revokeRefreshToken.mockResolvedValue(undefined);
    const res = mockResponse();

    const result = await controller.logout(mockJwtUser, res);

    expect(authService.revokeRefreshToken).toHaveBeenCalledWith(mockJwtUser.id);
    expect(res.clearCookie).toHaveBeenCalledWith('access_token', { path: '/' });
    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', { path: '/' });
    expect(result).toEqual({ data: { message: 'Logged out successfully' } });
  });

  // 10. POST /auth/logout - handles already invalidated token
  it('POST /auth/logout — succeeds even when token is already invalidated', async () => {
    authService.revokeRefreshToken.mockResolvedValue(undefined);
    const res = mockResponse();

    const result = await controller.logout(mockJwtUser, res);

    expect(authService.revokeRefreshToken).toHaveBeenCalledWith(mockJwtUser.id);
    expect(result).toEqual({ data: { message: 'Logged out successfully' } });
  });

  // 11. POST /auth/refresh - success returns new access token
  it('POST /auth/refresh — success returns new tokens and sets cookies', async () => {
    const newTokens = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600,
    };
    authService.refreshAccessToken.mockResolvedValue(newTokens);
    const res = mockResponse();

    const result = await controller.refresh({ refresh_token: 'valid-refresh-token' }, res);

    expect(authService.refreshAccessToken).toHaveBeenCalledWith('valid-refresh-token');
    expect(res.cookie).toHaveBeenCalledWith(
      'access_token',
      newTokens.access_token,
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      newTokens.refresh_token,
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      }),
    );
    expect(result).toEqual({
      data: {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_in: newTokens.expires_in,
      },
    });
  });

  // 12. POST /auth/refresh - fails with invalid refresh token
  it('POST /auth/refresh — throws when refresh token is invalid', async () => {
    authService.refreshAccessToken.mockRejectedValue(
      new UnauthorizedException('Invalid refresh token'),
    );
    const res = mockResponse();

    await expect(controller.refresh({ refresh_token: 'invalid-token' }, res)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // 13. POST /auth/refresh - fails with expired refresh token
  it('POST /auth/refresh — throws when refresh token is expired', async () => {
    authService.refreshAccessToken.mockRejectedValue(
      new UnauthorizedException('Refresh token expired'),
    );
    const res = mockResponse();

    await expect(controller.refresh({ refresh_token: 'expired-token' }, res)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(res.cookie).not.toHaveBeenCalled();
  });

  // 14. POST /auth/callback - validates dto structure
  it('POST /auth/callback — passes dto code to validateAuth0Token', async () => {
    authService.validateAuth0Token.mockResolvedValue(mockAuth0Profile);
    authService.findOrCreateUser.mockResolvedValue({ user: mockUser, isNew: true });
    authService.generateTokenPair.mockResolvedValue(mockTokens);
    const res = mockResponse();

    const result = await controller.callback({ code: 'specific-auth-code' }, res);

    expect(authService.validateAuth0Token).toHaveBeenCalledWith('specific-auth-code');
    expect(result.data.is_new_user).toBe(true);
  });

  // 15. GET /auth/me - returns correct user shape
  it('GET /auth/me — returns data wrapper with full user shape including orgs', async () => {
    const fullUser = {
      id: 'user-uuid-1',
      email: 'test@example.com',
      name: 'Test User',
      auth0_id: 'auth0|123',
      organizations: [
        { id: 'org-1', name: 'Org One', role: 'admin' },
        { id: 'org-2', name: 'Org Two', role: 'member' },
      ],
    };
    authService.getUserWithOrgs.mockResolvedValue(fullUser);

    const result = await controller.me(mockJwtUser);

    expect(result).toHaveProperty('data');
    expect(result.data).toHaveProperty('id', 'user-uuid-1');
    expect(result.data).toHaveProperty('email', 'test@example.com');
    expect(result.data).toHaveProperty('organizations');
    expect(result.data.organizations).toHaveLength(2);
  });

  // Additional: GET /auth/callback redirects missing code
  it('GET /auth/callback — redirects to login with error when code is missing', async () => {
    const res = mockResponse();

    await controller.callbackGet(undefined as unknown as string, res);

    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/ro/login?error=missing_code');
    expect(authService.validateAuth0Token).not.toHaveBeenCalled();
  });

  // Additional: GET /auth/callback redirects new user to /connect
  it('GET /auth/callback — redirects new user to connect page', async () => {
    authService.validateAuth0Token.mockResolvedValue(mockAuth0Profile);
    authService.findOrCreateUser.mockResolvedValue({ user: mockUser, isNew: true });
    authService.generateTokenPair.mockResolvedValue(mockTokens);
    const res = mockResponse();

    await controller.callbackGet('valid-code', res);

    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/ro/connect');
  });
});
