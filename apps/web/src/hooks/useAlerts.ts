'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useOrgStore } from '@/stores/org-store';

interface Alert {
  id: string;
  name: string;
  metric_query: string;
  condition_operator: string;
  threshold_value: number;
  check_frequency: string;
  is_active: boolean;
  data_source_id: string;
  created_at: string;
  updated_at: string;
}

interface CreateAlertDto {
  name: string;
  dataSourceId: string;
  metricQuery: string;
  conditionOperator: string;
  thresholdValue: number;
  checkFrequency: string;
}

interface UseAlertsReturn {
  data: Alert[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  create: (dto: CreateAlertDto) => Promise<void>;
  toggle: (id: string, isActive: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useAlerts(): UseAlertsReturn {
  const { currentOrgId } = useOrgStore();
  const [data, setData] = useState<Alert[]>([]);
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
      const res = await apiClient<{ data: Alert[] }>(`/organizations/${currentOrgId}/alerts`);
      setData(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const create = useCallback(
    async (dto: CreateAlertDto) => {
      if (!currentOrgId) return;
      await apiClient(`/organizations/${currentOrgId}/alerts`, {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      await fetch();
    },
    [currentOrgId, fetch],
  );

  const toggle = useCallback(
    async (id: string, isActive: boolean) => {
      if (!currentOrgId) return;
      await apiClient(`/organizations/${currentOrgId}/alerts/${id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      });
      setData((prev) => prev.map((a) => (a.id === id ? { ...a, is_active: isActive } : a)));
    },
    [currentOrgId],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!currentOrgId) return;
      await apiClient(`/organizations/${currentOrgId}/alerts/${id}`, { method: 'DELETE' });
      setData((prev) => prev.filter((a) => a.id !== id));
    },
    [currentOrgId],
  );

  return { data, loading, error, refetch: fetch, create, toggle, remove };
}
