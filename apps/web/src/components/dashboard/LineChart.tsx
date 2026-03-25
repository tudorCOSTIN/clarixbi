'use client';

import {
  ResponsiveContainer,
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
} from 'recharts';
import { CHART_COLORS, type ChartColorScheme } from '@/lib/chart-colors';

interface LineChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  yKeys: string[];
  colorScheme?: ChartColorScheme;
  smooth?: boolean;
  showArea?: boolean;
  height?: number;
}

export function LineChartWidget({
  data,
  xKey,
  yKeys,
  colorScheme = 'primary',
  smooth = true,
  showArea = false,
  height = 300,
}: LineChartProps) {
  const colors = CHART_COLORS[colorScheme];

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-500" style={{ height }}>
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLine data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          }}
        />
        {yKeys.map((key, i) => (
          <Line
            key={key}
            type={smooth ? 'monotone' : 'linear'}
            dataKey={key}
            stroke={colors[i % colors.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
            fill={showArea ? colors[i % colors.length] : undefined}
          />
        ))}
        {data.length > 20 && <Brush dataKey={xKey} height={20} stroke="#1565C0" />}
      </RechartsLine>
    </ResponsiveContainer>
  );
}
