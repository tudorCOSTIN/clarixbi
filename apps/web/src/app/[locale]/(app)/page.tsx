'use client';

import { useState, useEffect } from 'react';
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
// import { apiClient } from '@/lib/api-client'; // Will be used when backend overview endpoint is ready
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

// Generate demo data for the overview
function getDemoData(): OverviewData {
  const now = Date.now();
  const day = 86400000;
  return {
    totalRevenue: 47850,
    previousRevenue: 42100,
    totalOrders: 342,
    previousOrders: 310,
    activeDataSources: 3,
    activeAlerts: 2,
    revenueTrend: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(now - (6 - i) * day).toLocaleDateString('ro-RO', {
        month: 'short',
        day: 'numeric',
      }),
      revenue: 5000 + Math.floor(Math.random() * 3000),
    })),
    topProducts: [
      { name: 'Produs A', sales: 128 },
      { name: 'Produs B', sales: 95 },
      { name: 'Produs C', sales: 72 },
      { name: 'Produs D', sales: 58 },
      { name: 'Produs E', sales: 41 },
    ],
    recentSyncJobs: [
      {
        id: '1',
        status: 'completed',
        source_name: 'WooCommerce',
        duration: 12,
        rows_imported: 156,
        created_at: new Date(now - 3600000).toISOString(),
      },
      {
        id: '2',
        status: 'completed',
        source_name: 'SmartBill',
        duration: 8,
        rows_imported: 89,
        created_at: new Date(now - 7200000).toISOString(),
      },
      {
        id: '3',
        status: 'failed',
        source_name: 'CSV Upload',
        duration: 2,
        rows_imported: 0,
        created_at: new Date(now - 14400000).toISOString(),
      },
      {
        id: '4',
        status: 'completed',
        source_name: 'WooCommerce',
        duration: 15,
        rows_imported: 203,
        created_at: new Date(now - 28800000).toISOString(),
      },
      {
        id: '5',
        status: 'completed',
        source_name: 'SmartBill',
        duration: 6,
        rows_imported: 67,
        created_at: new Date(now - 43200000).toISOString(),
      },
    ],
    recentAlertTriggers: [
      {
        id: '1',
        alert_name: 'Revenue drop',
        value: -12.5,
        created_at: new Date(now - 1800000).toISOString(),
      },
      {
        id: '2',
        alert_name: 'High order volume',
        value: 45,
        created_at: new Date(now - 10800000).toISOString(),
      },
    ],
  };
}

export default function HomePage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to fetch real data, fallback to demo
    // For now, use demo data since backend overview endpoint isn't built yet
    const timer = setTimeout(() => {
      setData(getDemoData());
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500">Last updated: {new Date().toLocaleTimeString()}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <KPICard
            value={data.totalRevenue}
            previousValue={data.previousRevenue}
            label="Total Revenue 30d"
            prefix="RON "
            colorScheme="primary"
            sparklineData={data.revenueTrend.map((d) => ({ value: d.revenue }))}
          />
        </Card>
        <Card className="p-4">
          <KPICard
            value={data.totalOrders}
            previousValue={data.previousOrders}
            label="Total Orders 30d"
            colorScheme="warm"
          />
        </Card>
        <Card className="p-4">
          <KPICard value={data.activeDataSources} label="Active Data Sources" colorScheme="cool" />
        </Card>
        <Card className="p-4">
          <KPICard value={data.activeAlerts} label="Active Alerts" colorScheme="warm" />
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue Trend (7 days)</CardTitle>
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top 5 Products</CardTitle>
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
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Sync Jobs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Sync Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentSyncJobs.map((job) => (
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
                    <span>{job.rows_imported} rows</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {job.duration}s
                    </span>
                    <span>{new Date(job.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Alert Triggers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Alert Triggers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentAlertTriggers.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No recent alerts</p>
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
            <Plus className="h-4 w-4 mr-1" /> Create Dashboard
          </Button>
        </Link>
        <Link href="/data-sources">
          <Button variant="outline" size="sm">
            <Database className="h-4 w-4 mr-1" /> Add Data Source
          </Button>
        </Link>
        <Link href="/dashboards">
          <Button variant="outline" size="sm">
            <LayoutDashboard className="h-4 w-4 mr-1" /> View Dashboards
          </Button>
        </Link>
      </div>
    </div>
  );
}
