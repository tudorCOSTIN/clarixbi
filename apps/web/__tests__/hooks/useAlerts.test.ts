const mockApiClient = jest.fn();
jest.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mockApiClient(...args),
}));
jest.mock('@/stores/org-store', () => ({
  useOrgStore: jest.fn(() => ({ currentOrgId: 'org-1' })),
}));

import { renderHook, act, waitFor } from '@testing-library/react';
import { useAlerts } from '@/hooks/useAlerts';

const mockAlert = {
  id: 'alert-1',
  name: 'High CPU',
  metric_query: 'cpu > 90',
  condition_operator: '>',
  threshold_value: 90,
  check_frequency: '5m',
  is_active: true,
  data_source_id: 'ds-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockAlert2 = {
  id: 'alert-2',
  name: 'Low Disk',
  metric_query: 'disk < 10',
  condition_operator: '<',
  threshold_value: 10,
  check_frequency: '15m',
  is_active: false,
  data_source_id: 'ds-1',
  created_at: '2026-01-02T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
};

describe('useAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches alerts on mount', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockAlert, mockAlert2] });

    const { result } = renderHook(() => useAlerts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockApiClient).toHaveBeenCalledWith('/organizations/org-1/alerts');
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data[0]!.id).toBe('alert-1');
  });

  it('handles loading state', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [] });

    const { result } = renderHook(() => useAlerts());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
  });

  it('handles fetch error', async () => {
    mockApiClient.mockRejectedValueOnce(new Error('Server down'));

    const { result } = renderHook(() => useAlerts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Server down');
  });

  it('create sends POST request and refetches', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockAlert] });

    const { result } = renderHook(() => useAlerts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // POST for create, then GET for refetch
    mockApiClient.mockResolvedValueOnce(undefined);
    mockApiClient.mockResolvedValueOnce({ data: [mockAlert, mockAlert2] });

    const dto = {
      name: 'New Alert',
      dataSourceId: 'ds-1',
      metricQuery: 'memory > 80',
      conditionOperator: '>',
      thresholdValue: 80,
      checkFrequency: '10m',
    };

    await act(async () => {
      await result.current.create(dto);
    });

    expect(mockApiClient).toHaveBeenCalledWith('/organizations/org-1/alerts', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  });

  it('toggle sends PATCH request', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockAlert] });

    const { result } = renderHook(() => useAlerts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockApiClient.mockResolvedValueOnce(undefined);

    await act(async () => {
      await result.current.toggle('alert-1', false);
    });

    expect(mockApiClient).toHaveBeenCalledWith('/organizations/org-1/alerts/alert-1/toggle', {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false }),
    });
    expect(result.current.data[0]!.is_active).toBe(false);
  });

  it('remove sends DELETE request', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockAlert, mockAlert2] });

    const { result } = renderHook(() => useAlerts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockApiClient.mockResolvedValueOnce(undefined);

    await act(async () => {
      await result.current.remove('alert-1');
    });

    expect(mockApiClient).toHaveBeenCalledWith('/organizations/org-1/alerts/alert-1', {
      method: 'DELETE',
    });
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0]!.id).toBe('alert-2');
  });

  it('test sends POST to test endpoint', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockAlert] });

    const { result } = renderHook(() => useAlerts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const testResult = { wouldTrigger: true, currentValue: 95, threshold: 90 };
    mockApiClient.mockResolvedValueOnce({ data: testResult });

    let res;
    await act(async () => {
      res = await result.current.test('alert-1');
    });

    expect(mockApiClient).toHaveBeenCalledWith('/organizations/org-1/alerts/alert-1/test', {
      method: 'POST',
    });
    expect(res).toEqual(testResult);
  });
});
