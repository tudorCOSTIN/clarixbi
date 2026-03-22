'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';

export default function AlertsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');

  useEffect(() => {
    console.error('Alerts error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <AlertTriangle className="h-12 w-12 text-red-500" />
      <h2 className="mt-4 text-xl font-semibold text-gray-900">{t('title')}</h2>
      <p className="mt-2 text-sm text-gray-500">{t('description')}</p>
      <button
        onClick={reset}
        className="mt-6 rounded-md bg-primary-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        {t('retry')}
      </button>
    </div>
  );
}
