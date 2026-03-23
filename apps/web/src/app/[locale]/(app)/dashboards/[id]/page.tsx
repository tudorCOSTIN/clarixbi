'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { ArrowLeft, Pencil, Loader2, Share2, Download, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WidgetCard } from '@/components/dashboard/WidgetCard';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { apiClient, API_URL } from '@/lib/api-client';
import { ShareModal } from '@/components/dashboard/ShareModal';

const ResponsiveGrid = WidthProvider(Responsive);

interface Widget {
  id: string;
  type: string;
  title: string;
  config: Record<string, unknown>;
  position: Record<string, unknown>;
  data_source_id: string | null;
}

interface DashboardData {
  id: string;
  name: string;
  description: string | null;
  widgets: Widget[];
}

export default function DashboardViewPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('dashboard.view');
  const dashboardId = params.id as string;
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    apiClient<{ data: DashboardData }>(`/organizations/current/dashboards/${dashboardId}`)
      .then((res) => setDashboard(res.data))
      .catch(() => router.push('/dashboards'));
  }, [dashboardId, router]);

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-blue" />
      </div>
    );
  }

  const lgLayout: Layout[] = dashboard.widgets.map((w) => ({
    i: w.id,
    x: (w.position?.x as number) || 0,
    y: (w.position?.y as number) || 0,
    w: (w.position?.w as number) || 4,
    h: (w.position?.h as number) || 3,
  }));
  const layouts: { [key: string]: Layout[] } = {
    lg: lgLayout,
    md: lgLayout,
    sm: lgLayout,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboards')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> {t('back')}
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{dashboard.name}</h1>
            {dashboard.description && (
              <p className="text-sm text-gray-500">{dashboard.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
            <Share2 className="h-4 w-4 mr-1" /> {t('share')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const headers: Record<string, string> = {
                  'Content-Type': 'application/json',
                };
                try {
                  const stored = localStorage.getItem('clarixbi-org-store');
                  const orgId = stored ? JSON.parse(stored)?.state?.currentOrgId : null;
                  if (orgId) headers['X-Org-Id'] = orgId;
                } catch {
                  // ignore parse errors
                }
                const res = await fetch(
                  `${API_URL}/organizations/current/dashboards/${dashboardId}/export`,
                  {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ format: 'pdf' }),
                    credentials: 'include',
                  },
                );
                if (!res.ok) throw new Error('Export failed');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${dashboard?.name || 'dashboard'}.pdf`;
                link.click();
                URL.revokeObjectURL(url);
              } catch {
                // ignore
              }
            }}
          >
            <Download className="h-4 w-4 mr-1" /> {t('exportPdf')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const res = await apiClient<{ data: { id: string } }>(
                  `/organizations/current/dashboards/${dashboardId}/duplicate`,
                  { method: 'POST' },
                );
                router.push(`/dashboards/${res.data.id}`);
              } catch {
                // ignore
              }
            }}
          >
            <Copy className="h-4 w-4 mr-1" /> {t('clone')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboards/${dashboardId}/edit`)}
          >
            <Pencil className="h-4 w-4 mr-1" /> {t('edit')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-500 hover:text-red-700"
            onClick={async () => {
              if (!confirm(t('deleteConfirm'))) return;
              try {
                await apiClient(`/organizations/current/dashboards/${dashboardId}`, {
                  method: 'DELETE',
                });
                router.push('/dashboards');
              } catch {
                // ignore
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" /> {t('delete')}
          </Button>
        </div>
      </div>

      <FilterBar />

      <div className="mt-4">
        {dashboard.widgets.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p>{t('noWidgets')}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push(`/dashboards/${dashboardId}/edit`)}
            >
              <Pencil className="h-4 w-4 mr-1" /> {t('addWidgets')}
            </Button>
          </div>
        ) : (
          <ResponsiveGrid
            className="layout"
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768 }}
            cols={{ lg: 12, md: 12, sm: 6 }}
            rowHeight={80}
            isDraggable={false}
            isResizable={false}
            margin={[12, 12]}
          >
            {dashboard.widgets.map((widget) => {
              const layout = layouts.lg?.find((l) => l.i === widget.id);
              const heightPx = (layout?.h || 3) * 80 - 12;
              return (
                <div key={widget.id}>
                  <WidgetCard
                    widget={{ ...widget, data: [] }}
                    isEditing={false}
                    height={heightPx}
                  />
                </div>
              );
            })}
          </ResponsiveGrid>
        )}
      </div>
      <ShareModal
        dashboardId={dashboardId}
        orgId="current"
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
