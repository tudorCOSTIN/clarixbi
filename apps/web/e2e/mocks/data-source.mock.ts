export const mockDataSources = [
  {
    id: 'ds-uuid-1',
    type: 'smartbill',
    name: 'SmartBill Production',
    status: 'active',
    last_sync_at: '2026-03-24T08:00:00Z',
    total_rows: 15420,
    created_at: '2026-01-10T09:00:00Z',
  },
  {
    id: 'ds-uuid-2',
    type: 'woocommerce',
    name: 'WooCommerce Store',
    status: 'syncing',
    last_sync_at: '2026-03-23T12:00:00Z',
    total_rows: 8730,
    created_at: '2026-02-15T11:00:00Z',
  },
  {
    id: 'ds-uuid-3',
    type: 'csv',
    name: 'Q1 Revenue.csv',
    status: 'error',
    last_sync_at: null,
    total_rows: 0,
    created_at: '2026-03-20T14:00:00Z',
  },
  {
    id: 'ds-uuid-4',
    type: 'demo',
    name: 'Demo Data',
    status: 'active',
    last_sync_at: '2026-03-22T09:30:00Z',
    total_rows: 5000,
    created_at: '2026-03-01T10:00:00Z',
  },
];

export const mockEmptyDataSources: never[] = [];

export const mockCreatedDataSource = {
  id: 'ds-new-uuid',
  type: 'smartbill',
  name: 'SmartBill Test',
  status: 'active',
  last_sync_at: null,
  total_rows: 0,
  created_at: '2026-03-25T10:00:00Z',
};
