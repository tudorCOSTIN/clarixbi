'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useDataSources } from '@/hooks/useDataSources';
import { useWebSocket } from '@/hooks/useWebSocket';
import {
  FileSpreadsheet,
  ShoppingCart,
  Upload,
  Play,
  Plus,
  RefreshCw,
  Loader2,
  Database,
  Trash2,
} from 'lucide-react';

const typeConfig: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
  }
> = {
  smartbill: {
    icon: FileSpreadsheet,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  woocommerce: {
    icon: ShoppingCart,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
  csv: {
    icon: Upload,
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
  },
  demo: {
    icon: Play,
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
  },
};

const defaultTypeConfig = {
  icon: Database,
  iconBg: 'bg-gray-100',
  iconColor: 'text-gray-600',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  syncing: 'bg-blue-100 text-blue-700',
  error: 'bg-red-100 text-red-700',
  disconnected: 'bg-gray-100 text-gray-700',
};

export default function DataSourcesPage() {
  const t = useTranslations('dataSources');
  const router = useRouter();
  const { data: dataSources, loading, triggerSync, remove, refetch } = useDataSources();
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

  const onSyncProgress = useCallback(
    (_data: { dataSourceId: string; progress: number; rowsImported: number }) => {
      // Refetch will pick up new status
    },
    [],
  );

  const onSyncComplete = useCallback(
    (data: { dataSourceId: string }) => {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(data.dataSourceId);
        return next;
      });
      refetch();
    },
    [refetch],
  );

  const onSyncError = useCallback(
    (data: { dataSourceId: string }) => {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(data.dataSourceId);
        return next;
      });
      refetch();
    },
    [refetch],
  );

  useWebSocket({ onSyncProgress, onSyncComplete, onSyncError });

  const handleSync = async (id: string) => {
    setSyncingIds((prev) => new Set(prev).add(id));
    try {
      await triggerSync(id);
    } catch {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">{t('title')}</h2>
        <Button
          onClick={() =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            router.push('/connect' as any)
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('addSource')}
        </Button>
      </div>

      {dataSources.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Database className="mb-4 h-12 w-12 text-gray-400" />
            <p className="text-sm text-gray-500">{t('empty')}</p>
            <Button
              className="mt-4"
              onClick={() =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                router.push('/connect' as any)
              }
            >
              {t('addFirstSource')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dataSources.map((ds) => {
            const config = typeConfig[ds.type] || defaultTypeConfig;
            const Icon = config.icon;
            const isSyncing = ds.status === 'syncing' || syncingIds.has(ds.id);

            return (
              <Card
                key={ds.id}
                className="transition-shadow hover:shadow-md cursor-pointer"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={() => router.push(`/data-sources/${ds.id}` as any)}
              >
                <CardHeader className="flex flex-row items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.iconBg}`}
                  >
                    <Icon className={`h-5 w-5 ${config.iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{ds.name}</CardTitle>
                    <Badge
                      className={`mt-1 text-xs ${statusColors[ds.status] || statusColors['disconnected']}`}
                    >
                      {t(`status.${ds.status}`)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{t('lastSync')}</span>
                    <span className="text-gray-900">{formatDate(ds.last_sync_at)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{t('totalRows')}</span>
                    <span className="text-gray-900">{ds.total_rows.toLocaleString()}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={isSyncing}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSync(ds.id);
                    }}
                  >
                    {isSyncing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    {isSyncing ? t('syncInProgress') : t('syncNow')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-red-500 mt-2"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm(t('deleteConfirm'))) return;
                      try {
                        await remove(ds.id);
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('delete')}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
