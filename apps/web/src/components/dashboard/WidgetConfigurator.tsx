'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, TrendingUp, BarChart3, PieChart, Table, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';

const CHART_TYPES = [
  { type: 'line', label: 'Line', icon: TrendingUp },
  { type: 'bar', label: 'Bar', icon: BarChart3 },
  { type: 'pie', label: 'Pie', icon: PieChart },
  { type: 'table', label: 'Table', icon: Table },
  { type: 'kpi', label: 'KPI', icon: Hash },
] as const;

const AGGREGATIONS = ['SUM', 'COUNT', 'AVG', 'MIN', 'MAX', 'None'] as const;
const DATE_PRESETS = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
  { label: '1 year', value: '1y' },
  { label: 'All', value: 'all' },
] as const;

const COLOR_SCHEMES = [
  { id: 'primary', label: 'Blue', colors: ['#2196F3', '#42A5F5', '#90CAF9'] },
  { id: 'warm', label: 'Warm', colors: ['#FF6B35', '#F7931E', '#FFC107'] },
  { id: 'cool', label: 'Cool', colors: ['#00BCD4', '#009688', '#4CAF50'] },
] as const;

export interface WidgetConfig {
  title: string;
  type: string;
  dataSourceId: string | null;
  metric: string;
  aggregation: string;
  groupBy: string;
  sort: 'ASC' | 'DESC';
  limit: number;
  dateRange: string;
  colorScheme: string;
}

interface DataSource {
  id: string;
  name: string;
  type: string;
  status: string;
}

interface ColumnInfo {
  name: string;
  type: string;
}

interface WidgetConfiguratorProps {
  open: boolean;
  initialConfig: WidgetConfig;
  onApply: (config: WidgetConfig) => void;
  onCancel: () => void;
}

export function WidgetConfigurator({
  open,
  initialConfig,
  onApply,
  onCancel,
}: WidgetConfiguratorProps) {
  const [config, setConfig] = useState<WidgetConfig>(initialConfig);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [loading, setLoading] = useState(false);

  // Reset config when initialConfig changes
  useEffect(() => {
    setConfig(initialConfig);
  }, [initialConfig]);

  // Fetch data sources
  useEffect(() => {
    if (!open) return;
    apiClient<{ data: DataSource[] }>('/organizations/current/data-sources')
      .then((res) => setDataSources(res.data.filter((ds) => ds.status === 'active')))
      .catch(() => setDataSources([]));
  }, [open]);

  // Fetch columns when data source changes
  useEffect(() => {
    if (!config.dataSourceId) {
      setColumns([]);
      return;
    }
    setLoading(true);
    apiClient<{ data: ColumnInfo[] }>(
      `/organizations/current/data-sources/${config.dataSourceId}/columns`,
    )
      .then((res) => setColumns(res.data))
      .catch(() => setColumns([]))
      .finally(() => setLoading(false));
  }, [config.dataSourceId]);

  const update = useCallback((partial: Partial<WidgetConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[350px] bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Configure Widget</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Title */}
        <div className="space-y-1.5">
          <Label>Widget Title</Label>
          <Input
            value={config.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Titlu widget"
          />
        </div>

        {/* Chart type */}
        <div className="space-y-1.5">
          <Label>Chart Type</Label>
          <div className="grid grid-cols-5 gap-1.5">
            {CHART_TYPES.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-md border p-2 text-xs transition-colors',
                  config.type === type
                    ? 'border-primary-blue bg-blue-50 text-primary-blue'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300',
                )}
                onClick={() => update({ type })}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Data Source */}
        <div className="space-y-1.5">
          <Label>Data Source</Label>
          <select
            className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2"
            value={config.dataSourceId || ''}
            onChange={(e) =>
              update({ dataSourceId: e.target.value || null, metric: '', groupBy: '' })
            }
          >
            <option value="">Select source...</option>
            {dataSources.map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.name} ({ds.type})
              </option>
            ))}
          </select>
        </div>

        {/* Metric / Column */}
        <div className="space-y-1.5">
          <Label>Metric / Column</Label>
          <select
            className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2"
            value={config.metric}
            onChange={(e) => update({ metric: e.target.value })}
            disabled={loading || columns.length === 0}
          >
            <option value="">{loading ? 'Loading...' : 'Select column...'}</option>
            {columns.map((col) => (
              <option key={col.name} value={col.name}>
                {col.name} ({col.type})
              </option>
            ))}
          </select>
        </div>

        {/* Aggregation */}
        <div className="space-y-1.5">
          <Label>Aggregation</Label>
          <select
            className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2"
            value={config.aggregation}
            onChange={(e) => update({ aggregation: e.target.value })}
          >
            {AGGREGATIONS.map((agg) => (
              <option key={agg} value={agg}>
                {agg}
              </option>
            ))}
          </select>
        </div>

        {/* Group By */}
        <div className="space-y-1.5">
          <Label>Group By</Label>
          <select
            className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2"
            value={config.groupBy}
            onChange={(e) => update({ groupBy: e.target.value })}
            disabled={loading || columns.length === 0}
          >
            <option value="">None</option>
            {columns.map((col) => (
              <option key={col.name} value={col.name}>
                {col.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sort + Limit */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Sort</Label>
            <select
              className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2"
              value={config.sort}
              onChange={(e) => update({ sort: e.target.value as 'ASC' | 'DESC' })}
            >
              <option value="ASC">ASC</option>
              <option value="DESC">DESC</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Limit</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={config.limit}
              onChange={(e) =>
                update({ limit: Math.min(100, Math.max(1, Number(e.target.value) || 10)) })
              }
            />
          </div>
        </div>

        {/* Date Range */}
        <div className="space-y-1.5">
          <Label>Date Range</Label>
          <div className="flex flex-wrap gap-1.5">
            {DATE_PRESETS.map(({ label, value }) => (
              <button
                key={value}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                  config.dateRange === value
                    ? 'border-primary-blue bg-blue-50 text-primary-blue'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300',
                )}
                onClick={() => update({ dateRange: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Color Scheme */}
        <div className="space-y-1.5">
          <Label>Color Scheme</Label>
          <div className="flex gap-2">
            {COLOR_SCHEMES.map(({ id, label, colors }) => (
              <button
                key={id}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                  config.colorScheme === id
                    ? 'border-primary-blue bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300',
                )}
                onClick={() => update({ colorScheme: id })}
              >
                <div className="flex gap-0.5">
                  {colors.map((c) => (
                    <div key={c} className="h-3 w-3 rounded-full" style={{ backgroundColor: c }} />
                  ))}
                </div>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-200">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Anuleaza
        </Button>
        <Button className="flex-1" onClick={() => onApply(config)}>
          Aplica
        </Button>
      </div>
    </div>
  );
}
