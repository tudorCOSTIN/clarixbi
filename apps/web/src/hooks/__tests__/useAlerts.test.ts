import { renderHook, act, waitFor } from '@testing-library/react';

const mockApiClient = jest.fn();
jest.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mockApiClient(...args),
}));

jest.mock('@/stores/org-store', () => ({
  useOrgStore: () => ({ currentOrgId: 'org-1' }),
}));

import { useAlerts } from '../useAlerts';

const mockAlert = {
  id: 'alert-1',
  name: 'Revenue Drop',
  metric_query: 'SELECT SUM(amount) FROM invoices',
  condition_operator: 'lt',
  threshold_value: 5000,
  check_frequency: 'hourly',
  is_active: true,
  data_source_id: 'ds-1',
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
};

describe('useAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches alerts on mount', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockAlert] });

    const { result } = renderHook(() => useAlerts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0]!.name).toBe('Revenue Drop');
    expect(mockApiClient).toHaveBeenCalledWith('/organizations/org-1/alerts');
  });

  it('creates an alert and refetches', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockAlert] });

    const { result } = renderHook(() => useAlerts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const newAlert = { ...mockAlert, id: 'alert-2', name: 'New Alert' };
    mockApiClient
      .mockResolvedValueOnce(undefined) // POST create
      .mockResolvedValueOnce({ data: [mockAlert, newAlert] }); // refetch

    await act(async () => {
      await result.current.create({
        name: 'New Alert',
        dataSourceId: 'ds-1',
        metricQuery: 'SELECT COUNT(*) FROM orders',
        conditionOperator: 'gt',
        thresholdValue: 100,
        checkFrequency: 'daily',
      });
    });

    expect(mockApiClient).toHaveBeenCalledWith(
      '/organizations/org-1/alerts',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.current.data).toHaveLength(2);
  });

  it('toggles alert active state', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockAlert] });

    const { result } = renderHook(() => useAlerts());

    await waitFor(() => {
      expect(result.current.data[0]!.is_active).toBe(true);
    });

    mockApiClient.mockResolvedValueOnce(undefined);

    await act(async () => {
      await result.current.toggle('alert-1', false);
    });

    expect(result.current.data[0]!.is_active).toBe(false);
    expect(mockApiClient).toHaveBeenCalledWith(
      '/organizations/org-1/alerts/alert-1/toggle',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('deletes an alert and removes from local state', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockAlert] });

    const { result } = renderHook(() => useAlerts());

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    mockApiClient.mockResolvedValueOnce(undefined);

    await act(async () => {
      await result.current.remove('alert-1');
    });

    expect(result.current.data).toHaveLength(0);
  });

  it('sets error state when fetch fails', async () => {
    mockApiClient.mockRejectedValueOnce(new Error('Server error'));

    const { result } = renderHook(() => useAlerts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Server error');
  });
});
