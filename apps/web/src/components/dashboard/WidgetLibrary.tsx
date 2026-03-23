'use client';

import { useState } from 'react';
import {
  TrendingUp,
  BarChart3,
  PieChart,
  Table,
  Hash,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const WIDGET_TYPES = [
  { type: 'line', label: 'Line Chart', icon: TrendingUp, defaultSize: { w: 6, h: 4 } },
  { type: 'bar', label: 'Bar Chart', icon: BarChart3, defaultSize: { w: 6, h: 4 } },
  { type: 'pie', label: 'Pie Chart', icon: PieChart, defaultSize: { w: 4, h: 4 } },
  { type: 'table', label: 'Table', icon: Table, defaultSize: { w: 6, h: 5 } },
  { type: 'kpi', label: 'KPI Card', icon: Hash, defaultSize: { w: 3, h: 2 } },
] as const;

interface WidgetLibraryProps {
  onAddWidget: (type: string, defaultSize: { w: number; h: number }) => void;
}

export function WidgetLibrary({ onAddWidget }: WidgetLibraryProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={cn(
        'border-r border-gray-200 bg-white transition-all duration-200 flex flex-col',
        collapsed ? 'w-12' : 'w-56',
      )}
    >
      <div className="flex items-center justify-between p-3 border-b border-gray-100">
        {!collapsed && <span className="text-sm font-semibold text-gray-700">Widgets</span>}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {WIDGET_TYPES.map(({ type, label, icon: Icon, defaultSize }) => (
          <div
            key={type}
            className={cn(
              'flex items-center gap-2.5 rounded-md border border-gray-200 bg-gray-50 cursor-grab active:cursor-grabbing hover:border-primary-blue hover:bg-blue-50 transition-colors',
              collapsed ? 'p-2 justify-center' : 'px-3 py-2.5',
            )}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('widget-type', type);
              e.dataTransfer.setData('widget-w', String(defaultSize.w));
              e.dataTransfer.setData('widget-h', String(defaultSize.h));
            }}
            onClick={() => onAddWidget(type, defaultSize)}
            title={collapsed ? label : undefined}
          >
            <Icon className="h-4 w-4 text-primary-blue flex-shrink-0" />
            {!collapsed && <span className="text-sm text-gray-700">{label}</span>}
          </div>
        ))}
      </div>
      {!collapsed && (
        <div className="p-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">Drag or click to add</p>
        </div>
      )}
    </div>
  );
}
