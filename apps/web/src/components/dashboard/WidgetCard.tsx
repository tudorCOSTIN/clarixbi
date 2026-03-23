'use client';

import { X, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';

const LineChartWidget = dynamic(() => import('./LineChart').then((mod) => mod.LineChartWidget), {
  ssr: false,
});
const BarChartWidget = dynamic(() => import('./BarChart').then((mod) => mod.BarChartWidget), {
  ssr: false,
});
const PieChartWidget = dynamic(() => import('./PieChart').then((mod) => mod.PieChartWidget), {
  ssr: false,
});
const TableWidget = dynamic(() => import('./TableWidget').then((mod) => mod.TableWidget), {
  ssr: false,
});
const KPICard = dynamic(() => import('./KPICard').then((mod) => mod.KPICard), { ssr: false });

interface WidgetData {
  id: string;
  type: string;
  title: string;
  config: Record<string, unknown>;
  data?: Record<string, unknown>[];
}

interface WidgetCardProps {
  widget: WidgetData;
  isEditing?: boolean;
  onRemove?: () => void;
  onConfigure?: () => void;
  height?: number;
}

export function WidgetCard({
  widget,
  isEditing = false,
  onRemove,
  onConfigure,
  height = 250,
}: WidgetCardProps) {
  const { type, title, config, data = [] } = widget;
  const colorScheme = (config.colorScheme as 'primary' | 'warm' | 'cool') || 'primary';
  const chartHeight = height - 60; // Account for card header

  const renderChart = () => {
    const firstRow = data.length > 0 ? data[0] : undefined;
    const keys = firstRow ? Object.keys(firstRow) : [];
    const xKey: string = (config.groupBy as string) || (config.metric as string) || keys[0] || 'x';
    const yKey: string = (config.metric as string) || keys[1] || keys[0] || 'y';

    switch (type) {
      case 'line':
        return (
          <LineChartWidget
            data={data}
            xKey={xKey}
            yKeys={[yKey]}
            colorScheme={colorScheme}
            smooth={config.smooth !== false}
            height={chartHeight}
          />
        );
      case 'bar':
        return (
          <BarChartWidget
            data={data}
            xKey={xKey}
            yKeys={[yKey]}
            colorScheme={colorScheme}
            horizontal={!!config.horizontal}
            height={chartHeight}
          />
        );
      case 'pie':
        return (
          <PieChartWidget
            data={data.map((d) => ({
              name: String(d[xKey] ?? ''),
              value: Number(d[yKey] ?? 0),
            }))}
            colorScheme={colorScheme}
            donut={!!config.donut}
            height={chartHeight}
          />
        );
      case 'table':
        return (
          <TableWidget
            data={data}
            pageSize={(config.pageSize as number) || 10}
            searchable={config.searchable !== false}
            height={chartHeight}
          />
        );
      case 'kpi':
        return (
          <KPICard
            value={Number(data[0]?.[yKey] ?? 0)}
            previousValue={data[1] ? Number(data[1][yKey] ?? 0) : undefined}
            label={title}
            colorScheme={colorScheme}
            sparklineData={data.map((d) => ({ value: Number(d[yKey] ?? 0) }))}
          />
        );
      default:
        return (
          <div className="flex items-center justify-center text-gray-500 text-sm h-full">
            Unknown widget type
          </div>
        );
    }
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="py-2 px-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-gray-700 truncate">
          {title || 'Untitled Widget'}
        </CardTitle>
        {isEditing && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onConfigure}
              aria-label="Configure widget"
            >
              <Settings className="h-3.5 w-3.5 text-gray-500" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onRemove}
              aria-label="Remove widget"
            >
              <X className="h-3.5 w-3.5 text-gray-500 hover:text-red-500" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 p-2 pt-0">{renderChart()}</CardContent>
    </Card>
  );
}
