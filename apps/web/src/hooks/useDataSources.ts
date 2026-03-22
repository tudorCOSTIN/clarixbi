'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

interface DataSource {
  id: string;
  type: string;
  name: string;
  status: 'active' | 'syncing' | 'error' | 'disconnected';
  last_sync_at: string | null;
  total_rows: number;
  created_at: string;
}

interface UseDataSourcesReturn {
  data: DataSource[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  triggerSync: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useDataSources(): UseDataSourcesReturn {
  const [data, setData] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient<{ data: DataSource[] }>('/organizations/current/data-sources');
      setData(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data sources');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const triggerSync = useCallback(async (id: string) => {
    await apiClient(`/organizations/current/data-sources/${id}/sync`, { method: 'POST' });
  }, []);

  const remove = useCallback(async (id: string) => {
    await apiClient(`/organizations/current/data-sources/${id}`, { method: 'DELETE' });
    setData((prev) => prev.filter((ds) => ds.id !== id));
  }, []);

  return { data, loading, error, refetch: fetch, triggerSync, remove };
}
