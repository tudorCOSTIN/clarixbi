'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import posthog from 'posthog-js';

const CONSENT_KEY = 'clarixbi_cookie_consent';

export function CookieBanner() {
  const t = useTranslations('cookies');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem(CONSENT_KEY, 'all');
    try {
      posthog.opt_in_capturing();
    } catch {
      // PostHog may not be initialized
    }
    setVisible(false);
  };

  const handleNecessaryOnly = () => {
    localStorage.setItem(CONSENT_KEY, 'necessary');
    try {
      posthog.opt_out_capturing();
    } catch {
      // PostHog may not be initialized
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="mx-auto max-w-4xl rounded-xl border border-gray-200 bg-white/95 p-6 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-700">{t('message')}</p>
            <Link
              href="/legal/cookies"
              className="mt-1 inline-block text-xs text-primary-blue hover:underline"
            >
              {t('cookiePolicy')}
            </Link>
          </div>
          <div className="flex gap-3 shrink-0">
            <button
              onClick={handleNecessaryOnly}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {t('necessaryOnly')}
            </button>
            <button
              onClick={handleAcceptAll}
              className="rounded-lg bg-primary-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
            >
              {t('acceptAll')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
