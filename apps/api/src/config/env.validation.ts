import { Logger } from '@nestjs/common';

interface EnvConfig {
  key: string;
  required: boolean;
  description: string;
}

const ENV_SCHEMA: EnvConfig[] = [
  // Database
  { key: 'DATABASE_URL', required: true, description: 'PostgreSQL connection string' },
  // ClickHouse
  { key: 'CLICKHOUSE_URL', required: true, description: 'ClickHouse HTTP URL' },
  { key: 'CLICKHOUSE_DATABASE', required: true, description: 'ClickHouse database name' },
  // Redis
  { key: 'REDIS_URL', required: true, description: 'Redis connection string' },
  // Auth
  { key: 'AUTH0_DOMAIN', required: true, description: 'Auth0 tenant domain' },
  { key: 'AUTH0_CLIENT_ID', required: true, description: 'Auth0 application client ID' },
  { key: 'AUTH0_CLIENT_SECRET', required: true, description: 'Auth0 application client secret' },
  { key: 'JWT_SECRET', required: true, description: 'JWT signing secret' },
  // Security
  {
    key: 'ENCRYPTION_KEY',
    required: true,
    description: 'AES-256-GCM encryption key (64 hex chars)',
  },
  // Optional but important
  { key: 'CORS_ORIGIN', required: false, description: 'Allowed CORS origin(s)' },
  { key: 'STRIPE_SECRET_KEY', required: false, description: 'Stripe API secret key' },
  { key: 'CLAUDE_API_KEY', required: false, description: 'Anthropic Claude API key' },
  { key: 'RESEND_API_KEY', required: false, description: 'Resend email API key' },
  { key: 'SENTRY_DSN', required: false, description: 'Sentry error tracking DSN' },
];

export function validateEnvironment(): void {
  const logger = new Logger('EnvValidation');
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const env of ENV_SCHEMA) {
    if (!process.env[env.key]) {
      if (env.required) {
        missing.push(`  - ${env.key}: ${env.description}`);
      } else {
        warnings.push(`  - ${env.key}: ${env.description}`);
      }
    }
  }

  // Validate ENCRYPTION_KEY format
  const encKey = process.env['ENCRYPTION_KEY'];
  if (encKey && !/^[0-9a-fA-F]{64}$/.test(encKey)) {
    missing.push('  - ENCRYPTION_KEY: must be exactly 64 hex characters (32 bytes)');
  }

  // Validate JWT_SECRET is not the default dev value in production
  if (
    process.env['NODE_ENV'] === 'production' &&
    process.env['JWT_SECRET'] === 'clarixbi-jwt-secret-dev-change-in-production'
  ) {
    missing.push('  - JWT_SECRET: using default dev secret in production!');
  }

  // Validate CORS_ORIGIN is set in production
  if (process.env['NODE_ENV'] === 'production' && !process.env['CORS_ORIGIN']) {
    missing.push('  - CORS_ORIGIN: required in production for CORS and URL generation');
  }

  // Validate STRIPE_WEBHOOK_SECRET is set in production
  if (process.env['NODE_ENV'] === 'production' && !process.env['STRIPE_WEBHOOK_SECRET']) {
    warnings.push('  - STRIPE_WEBHOOK_SECRET: required for webhook signature verification');
  }

  if (warnings.length > 0) {
    logger.warn(`Optional env vars missing (features disabled):\n${warnings.join('\n')}`);
  }

  if (missing.length > 0) {
    logger.error(`Required env vars missing or invalid:\n${missing.join('\n')}`);
    throw new Error('Missing required environment variables. See logs above.');
  }

  logger.log('Environment validation passed');
}
