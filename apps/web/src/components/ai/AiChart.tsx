'use client';

import { KPICard } from '@/components/dashboard/KPICard';
import { LineChartWidget } from '@/components/dashboard/LineChart';
import { BarChartWidget } from '@/components/dashboard/BarChart';
import { PieChartWidget } from '@/components/dashboard/PieChart';
import { TableWidget } from '@/components/dashboard/TableWidget';

interface AiChartProps {
  data: Record<string, unknown>[];
  chartType: string;
  chartConfig: Record<string, unknown>;
}

export function AiChart({ data, chartType, chartConfig }: AiChartProps) {
  if (!data || data.length === 0) return null;

  const firstRow = data[0]!;
  const keys = Object.keys(firstRow);

  switch (chartType) {
    case 'kpi': {
      const value = Number(chartConfig.value ?? firstRow[keys[0]!] ?? 0);
      const label = String(chartConfig.label ?? keys[0] ?? 'Value');
      return <KPICard value={value} label={label} />;
    }

    case 'line': {
      const xKey = (chartConfig.xKey as string) || keys[0] || '';
      const yKeys = (chartConfig.yKeys as string[]) || [keys[1] || keys[0] || ''];
      return <LineChartWidget data={data} xKey={xKey} yKeys={yKeys} height={300} />;
    }

    case 'bar': {
      const xKey = (chartConfig.xKey as string) || keys[0] || '';
      const yKeys = (chartConfig.yKeys as string[]) || [keys[1] || keys[0] || ''];
      return <BarChartWidget data={data} xKey={xKey} yKeys={yKeys} height={300} />;
    }

    case 'pie': {
      const nameKey = (chartConfig.nameKey as string) || keys[0] || '';
      const valueKey = (chartConfig.valueKey as string) || keys[1] || keys[0] || '';
      const pieData = data.map((row) => ({
        name: String(row[nameKey] ?? ''),
        value: Number(row[valueKey] ?? 0),
      }));
      return <PieChartWidget data={pieData} height={300} />;
    }

    case 'table':
    default:
      return <TableWidget data={data} height={Math.min(400, 60 + data.length * 40)} />;
  }
}
