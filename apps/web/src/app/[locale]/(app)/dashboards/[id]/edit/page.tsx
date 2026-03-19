/* eslint-disable no-console */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WidgetLibrary } from '@/components/dashboard/WidgetLibrary';
import { WidgetConfigurator, WidgetConfig } from '@/components/dashboard/WidgetConfigurator';
import { WidgetCard } from '@/components/dashboard/WidgetCard';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { apiClient } from '@/lib/api-client';

const ResponsiveGrid = WidthProvider(Responsive);

interface Widget {
  id: string;
  type: string;
  title: string;
  config: Record<string, unknown>;
  position: Record<string, unknown>;
  data_source_id: string | null;
  query_sql: string;
}

interface Dashboard {
  id: string;
  name: string;
  description: string | null;
  layout: Record<string, unknown>[];
  widgets: Widget[];
}

const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  title: '',
  type: 'line',
  dataSourceId: null,
  metric: '',
  aggregation: 'SUM',
  groupBy: '',
  sort: 'DESC',
  limit: 10,
  dateRange: '30d',
  colorScheme: 'primary',
};

export default function DashboardEditPage() {
  const params = useParams();
  const router = useRouter();
  const dashboardId = params.id as string;

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [layouts, setLayouts] = useState<{ [key: string]: Layout[] }>({});
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dashboardName, setDashboardName] = useState('');

  // Configurator state
  const [configuratorOpen, setConfiguratorOpen] = useState(false);
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);
  const [configuratorConfig, setConfiguratorConfig] = useState<WidgetConfig>(DEFAULT_WIDGET_CONFIG);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch dashboard
  useEffect(() => {
    apiClient<{ data: Dashboard }>(`/organizations/current/dashboards/${dashboardId}`)
      .then((res) => {
        const d = res.data;
        setDashboard(d);
        setDashboardName(d.name);
        setWidgets(d.widgets || []);
        // Build layouts from widget positions
        const lgLayout: Layout[] = (d.widgets || []).map((w) => ({
          i: w.id,
          x: (w.position?.x as number) || 0,
          y: (w.position?.y as number) || 0,
          w: (w.position?.w as number) || 4,
          h: (w.position?.h as number) || 3,
          minW: 2,
          minH: 2,
          maxW: 12,
          maxH: 8,
        }));
        setLayouts({ lg: lgLayout, md: lgLayout, sm: lgLayout });
      })
      .catch(() => router.push('/dashboards'));
  }, [dashboardId, router]);

  // Auto-save with debounce
  const autoSave = useCallback(
    async (newLayouts: Layout[], _newWidgets: Widget[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          // Bulk update widget positions
          const bulkData = newLayouts.map((l) => ({
            id: l.i,
            position: { x: l.x, y: l.y, w: l.w, h: l.h },
          }));
          await apiClient(`/organizations/current/dashboards/${dashboardId}/widgets/bulk`, {
            method: 'POST',
            body: JSON.stringify({ widgets: bulkData }),
          });

          // Update dashboard layout
          await apiClient(`/organizations/current/dashboards/${dashboardId}`, {
            method: 'PATCH',
            body: JSON.stringify({ layout: newLayouts, name: dashboardName }),
          });

          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        } catch (err) {
          console.error('Auto-save failed:', err);
        } finally {
          setSaving(false);
        }
      }, 2000);
    },
    [dashboardId, dashboardName],
  );

  const handleLayoutChange = useCallback(
    (_currentLayout: Layout[], allLayouts: { [key: string]: Layout[] }) => {
      setLayouts(allLayouts);
      const lgLayout = allLayouts.lg || _currentLayout;
      autoSave(lgLayout, widgets);
    },
    [autoSave, widgets],
  );

  // Add widget
  const handleAddWidget = useCallback(
    async (type: string, defaultSize: { w: number; h: number }) => {
      try {
        const res = await apiClient<{ data: Widget }>(
          `/organizations/current/dashboards/${dashboardId}/widgets`,
          {
            method: 'POST',
            body: JSON.stringify({
              type,
              title: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Widget`,
              position: { x: 0, y: Infinity, w: defaultSize.w, h: defaultSize.h },
            }),
          },
        );
        const newWidget = res.data;
        setWidgets((prev) => [...prev, newWidget]);
        setLayouts((prev) => {
          const lgLayout = [
            ...(prev.lg || []),
            {
              i: newWidget.id,
              x: 0,
              y: Infinity,
              w: defaultSize.w,
              h: defaultSize.h,
              minW: 2,
              minH: 2,
              maxW: 12,
              maxH: 8,
            },
          ];
          return { ...prev, lg: lgLayout, md: lgLayout, sm: lgLayout };
        });

        // Open configurator for new widget
        setActiveWidgetId(newWidget.id);
        setConfiguratorConfig({
          ...DEFAULT_WIDGET_CONFIG,
          type,
          title: newWidget.title,
        });
        setConfiguratorOpen(true);
      } catch (err) {
        console.error('Failed to add widget:', err);
      }
    },
    [dashboardId],
  );

  // Remove widget
  const handleRemoveWidget = useCallback(
    async (widgetId: string) => {
      try {
        await apiClient(`/organizations/current/dashboards/${dashboardId}/widgets/${widgetId}`, {
          method: 'DELETE',
        });
        setWidgets((prev) => prev.filter((w) => w.id !== widgetId));
        setLayouts((prev) => {
          const lgLayout = (prev.lg || []).filter((l) => l.i !== widgetId);
          return { ...prev, lg: lgLayout, md: lgLayout, sm: lgLayout };
        });
        if (activeWidgetId === widgetId) {
          setConfiguratorOpen(false);
          setActiveWidgetId(null);
        }
      } catch (err) {
        console.error('Failed to remove widget:', err);
      }
    },
    [dashboardId, activeWidgetId],
  );

  // Configure widget
  const handleConfigureWidget = useCallback(
    (widgetId: string) => {
      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget) return;
      setActiveWidgetId(widgetId);
      setConfiguratorConfig({
        title: widget.title,
        type: widget.type,
        dataSourceId: widget.data_source_id,
        metric: (widget.config.metric as string) || '',
        aggregation: (widget.config.aggregation as string) || 'SUM',
        groupBy: (widget.config.groupBy as string) || '',
        sort: (widget.config.sort as 'ASC' | 'DESC') || 'DESC',
        limit: (widget.config.limit as number) || 10,
        dateRange: (widget.config.dateRange as string) || '30d',
        colorScheme: (widget.config.colorScheme as string) || 'primary',
      });
      setConfiguratorOpen(true);
    },
    [widgets],
  );

  // Apply widget config
  const handleApplyConfig = useCallback(
    async (config: WidgetConfig) => {
      if (!activeWidgetId) return;
      try {
        const res = await apiClient<{ data: Widget }>(
          `/organizations/current/dashboards/${dashboardId}/widgets/${activeWidgetId}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              type: config.type,
              title: config.title,
              data_source_id: config.dataSourceId,
              config: {
                metric: config.metric,
                aggregation: config.aggregation,
                groupBy: config.groupBy,
                sort: config.sort,
                limit: config.limit,
                dateRange: config.dateRange,
                colorScheme: config.colorScheme,
              },
            }),
          },
        );
        setWidgets((prev) => prev.map((w) => (w.id === activeWidgetId ? res.data : w)));
        setConfiguratorOpen(false);
        setActiveWidgetId(null);
      } catch (err) {
        console.error('Failed to update widget:', err);
      }
    },
    [activeWidgetId, dashboardId],
  );

  // Save dashboard name on blur
  const handleNameBlur = useCallback(() => {
    if (dashboard && dashboardName !== dashboard.name) {
      apiClient(`/organizations/current/dashboards/${dashboardId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: dashboardName }),
      }).catch(console.error);
    }
  }, [dashboard, dashboardName, dashboardId]);

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary-blue" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboards')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Input
          value={dashboardName}
          onChange={(e) => setDashboardName(e.target.value)}
          onBlur={handleNameBlur}
          className="max-w-xs h-8 text-sm font-semibold border-transparent hover:border-gray-200 focus:border-primary-blue"
        />
        <div className="flex items-center gap-2 ml-auto">
          {saving && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving...
            </span>
          )}
          {saved && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => setPreview(!preview)}>
            {preview ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            {preview ? 'Edit' : 'Preview'}
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Widget library (hidden in preview mode) */}
        {!preview && <WidgetLibrary onAddWidget={handleAddWidget} />}

        {/* Grid area */}
        <div className="flex-1 overflow-auto p-4">
          {widgets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <p className="text-lg mb-2">No widgets yet</p>
              <p className="text-sm">Click or drag a widget from the library to get started</p>
            </div>
          ) : (
            <ResponsiveGrid
              className="layout"
              layouts={layouts}
              breakpoints={{ lg: 1200, md: 996, sm: 768 }}
              cols={{ lg: 12, md: 12, sm: 6 }}
              rowHeight={80}
              isDraggable={!preview}
              isResizable={!preview}
              onLayoutChange={handleLayoutChange}
              draggableHandle=".react-grid-drag-handle"
              compactType="vertical"
              margin={[12, 12]}
            >
              {widgets.map((widget) => {
                const layout = layouts.lg?.find((l) => l.i === widget.id);
                const heightPx = (layout?.h || 3) * 80 - 12;
                return (
                  <div key={widget.id} className="react-grid-drag-handle">
                    <WidgetCard
                      widget={{ ...widget, data: [] }}
                      isEditing={!preview}
                      onRemove={() => handleRemoveWidget(widget.id)}
                      onConfigure={() => handleConfigureWidget(widget.id)}
                      height={heightPx}
                    />
                  </div>
                );
              })}
            </ResponsiveGrid>
          )}
        </div>

        {/* Widget configurator */}
        <WidgetConfigurator
          open={configuratorOpen && !preview}
          initialConfig={configuratorConfig}
          onApply={handleApplyConfig}
          onCancel={() => {
            setConfiguratorOpen(false);
            setActiveWidgetId(null);
          }}
        />
      </div>
    </div>
  );
}
