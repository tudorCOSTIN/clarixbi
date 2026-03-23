import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => ({
  auth0Domain: process.env['AUTH0_DOMAIN'] || '',
  auth0ClientId: process.env['AUTH0_CLIENT_ID'] || '',
  auth0ClientSecret: process.env['AUTH0_CLIENT_SECRET'] || '',
  auth0Audience: process.env['AUTH0_AUDIENCE'] || '',
  auth0CallbackUrl:
    process.env['AUTH0_CALLBACK_URL'] ||
    `${process.env['NEXT_PUBLIC_APP_URL'] || process.env['CORS_ORIGIN']}/api/auth/callback`,
  jwtSecret: process.env['JWT_SECRET'] || 'clarixbi-jwt-secret-dev-change-in-production',
  jwtExpiresIn: '15m',
  refreshTokenExpiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
  redisUrl: process.env['REDIS_URL'],
}));
