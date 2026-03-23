'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common');

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <AlertTriangle className="h-12 w-12 text-red-400" />
      <h2 className="text-lg font-semibold text-gray-900">{t('error')}</h2>
      <p className="text-sm text-gray-500 max-w-md text-center">{error.message}</p>
      <Button onClick={reset} variant="outline">
        {t('retry')}
      </Button>
    </div>
  );
}
