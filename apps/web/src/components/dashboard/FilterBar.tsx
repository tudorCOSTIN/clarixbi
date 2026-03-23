'use client';

import { useQueryState } from 'nuqs';
import { Calendar, Database, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DATE_PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7d', value: '7d' },
  { label: 'Last 30d', value: '30d' },
  { label: 'Last 90d', value: '90d' },
  { label: 'Last 1y', value: '1y' },
] as const;

interface DataSourceOption {
  id: string;
  name: string;
}

interface FilterBarProps {
  dataSources?: DataSourceOption[];
  onFiltersChange?: (filters: { dateRange: string; source: string }) => void;
}

export function FilterBar({ dataSources = [], onFiltersChange }: FilterBarProps) {
  const [dateRange, setDateRange] = useQueryState('dateRange', { defaultValue: '30d' });
  const [source, setSource] = useQueryState('source', { defaultValue: 'all' });

  const handleDateChange = (value: string) => {
    setDateRange(value);
    onFiltersChange?.({ dateRange: value, source });
  };

  const handleSourceChange = (value: string) => {
    setSource(value);
    onFiltersChange?.({ dateRange, source: value });
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200">
      <div className="flex items-center gap-1.5 text-sm text-gray-500">
        <Calendar className="h-4 w-4" />
        <span className="font-medium">Period:</span>
      </div>
      <div className="flex gap-1">
        {DATE_PRESETS.map(({ label, value }) => (
          <button
            key={value}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              dateRange === value
                ? 'bg-primary-blue text-white'
                : 'text-gray-600 hover:bg-gray-100',
            )}
            onClick={() => handleDateChange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="h-5 w-px bg-gray-200" />

      <div className="flex items-center gap-1.5 text-sm text-gray-500">
        <Database className="h-4 w-4" />
        <span className="font-medium">Source:</span>
      </div>
      <select
        className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-blue"
        value={source}
        onChange={(e) => handleSourceChange(e.target.value)}
        aria-label="Filter by data source"
      >
        <option value="all">All Sources</option>
        {dataSources.map((ds) => (
          <option key={ds.id} value={ds.id}>
            {ds.name}
          </option>
        ))}
      </select>

      <Button variant="ghost" size="sm" onClick={copyUrl} className="ml-auto text-xs gap-1">
        <Link2 className="h-3.5 w-3.5" />
        Copy Link
      </Button>
    </div>
  );
}
