const mockApiClient = jest.fn();
jest.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mockApiClient(...args),
}));

import { renderHook, act, waitFor } from '@testing-library/react';
import { useDataSources } from '@/hooks/useDataSources';

const mockDataSource = {
  id: 'ds-1',
  type: 'postgresql',
  name: 'Production DB',
  status: 'active' as const,
  last_sync_at: '2026-01-01T00:00:00Z',
  total_rows: 50000,
  created_at: '2025-12-01T00:00:00Z',
};

const mockDataSource2 = {
  id: 'ds-2',
  type: 'mysql',
  name: 'Analytics DB',
  status: 'syncing' as const,
  last_sync_at: null,
  total_rows: 0,
  created_at: '2026-01-01T00:00:00Z',
};

describe('useDataSources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches data sources on mount', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockDataSource, mockDataSource2] });

    const { result } = renderHook(() => useDataSources());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockApiClient).toHaveBeenCalledWith('/organizations/current/data-sources');
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data[0]!.name).toBe('Production DB');
  });

  it('sets loading to false and error on failure', async () => {
    mockApiClient.mockRejectedValueOnce(new Error('Connection refused'));

    const { result } = renderHook(() => useDataSources());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Connection refused');
    expect(result.current.data).toHaveLength(0);
  });

  it('triggerSync calls API with correct endpoint', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockDataSource] });

    const { result } = renderHook(() => useDataSources());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockApiClient.mockResolvedValueOnce(undefined);

    await act(async () => {
      await result.current.triggerSync('ds-1');
    });

    expect(mockApiClient).toHaveBeenCalledWith('/organizations/current/data-sources/ds-1/sync', {
      method: 'POST',
    });
  });

  it('remove sends DELETE and updates list', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockDataSource, mockDataSource2] });

    const { result } = renderHook(() => useDataSources());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockApiClient.mockResolvedValueOnce(undefined);

    await act(async () => {
      await result.current.remove('ds-1');
    });

    expect(mockApiClient).toHaveBeenCalledWith('/organizations/current/data-sources/ds-1', {
      method: 'DELETE',
    });
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0]!.id).toBe('ds-2');
  });

  it('refetch re-fetches data', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockDataSource] });

    const { result } = renderHook(() => useDataSources());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockApiClient.mockResolvedValueOnce({ data: [mockDataSource, mockDataSource2] });

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.data).toHaveLength(2);
    expect(mockApiClient).toHaveBeenCalledTimes(2);
  });
});
