const mockApiClient = jest.fn();
jest.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mockApiClient(...args),
}));

import { renderHook, act, waitFor } from '@testing-library/react';
import { useDashboards } from '@/hooks/useDashboards';

const mockDashboard = {
  id: 'dash-1',
  name: 'Test Dashboard',
  description: null,
  is_auto_generated: false,
  created_at: '2026-01-01T00:00:00Z',
  widgets: [],
};

const mockDashboard2 = {
  id: 'dash-2',
  name: 'Second Dashboard',
  description: 'A description',
  is_auto_generated: true,
  created_at: '2026-01-02T00:00:00Z',
  widgets: [{ id: 'w1' }],
};

describe('useDashboards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches dashboards on mount', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockDashboard, mockDashboard2] });

    const { result } = renderHook(() => useDashboards());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockApiClient).toHaveBeenCalledWith('/organizations/current/dashboards');
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data[0]!.id).toBe('dash-1');
  });

  it('sets loading to false after fetch', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [] });

    const { result } = renderHook(() => useDashboards());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
  });

  it('handles fetch error', async () => {
    mockApiClient.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useDashboards());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.data).toHaveLength(0);
  });

  it('handles non-Error fetch failure', async () => {
    mockApiClient.mockRejectedValueOnce('string error');

    const { result } = renderHook(() => useDashboards());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to fetch dashboards');
  });

  it('create adds dashboard to list', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockDashboard] });

    const { result } = renderHook(() => useDashboards());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const newDash = {
      id: 'dash-new',
      name: 'New Dashboard',
      description: null,
      is_auto_generated: false,
      created_at: '2026-01-03T00:00:00Z',
      widgets: [],
    };
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

  it('clone adds cloned dashboard to list', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockDashboard] });

    const { result } = renderHook(() => useDashboards());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const cloned = {
      id: 'dash-cloned',
      name: 'Test Dashboard (copy)',
      description: null,
      is_auto_generated: false,
      created_at: '2026-01-03T00:00:00Z',
      widgets: [],
    };
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
    expect(result.current.data[0]!.id).toBe('dash-cloned');
  });

  it('remove removes dashboard from list', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockDashboard, mockDashboard2] });

    const { result } = renderHook(() => useDashboards());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockApiClient.mockResolvedValueOnce(undefined);

    await act(async () => {
      await result.current.remove('dash-1');
    });

    expect(mockApiClient).toHaveBeenCalledWith('/organizations/current/dashboards/dash-1', {
      method: 'DELETE',
    });
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0]!.id).toBe('dash-2');
  });

  it('refetch re-fetches data', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockDashboard] });

    const { result } = renderHook(() => useDashboards());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(1);

    mockApiClient.mockResolvedValueOnce({ data: [mockDashboard, mockDashboard2] });

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockApiClient).toHaveBeenCalledTimes(2);
    expect(result.current.data).toHaveLength(2);
  });
});
