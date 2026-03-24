import { renderHook, act, waitFor } from '@testing-library/react';

const mockApiClient = jest.fn();
jest.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mockApiClient(...args),
}));

import { useDashboards } from '../useDashboards';

const mockDashboard = {
  id: 'dash-1',
  name: 'Sales Dashboard',
  description: 'Revenue overview',
  is_auto_generated: false,
  created_at: '2026-03-01T00:00:00Z',
  widgets: [{ id: 'w-1' }],
};

const mockDashboard2 = {
  id: 'dash-2',
  name: 'Marketing Dashboard',
  description: null,
  is_auto_generated: true,
  created_at: '2026-03-02T00:00:00Z',
  widgets: [],
};

describe('useDashboards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches dashboards on mount', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockDashboard, mockDashboard2] });

    const { result } = renderHook(() => useDashboards());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data[0]!.name).toBe('Sales Dashboard');
    expect(result.current.error).toBeNull();
    expect(mockApiClient).toHaveBeenCalledWith('/organizations/current/dashboards');
  });

  it('sets error state when fetch fails', async () => {
    mockApiClient.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useDashboards());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.data).toHaveLength(0);
  });

  it('creates a dashboard and prepends to list', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockDashboard] });

    const { result } = renderHook(() => useDashboards());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const newDash = { ...mockDashboard2, id: 'dash-new' };
    mockApiClient.mockResolvedValueOnce({ data: newDash });

    await act(async () => {
      const created = await result.current.create({ name: 'New Dashboard' });
      expect(created.id).toBe('dash-new');
    });

    expect(mockApiClient).toHaveBeenCalledWith('/organizations/current/dashboards', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Dashboard' }),
    });
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data[0]!.id).toBe('dash-new');
  });

  it('removes a dashboard from local state', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockDashboard, mockDashboard2] });

    const { result } = renderHook(() => useDashboards());

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });

    mockApiClient.mockResolvedValueOnce(undefined);

    await act(async () => {
      await result.current.remove('dash-1');
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0]!.id).toBe('dash-2');
  });

  it('clones a dashboard and prepends to list', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockDashboard] });

    const { result } = renderHook(() => useDashboards());

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    const cloned = { ...mockDashboard, id: 'dash-cloned', name: 'Sales Dashboard (Copy)' };
    mockApiClient.mockResolvedValueOnce({ data: cloned });

    await act(async () => {
      const res = await result.current.clone('dash-1');
      expect(res.id).toBe('dash-cloned');
    });

    expect(mockApiClient).toHaveBeenCalledWith(
      '/organizations/current/dashboards/dash-1/duplicate',
      { method: 'POST' },
    );
    expect(result.current.data).toHaveLength(2);
  });

  it('refetch re-triggers GET request', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockDashboard] });

    const { result } = renderHook(() => useDashboards());

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    mockApiClient.mockResolvedValueOnce({ data: [mockDashboard, mockDashboard2] });

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.data).toHaveLength(2);
  });
});
