'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Loader2, CheckCircle2, XCircle, ArrowRight, RefreshCw } from 'lucide-react';

type SyncStatus = 'syncing' | 'complete' | 'error';

export default function SyncPage() {
  const t = useTranslations('sync');
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [rowsImported, setRowsImported] = useState(0);
  const [status, setStatus] = useState<SyncStatus>('syncing');
  const [errorMessage, setErrorMessage] = useState('');

  const onSyncProgress = useCallback((data: { progress: number; rowsImported: number }) => {
    setProgress(data.progress);
    setRowsImported(data.rowsImported);
  }, []);

  const onSyncComplete = useCallback((data: { totalRows: number }) => {
    setProgress(100);
    setRowsImported(data.totalRows);
    setStatus('complete');
  }, []);

  const onSyncError = useCallback((data: { error: string }) => {
    setStatus('error');
    setErrorMessage(data.error);
  }, []);

  useWebSocket({
    onSyncProgress,
    onSyncComplete,
    onSyncError,
  });

  const handleGoToDashboard = () => {
    router.push('/data-sources');
  };

  const handleRetry = () => {
    setProgress(0);
    setRowsImported(0);
    setStatus('syncing');
    setErrorMessage('');
    router.push('/connect');
  };

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-lg">
            {status === 'syncing' && t('syncing.title')}
            {status === 'complete' && t('complete.title')}
            {status === 'error' && t('error.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-gray-500">
                {status === 'syncing' && t('syncing.importing')}
                {status === 'complete' && t('complete.done')}
                {status === 'error' && t('error.failed')}
              </span>
              <span className="font-medium text-gray-900">{progress}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  status === 'error'
                    ? 'bg-red-500'
                    : status === 'complete'
                      ? 'bg-green-500'
                      : 'bg-primary-blue'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Row Counter */}
          <div className="flex items-center justify-center gap-2 text-center">
            {status === 'syncing' && (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-primary-blue" />
                <p className="text-sm text-gray-600">
                  {t('syncing.rowsImported', { count: rowsImported })}
                </p>
              </>
            )}
            {status === 'complete' && (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <p className="text-sm text-gray-600">
                  {t('complete.totalRows', { count: rowsImported })}
                </p>
              </>
            )}
            {status === 'error' && (
              <>
                <XCircle className="h-5 w-5 text-red-500" />
                <p className="text-sm text-red-600">{t('error.message')}</p>
              </>
            )}
          </div>

          {/* Error Details */}
          {status === 'error' && errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-center gap-3">
            {status === 'complete' && (
              <Button onClick={handleGoToDashboard}>
                <ArrowRight className="mr-2 h-4 w-4" />
                {t('complete.viewDashboard')}
              </Button>
            )}
            {status === 'error' && (
              <Button onClick={handleRetry} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                {t('error.retry')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
