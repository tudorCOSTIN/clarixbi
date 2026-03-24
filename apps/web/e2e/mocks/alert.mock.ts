export const mockAlerts = [
  {
    id: 'alert-uuid-1',
    name: 'Revenue Drop Alert',
    metric_query:
      "SELECT SUM(total_amount) FROM invoices WHERE org_id = '{orgId}' AND status = 'unpaid'",
    condition_operator: 'lt',
    threshold_value: 1000,
    check_frequency: 'hourly',
    is_active: true,
    data_source_id: 'ds-1',
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-20T14:00:00Z',
  },
  {
    id: 'alert-uuid-2',
    name: 'Low Stock Alert',
    metric_query: "SELECT COUNT(*) FROM products WHERE stock < 10 AND org_id = '{orgId}'",
    condition_operator: 'gt',
    threshold_value: 10,
    check_frequency: 'daily',
    is_active: false,
    data_source_id: 'ds-1',
    created_at: '2026-03-10T08:00:00Z',
    updated_at: '2026-03-15T12:00:00Z',
  },
];

export const mockAlertTriggers = [
  {
    id: 'trigger-1',
    triggered_at: '2026-03-20T14:00:00Z',
    metric_value: 850,
    threshold_value: 1000,
    notified_via: ['email', 'in_app'],
  },
  {
    id: 'trigger-2',
    triggered_at: '2026-03-19T10:00:00Z',
    metric_value: 920,
    threshold_value: 1000,
    notified_via: ['email'],
  },
];

export const mockDataSources = [
  { id: 'ds-1', name: 'SmartBill Production', type: 'smartbill' },
  { id: 'ds-2', name: 'Demo Data', type: 'demo' },
];

export const mockTestResult = {
  wouldTrigger: true,
  currentValue: 850,
  threshold: 1000,
};
