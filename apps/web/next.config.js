const createNextIntlPlugin = require('next-intl/plugin');
const { withSentryConfig } = require('@sentry/nextjs');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isDev = process.env.NODE_ENV !== 'production';
const scriptSrc = isDev
  ? "'self' 'unsafe-inline' 'unsafe-eval' https://eu.i.posthog.com"
  : "'self' 'unsafe-inline' https://eu.i.posthog.com";
const connectSrc = isDev
  ? "'self' http://localhost:4000 https://eu.i.posthog.com https://*.auth0.com wss:"
  : "'self' https://eu.i.posthog.com https://*.auth0.com wss:";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@clarixbi/shared'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-XSS-Protection', value: '0' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src ${connectSrc}; frame-src 'none'; object-src 'none'`,
          },
        ],
      },
    ];
  },
};

const sentryConfig = {
  silent: true,
  disableLogger: true,
};

module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(withNextIntl(nextConfig), sentryConfig)
  : withNextIntl(nextConfig);
