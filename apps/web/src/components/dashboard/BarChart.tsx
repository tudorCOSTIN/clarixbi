'use client';

import {
  ResponsiveContainer,
  BarChart as RechartsBar,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

const COLOR_SCHEMES = {
  primary: ['#2196F3', '#42A5F5', '#90CAF9', '#1976D2', '#0D47A1'],
  warm: ['#FF6B35', '#F7931E', '#FFC107', '#FF8A65', '#FFAB40'],
  cool: ['#00BCD4', '#009688', '#4CAF50', '#26A69A', '#66BB6A'],
};

interface BarChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  yKeys: string[];
  colorScheme?: keyof typeof COLOR_SCHEMES;
  horizontal?: boolean;
  gradient?: boolean;
  height?: number;
}

export function BarChartWidget({
  data,
  xKey,
  yKeys,
  colorScheme = 'primary',
  horizontal = false,
  gradient = true,
  height = 300,
}: BarChartProps) {
  const colors = COLOR_SCHEMES[colorScheme];

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400" style={{ height }}>
        No data available
      </div>
    );
  }

  const ChartComponent = RechartsBar;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ChartComponent
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis
              dataKey={xKey}
              type="category"
              tick={{ fontSize: 12 }}
              stroke="#94a3b8"
              width={80}
            />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          </>
        )}
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          }}
        />
        {yKeys.map((key, i) => (
          <Bar key={key} dataKey={key} radius={[4, 4, 0, 0]} maxBarSize={50}>
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={gradient ? colors[index % colors.length] : colors[i % colors.length]}
              />
            ))}
          </Bar>
        ))}
      </ChartComponent>
    </ResponsiveContainer>
  );
}
