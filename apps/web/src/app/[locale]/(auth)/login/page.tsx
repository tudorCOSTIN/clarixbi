'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';

export default function LoginPage() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [gdprConsent, setGdprConsent] = useState(false);

  const handleGoogleLogin = () => {
    const domain = process.env['NEXT_PUBLIC_AUTH0_DOMAIN'];
    const clientId = process.env['NEXT_PUBLIC_AUTH0_CLIENT_ID'];
    const audience = process.env['NEXT_PUBLIC_AUTH0_AUDIENCE'] || '';
    const callbackUrl = `${window.location.origin}/${window.location.pathname.split('/')[1]}/callback`;

    window.location.href =
      `https://${domain}/authorize?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
      `audience=${encodeURIComponent(audience)}&` +
      `scope=openid%20profile%20email&` +
      `connection=google-oauth2`;
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await apiClient('/auth/magic-link', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMagicLinkSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('magicLinkError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-xl bg-white p-8 shadow-2xl">
      {/* Logo */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-primary-blue">ClarixBI</h1>
        <p className="mt-2 text-sm text-gray-500">{t('signInTitle')}</p>
      </div>

      {/* GDPR Consent */}
      <div className="mb-6 flex items-start gap-2">
        <input
          id="gdpr-consent"
          type="checkbox"
          checked={gdprConsent}
          onChange={(e) => setGdprConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-blue focus:ring-primary-blue"
        />
        <label htmlFor="gdpr-consent" className="text-xs text-gray-600">
          {t('gdprConsent')}{' '}
          <a
            href="/legal/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-blue hover:underline"
          >
            {t('termsLink')}
          </a>{' '}
          {t('andText')}{' '}
          <a
            href="/legal/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-blue hover:underline"
          >
            {t('privacyLink')}
          </a>
        </label>
      </div>

      {/* Google OAuth Button */}
      <button
        onClick={handleGoogleLogin}
        disabled={!gdprConsent}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        {t('continueWithGoogle')}
      </button>

      {/* Divider */}
      <div className="my-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-500">{t('or')}</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {/* Magic Link Form */}
      {magicLinkSent ? (
        <div className="rounded-lg bg-green-50 p-4 text-center">
          <p className="text-sm text-green-700">{t('magicLinkSent')}</p>
          <button
            onClick={() => setMagicLinkSent(false)}
            className="mt-2 text-xs text-green-600 underline"
          >
            {t('tryAgain')}
          </button>
        </div>
      ) : (
        <form onSubmit={handleMagicLink}>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
            {t('email')}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-blue focus:outline-none focus:ring-1 focus:ring-primary-blue"
          />
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isLoading || !email || !gdprConsent}
            className="mt-4 w-full rounded-lg bg-primary-blue px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? t('sending') : t('sendMagicLink')}
          </button>
        </form>
      )}

      {/* Footer */}
      <p className="mt-6 text-center text-xs text-gray-500">{t('termsNotice')}</p>
    </div>
  );
}
