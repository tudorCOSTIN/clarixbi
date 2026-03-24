const mockApiClient = jest.fn();
jest.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mockApiClient(...args),
}));
jest.mock('@/stores/org-store', () => ({
  useOrgStore: jest.fn(() => ({ currentOrgId: 'org-1' })),
}));

import { renderHook, act, waitFor } from '@testing-library/react';
import { useReports } from '@/hooks/useReports';

const mockReport = {
  id: 'report-1',
  name: 'Monthly Sales',
  description: 'Sales report for the month',
  dashboard_id: 'dash-1',
  dashboard: { name: 'Sales Dashboard' },
  config: { widgetIds: ['w1', 'w2'] },
  schedules: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockReport2 = {
  id: 'report-2',
  name: 'Weekly KPIs',
  description: null,
  dashboard_id: 'dash-2',
  config: { widgetIds: ['w3'] },
  schedules: [],
  created_at: '2026-01-02T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
};

describe('useReports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches reports on mount', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockReport, mockReport2] });

    const { result } = renderHook(() => useReports());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockApiClient).toHaveBeenCalledWith('/organizations/org-1/reports');
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data[0]!.name).toBe('Monthly Sales');
  });

  it('handles fetch error', async () => {
    mockApiClient.mockRejectedValueOnce(new Error('Forbidden'));

    const { result } = renderHook(() => useReports());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Forbidden');
  });

  it('create sends POST request and refetches', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockReport] });

    const { result } = renderHook(() => useReports());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // POST for create, then GET for refetch
    mockApiClient.mockResolvedValueOnce(undefined);
    mockApiClient.mockResolvedValueOnce({ data: [mockReport, mockReport2] });

    const dto = {
      name: 'New Report',
      dashboardId: 'dash-1',
      widgetIds: ['w1'],
    };

    await act(async () => {
      await result.current.create(dto);
    });

    expect(mockApiClient).toHaveBeenCalledWith('/organizations/org-1/reports', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  });

  it('generate sends POST to generate endpoint', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockReport] });

    const { result } = renderHook(() => useReports());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockApiClient.mockResolvedValueOnce(undefined);

    await act(async () => {
      await result.current.generate('report-1');
    });

    expect(mockApiClient).toHaveBeenCalledWith('/organizations/org-1/reports/report-1/generate', {
      method: 'POST',
    });
  });

  it('remove sends DELETE and updates list', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockReport, mockReport2] });

    const { result } = renderHook(() => useReports());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockApiClient.mockResolvedValueOnce(undefined);

    await act(async () => {
      await result.current.remove('report-1');
    });

    expect(mockApiClient).toHaveBeenCalledWith('/organizations/org-1/reports/report-1', {
      method: 'DELETE',
    });
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0]!.id).toBe('report-2');
  });

  it('download returns URL from API', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockReport] });

    const { result } = renderHook(() => useReports());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockApiClient.mockResolvedValueOnce({ data: { url: 'https://cdn.example.com/report.pdf' } });

    let url: string | null = null;
    await act(async () => {
      url = await result.current.download('report-1');
    });

    expect(url).toBe('https://cdn.example.com/report.pdf');
    expect(mockApiClient).toHaveBeenCalledWith('/organizations/org-1/reports/report-1/download');
  });
});
