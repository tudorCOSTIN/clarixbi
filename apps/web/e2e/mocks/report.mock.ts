export const mockReports = [
  {
    id: 'report-uuid-1',
    name: 'Monthly Sales Report',
    description: 'Monthly sales metrics and KPIs',
    dashboard_id: 'dash-1',
    dashboard: { name: 'Sales Overview' },
    config: {
      widgetIds: ['w-1', 'w-2'],
      generatedFiles: [
        { url: 'https://storage.example.com/report-1.pdf', generatedAt: '2026-03-01T00:00:00Z' },
      ],
    },
    schedules: [
      {
        id: 'sched-1',
        cron_expression: '0 8 1 * *',
        recipients: ['admin@test.clarixbi.com'],
        is_active: true,
        next_run_at: '2026-04-01T08:00:00Z',
      },
    ],
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'report-uuid-2',
    name: 'Weekly Inventory',
    description: null,
    dashboard_id: 'dash-2',
    dashboard: { name: 'Inventory Dashboard' },
    config: { widgetIds: ['w-3'], generatedFiles: [] },
    schedules: [],
    created_at: '2026-03-10T08:00:00Z',
    updated_at: '2026-03-10T08:00:00Z',
  },
];

export const mockDashboards = [
  {
    id: 'dash-1',
    name: 'Sales Overview',
    widgets: [
      { id: 'w-1', title: 'Revenue KPI' },
      { id: 'w-2', title: 'Revenue Trend' },
    ],
  },
  {
    id: 'dash-2',
    name: 'Inventory Dashboard',
    widgets: [{ id: 'w-3', title: 'Stock Levels' }],
  },
];
