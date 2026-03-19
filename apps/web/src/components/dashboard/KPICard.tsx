'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import CountUp from 'react-countup';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

interface KPICardProps {
  value: number;
  previousValue?: number;
  label: string;
  prefix?: string;
  suffix?: string;
  sparklineData?: { value: number }[];
  colorScheme?: 'primary' | 'warm' | 'cool';
}

export function KPICard({
  value,
  previousValue,
  label,
  prefix = '',
  suffix = '',
  sparklineData,
  colorScheme = 'primary',
}: KPICardProps) {
  const change =
    previousValue && previousValue > 0 ? ((value - previousValue) / previousValue) * 100 : null;

  const trendColor =
    change === null
      ? 'text-gray-400'
      : change > 0
        ? 'text-green-600'
        : change < 0
          ? 'text-red-600'
          : 'text-gray-400';
  const TrendIcon =
    change === null || change === 0 ? Minus : change > 0 ? TrendingUp : TrendingDown;

  const sparklineColor =
    colorScheme === 'warm' ? '#FF6B35' : colorScheme === 'cool' ? '#00BCD4' : '#2196F3';

  return (
    <div className="flex flex-col justify-between h-full p-1">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{label}</p>
      <div className="flex items-end justify-between mt-1">
        <div>
          <p className="text-2xl font-bold text-gray-900">
            {prefix}
            <CountUp end={value} duration={1.5} separator="," decimals={value % 1 !== 0 ? 2 : 0} />
            {suffix}
          </p>
          {change !== null && (
            <div className={`flex items-center gap-1 mt-0.5 ${trendColor}`}>
              <TrendIcon className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{Math.abs(change).toFixed(1)}%</span>
              <span className="text-xs text-gray-400">vs prev</span>
            </div>
          )}
        </div>
        {sparklineData && sparklineData.length > 1 && (
          <div className="w-20 h-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={sparklineColor}
                  fill={sparklineColor}
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
