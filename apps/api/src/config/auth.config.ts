import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => ({
  auth0Domain: process.env['AUTH0_DOMAIN'] || '',
  auth0ClientId: process.env['AUTH0_CLIENT_ID'] || '',
  auth0ClientSecret: process.env['AUTH0_CLIENT_SECRET'] || '',
  auth0Audience: process.env['AUTH0_AUDIENCE'] || '',
  auth0CallbackUrl: process.env['AUTH0_CALLBACK_URL'] || '',
  jwtSecret: process.env['JWT_SECRET'] || 'clarixbi-jwt-secret-dev',
  jwtExpiresIn: '1h',
  refreshTokenExpiresIn: 30 * 24 * 60 * 60, // 30 days in seconds
  redisUrl: process.env['REDIS_URL'],
}));
