import { renderHook, act, waitFor } from '@testing-library/react';

const mockApiClient = jest.fn();
jest.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mockApiClient(...args),
}));

jest.mock('@/stores/org-store', () => ({
  useOrgStore: () => ({ currentOrgId: 'org-1' }),
}));

import { useReports } from '../useReports';

const mockReport = {
  id: 'report-1',
  name: 'Monthly Sales Report',
  description: 'Sales overview for March',
  dashboard_id: 'dash-1',
  dashboard: { name: 'Sales Dashboard' },
  config: { widgetIds: ['w-1', 'w-2'] },
  schedules: [],
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
};

describe('useReports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches reports on mount', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockReport] });

    const { result } = renderHook(() => useReports());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0]!.name).toBe('Monthly Sales Report');
    expect(mockApiClient).toHaveBeenCalledWith('/organizations/org-1/reports');
  });

  it('creates a report and refetches', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockReport] });

    const { result } = renderHook(() => useReports());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockApiClient
      .mockResolvedValueOnce(undefined) // POST
      .mockResolvedValueOnce({ data: [mockReport, { ...mockReport, id: 'report-2' }] });

    await act(async () => {
      await result.current.create({
        name: 'New Report',
        dashboardId: 'dash-1',
        widgetIds: ['w-1'],
      });
    });

    expect(mockApiClient).toHaveBeenCalledWith(
      '/organizations/org-1/reports',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.current.data).toHaveLength(2);
  });

  it('schedules a report', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockReport] });

    const { result } = renderHook(() => useReports());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockApiClient
      .mockResolvedValueOnce(undefined) // POST schedule
      .mockResolvedValueOnce({ data: [mockReport] }); // refetch

    await act(async () => {
      await result.current.schedule('report-1', {
        frequency: 'weekly',
        recipients: ['test@example.com'],
        timezone: 'Europe/Bucharest',
      });
    });

    expect(mockApiClient).toHaveBeenCalledWith(
      '/organizations/org-1/reports/report-1/schedule',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('removes a report from local state', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockReport] });

    const { result } = renderHook(() => useReports());

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    mockApiClient.mockResolvedValueOnce(undefined);

    await act(async () => {
      await result.current.remove('report-1');
    });

    expect(result.current.data).toHaveLength(0);
  });

  it('sets error state when fetch fails', async () => {
    mockApiClient.mockRejectedValueOnce(new Error('Failed to load'));

    const { result } = renderHook(() => useReports());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load');
  });
});
