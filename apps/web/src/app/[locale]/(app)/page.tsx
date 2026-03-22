'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Database,
  Bell,
  Plus,
  LayoutDashboard,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KPICard } from '@/components/dashboard/KPICard';
import { LineChartWidget } from '@/components/dashboard/LineChart';
import { BarChartWidget } from '@/components/dashboard/BarChart';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';

interface OverviewData {
  totalRevenue: number;
  previousRevenue: number;
  totalOrders: number;
  previousOrders: number;
  activeDataSources: number;
  activeAlerts: number;
  revenueTrend: { date: string; revenue: number }[];
  topProducts: { name: string; sales: number }[];
  recentSyncJobs: {
    id: string;
    status: string;
    source_name: string;
    duration: number;
    rows_imported: number;
    created_at: string;
  }[];
  recentAlertTriggers: { id: string; alert_name: string; value: number; created_at: string }[];
}

export default function HomePage() {
  const t = useTranslations('overview');
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEmpty, setIsEmpty] = useState(false);

  useEffect(() => {
    apiClient<{ data: OverviewData }>('/organizations/current/overview')
      .then((res) => {
        setData(res.data);
        // Consider empty if no data sources connected
        setIsEmpty(res.data.activeDataSources === 0);
      })
      .catch(() => {
        setIsEmpty(true);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-blue" />
      </div>
    );
  }

  if (isEmpty && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Database className="h-16 w-16 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-700">{t('welcome')}</h2>
        <p className="text-gray-500 text-center max-w-md">{t('welcomeSubtitle')}</p>
        <Link href="/data-sources">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            {t('connectDataSource')}
          </Button>
        </Link>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-500">
          {t('lastUpdated', { time: new Date().toLocaleTimeString() })}
        </p>
      </div>

      {isEmpty && (
        <Card className="border-dashed border-2 border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-blue-500" />
            <p className="text-sm text-blue-700">
              {t('connectPrompt')}{' '}
              <Link href="/data-sources" className="font-medium underline">
                {t('addSource')}
              </Link>
            </p>
          </div>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <KPICard
            value={data.totalRevenue}
            previousValue={data.previousRevenue}
            label={t('totalRevenue')}
            prefix="RON "
            colorScheme="primary"
            sparklineData={data.revenueTrend.map((d) => ({ value: d.revenue }))}
          />
        </Card>
        <Card className="p-4">
          <KPICard
            value={data.totalOrders}
            previousValue={data.previousOrders}
            label={t('totalOrders')}
            colorScheme="warm"
          />
        </Card>
        <Card className="p-4">
          <KPICard
            value={data.activeDataSources}
            label={t('activeDataSources')}
            colorScheme="cool"
          />
        </Card>
        <Card className="p-4">
          <KPICard value={data.activeAlerts} label={t('activeAlerts')} colorScheme="warm" />
        </Card>
      </div>

      {/* Charts Row */}
      {(data.revenueTrend.length > 0 || data.topProducts.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.revenueTrend.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('revenueTrend')}</CardTitle>
              </CardHeader>
              <CardContent>
                <LineChartWidget
                  data={data.revenueTrend}
                  xKey="date"
                  yKeys={['revenue']}
                  colorScheme="primary"
                  height={220}
                />
              </CardContent>
            </Card>
          )}
          {data.topProducts.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('topProducts')}</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChartWidget
                  data={data.topProducts}
                  xKey="name"
                  yKeys={['sales']}
                  colorScheme="cool"
                  height={220}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Sync Jobs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('recentSyncJobs')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentSyncJobs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">{t('noRecentSyncs')}</p>
              ) : (
                data.recentSyncJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      {job.status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm font-medium text-gray-700">{job.source_name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>
                        {job.rows_imported} {t('rows')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {job.duration}s
                      </span>
                      <span>{new Date(job.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Alert Triggers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('recentAlertTriggers')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentAlertTriggers.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">{t('noRecentAlerts')}</p>
              ) : (
                data.recentAlertTriggers.map((trigger) => (
                  <div
                    key={trigger.id}
                    className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium text-gray-700">
                        {trigger.alert_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <Badge
                        variant={trigger.value < 0 ? 'destructive' : 'default'}
                        className="text-xs"
                      >
                        {trigger.value > 0 ? '+' : ''}
                        {trigger.value}%
                      </Badge>
                      <span>{new Date(trigger.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-3">
        <Link href="/dashboards/new">
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" /> {t('createDashboard')}
          </Button>
        </Link>
        <Link href="/data-sources">
          <Button variant="outline" size="sm">
            <Database className="h-4 w-4 mr-1" /> {t('addDataSource')}
          </Button>
        </Link>
        <Link href="/dashboards">
          <Button variant="outline" size="sm">
            <LayoutDashboard className="h-4 w-4 mr-1" /> {t('viewDashboards')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
