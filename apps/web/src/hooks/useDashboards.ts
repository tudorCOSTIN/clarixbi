'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

interface Dashboard {
  id: string;
  name: string;
  description: string | null;
  is_auto_generated: boolean;
  created_at: string;
  widgets: { id: string }[];
}

interface UseDashboardsReturn {
  data: Dashboard[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  create: (dto: { name: string; description?: string }) => Promise<Dashboard>;
  remove: (id: string) => Promise<void>;
}

export function useDashboards(): UseDashboardsReturn {
  const [data, setData] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient<{ data: Dashboard[] }>('/organizations/current/dashboards');
      setData(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const create = useCallback(async (dto: { name: string; description?: string }) => {
    const res = await apiClient<{ data: Dashboard }>('/organizations/current/dashboards', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
    setData((prev) => [res.data, ...prev]);
    return res.data;
  }, []);

  const remove = useCallback(async (id: string) => {
    await apiClient(`/organizations/current/dashboards/${id}`, { method: 'DELETE' });
    setData((prev) => prev.filter((d) => d.id !== id));
  }, []);

  return { data, loading, error, refetch: fetch, create, remove };
}
