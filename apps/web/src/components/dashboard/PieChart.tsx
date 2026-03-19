'use client';

import { useState } from 'react';
import { ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Tooltip, Legend } from 'recharts';

const COLOR_SCHEMES = {
  primary: ['#2196F3', '#42A5F5', '#90CAF9', '#1976D2', '#0D47A1', '#64B5F6', '#BBDEFB'],
  warm: ['#FF6B35', '#F7931E', '#FFC107', '#FF8A65', '#FFAB40', '#FFD54F', '#FFE082'],
  cool: ['#00BCD4', '#009688', '#4CAF50', '#26A69A', '#66BB6A', '#80CBC4', '#A5D6A7'],
};

interface PieChartProps {
  data: { name: string; value: number }[];
  colorScheme?: keyof typeof COLOR_SCHEMES;
  donut?: boolean;
  height?: number;
}

export function PieChartWidget({
  data,
  colorScheme = 'primary',
  donut = false,
  height = 300,
}: PieChartProps) {
  const colors = COLOR_SCHEMES[colorScheme];
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400" style={{ height }}>
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPie>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={donut ? '50%' : 0}
          outerRadius="75%"
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          onClick={(_, index) => setActiveIndex(index === activeIndex ? null : index)}
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={colors[index % colors.length]}
              opacity={activeIndex !== null && activeIndex !== index ? 0.5 : 1}
              stroke={activeIndex === index ? '#1e293b' : 'transparent'}
              strokeWidth={activeIndex === index ? 2 : 0}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </RechartsPie>
    </ResponsiveContainer>
  );
}
