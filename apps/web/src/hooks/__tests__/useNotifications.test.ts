import { renderHook, act, waitFor } from '@testing-library/react';

const mockApiClient = jest.fn();
jest.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mockApiClient(...args),
}));

jest.mock('@/stores/org-store', () => ({
  useOrgStore: () => ({ currentOrgId: 'org-1' }),
}));

import { useNotifications } from '../useNotifications';

const mockNotification = {
  id: 'notif-1',
  type: 'alert',
  title: 'Alert triggered',
  message: 'Revenue dropped below threshold',
  is_read: false,
  link_url: '/alerts/alert-1',
  created_at: '2026-03-20T10:00:00Z',
};

const mockNotification2 = {
  id: 'notif-2',
  type: 'report',
  title: 'Report ready',
  message: 'Monthly report has been generated',
  is_read: true,
  link_url: null,
  created_at: '2026-03-19T08:00:00Z',
};

const mockMeta = {
  page: 1,
  limit: 20,
  total: 2,
  unreadCount: 1,
};

describe('useNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches notifications on mount', async () => {
    mockApiClient.mockResolvedValueOnce({
      data: [mockNotification, mockNotification2],
      meta: mockMeta,
    });

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.meta).toEqual(mockMeta);
  });

  it('marks a notification as read', async () => {
    mockApiClient.mockResolvedValueOnce({
      data: [mockNotification, mockNotification2],
      meta: mockMeta,
    });

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });

    mockApiClient.mockResolvedValueOnce(undefined);

    await act(async () => {
      await result.current.markRead('notif-1');
    });

    expect(result.current.data[0]!.is_read).toBe(true);
    expect(result.current.unreadCount).toBe(0);
    expect(mockApiClient).toHaveBeenCalledWith('/organizations/org-1/notifications/notif-1/read', {
      method: 'PATCH',
    });
  });

  it('marks all notifications as read', async () => {
    mockApiClient.mockResolvedValueOnce({
      data: [mockNotification, { ...mockNotification2, is_read: false }],
      meta: { ...mockMeta, unreadCount: 2 },
    });

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(2);
    });

    mockApiClient.mockResolvedValueOnce(undefined);

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(result.current.data.every((n) => n.is_read)).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it('sets error state when fetch fails', async () => {
    mockApiClient.mockRejectedValueOnce(new Error('Network timeout'));

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network timeout');
  });
});
