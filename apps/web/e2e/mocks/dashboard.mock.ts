export const mockDashboards = [
  {
    id: 'dash-uuid-1',
    name: 'Sales Overview',
    description: 'Monthly sales metrics and KPIs',
    is_auto_generated: false,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-03-20T14:30:00Z',
    widgets: [
      { id: 'w-1', type: 'kpi', title: 'Total Revenue' },
      { id: 'w-2', type: 'bar_chart', title: 'Monthly Sales' },
    ],
  },
  {
    id: 'dash-uuid-2',
    name: 'Inventory Tracker',
    description: 'Stock levels and alerts',
    is_auto_generated: true,
    created_at: '2026-02-01T08:00:00Z',
    updated_at: '2026-03-18T09:15:00Z',
    widgets: [{ id: 'w-3', type: 'table', title: 'Products' }],
  },
  {
    id: 'dash-uuid-3',
    name: 'WooCommerce Analytics',
    description: null,
    is_auto_generated: true,
    created_at: '2026-03-01T12:00:00Z',
    updated_at: '2026-03-24T16:00:00Z',
    widgets: [],
  },
];

export const mockSingleDashboard = {
  id: 'dash-uuid-1',
  name: 'Sales Overview',
  description: 'Monthly sales metrics and KPIs',
  is_auto_generated: false,
  share_token: null,
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-03-20T14:30:00Z',
  widgets: [
    {
      id: 'w-1',
      type: 'kpi',
      title: 'Total Revenue',
      config: { metric: 'sum', field: 'amount' },
      position: { x: 0, y: 0, w: 4, h: 2 },
    },
    {
      id: 'w-2',
      type: 'bar_chart',
      title: 'Monthly Sales',
      config: { xAxis: 'month', yAxis: 'total' },
      position: { x: 4, y: 0, w: 8, h: 4 },
    },
  ],
};

export const mockSharedDashboard = {
  id: 'dash-uuid-2',
  name: 'Inventory Tracker',
  share_token: 'share-token-abc123',
  widgets: [{ id: 'w-3', type: 'table', title: 'Products' }],
};

export const mockCreatedDashboard = {
  id: 'dash-new-uuid',
  name: 'New Dashboard',
  description: 'Created via E2E test',
  is_auto_generated: false,
  created_at: '2026-03-25T10:00:00Z',
  updated_at: '2026-03-25T10:00:00Z',
  widgets: [],
};

export const mockClonedDashboard = {
  id: 'dash-clone-uuid',
  name: 'Sales Overview (Copy)',
  description: 'Monthly sales metrics and KPIs',
  is_auto_generated: false,
  created_at: '2026-03-25T10:01:00Z',
  updated_at: '2026-03-25T10:01:00Z',
  widgets: [],
};
