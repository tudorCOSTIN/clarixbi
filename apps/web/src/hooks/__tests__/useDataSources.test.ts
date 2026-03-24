import { renderHook, act, waitFor } from '@testing-library/react';

const mockApiClient = jest.fn();
jest.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mockApiClient(...args),
}));

import { useDataSources } from '../useDataSources';

const mockSource = {
  id: 'ds-1',
  type: 'smartbill',
  name: 'SmartBill Production',
  status: 'active' as const,
  last_sync_at: '2026-03-20T12:00:00Z',
  total_rows: 1500,
  created_at: '2026-03-01T00:00:00Z',
};

const mockSource2 = {
  id: 'ds-2',
  type: 'woocommerce',
  name: 'WooCommerce Store',
  status: 'syncing' as const,
  last_sync_at: null,
  total_rows: 0,
  created_at: '2026-03-02T00:00:00Z',
};

describe('useDataSources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches data sources on mount', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockSource, mockSource2] });

    const { result } = renderHook(() => useDataSources());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data[0]!.name).toBe('SmartBill Production');
    expect(mockApiClient).toHaveBeenCalledWith('/organizations/current/data-sources');
  });

  it('triggers sync for a data source', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockSource] });

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

  it('removes a data source from local state', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockSource, mockSource2] });

    const { result } = renderHook(() => useDataSources());

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });

    mockApiClient.mockResolvedValueOnce(undefined);

    await act(async () => {
      await result.current.remove('ds-1');
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0]!.id).toBe('ds-2');
  });

  it('sets error state when fetch fails', async () => {
    mockApiClient.mockRejectedValueOnce(new Error('Connection failed'));

    const { result } = renderHook(() => useDataSources());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Connection failed');
    expect(result.current.data).toHaveLength(0);
  });

  it('refetch re-triggers GET request', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockSource] });

    const { result } = renderHook(() => useDataSources());

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    mockApiClient.mockResolvedValueOnce({ data: [mockSource, mockSource2] });

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.data).toHaveLength(2);
  });
});
