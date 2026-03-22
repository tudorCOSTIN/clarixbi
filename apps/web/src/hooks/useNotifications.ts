'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { useOrgStore } from '@/stores/org-store';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  link_url: string | null;
  created_at: string;
}

interface NotificationsMeta {
  page: number;
  limit: number;
  total: number;
  unreadCount: number;
}

interface UseNotificationsReturn {
  data: NotificationItem[];
  meta: NotificationsMeta | null;
  loading: boolean;
  error: string | null;
  unreadCount: number;
  refetch: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export function useNotifications(page = 1): UseNotificationsReturn {
  const { currentOrgId } = useOrgStore();
  const [data, setData] = useState<NotificationItem[]>([]);
  const [meta, setMeta] = useState<NotificationsMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!currentOrgId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient<{ data: NotificationItem[]; meta: NotificationsMeta }>(
        `/organizations/${currentOrgId}/notifications?page=${page}&limit=20`,
      );
      setData(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, page]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const markRead = useCallback(
    async (id: string) => {
      if (!currentOrgId) return;
      await apiClient(`/organizations/${currentOrgId}/notifications/${id}/read`, {
        method: 'PATCH',
      });
      setData((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setMeta((prev) =>
        prev ? { ...prev, unreadCount: Math.max(0, prev.unreadCount - 1) } : prev,
      );
    },
    [currentOrgId],
  );

  const markAllRead = useCallback(async () => {
    if (!currentOrgId) return;
    await apiClient(`/organizations/${currentOrgId}/notifications/mark-all-read`, {
      method: 'POST',
    });
    setData((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setMeta((prev) => (prev ? { ...prev, unreadCount: 0 } : prev));
  }, [currentOrgId]);

  const unreadCount = useMemo(() => meta?.unreadCount ?? 0, [meta]);

  return { data, meta, loading, error, unreadCount, refetch: fetch, markRead, markAllRead };
}
