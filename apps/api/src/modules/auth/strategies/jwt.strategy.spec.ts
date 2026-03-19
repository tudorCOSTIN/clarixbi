/* eslint-disable @typescript-eslint/no-explicit-any */
import { UnauthorizedException } from '@nestjs/common';

// Mock jwks-rsa before importing the strategy
jest.mock('jwks-rsa', () => ({
  passportJwtSecret: jest.fn().mockReturnValue(() => 'mock-secret'),
}));

import { JwtStrategy, JwtPayload } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, any> = {
          'auth.auth0Domain': '',
          'auth.auth0Audience': '',
          'auth.jwtSecret': 'test-secret',
        };
        return config[key];
      }),
    };

    strategy = new JwtStrategy(mockConfigService as any);
  });

  describe('validate', () => {
    it('should return user object from valid payload', () => {
      const payload: JwtPayload = {
        sub: 'user-uuid-1',
        email: 'test@example.com',
        auth0_id: 'auth0|123',
      };

      const result = strategy.validate(payload);

      expect(result).toEqual({
        id: 'user-uuid-1',
        email: 'test@example.com',
        auth0_id: 'auth0|123',
      });
    });

    it('should throw UnauthorizedException for invalid payload', () => {
      const payload = { sub: '', email: 'test@example.com', auth0_id: '' };

      expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
    });
  });
});
