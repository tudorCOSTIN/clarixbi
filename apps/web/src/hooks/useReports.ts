'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useOrgStore } from '@/stores/org-store';

interface Report {
  id: string;
  name: string;
  description: string | null;
  dashboard_id: string;
  dashboard?: { name: string };
  config: { widgetIds?: string[]; generatedFiles?: { url: string; generatedAt: string }[] };
  schedules?: {
    id: string;
    cron_expression: string;
    recipients: string[];
    is_active: boolean;
    next_run_at: string;
  }[];
  created_at: string;
  updated_at: string;
}

interface CreateReportDto {
  name: string;
  dashboardId: string;
  widgetIds: string[];
  description?: string;
}

interface ScheduleDto {
  frequency: string;
  recipients: string[];
  timezone: string;
}

interface UseReportsReturn {
  data: Report[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  create: (dto: CreateReportDto) => Promise<void>;
  generate: (id: string) => Promise<void>;
  download: (id: string) => Promise<string | null>;
  schedule: (reportId: string, dto: ScheduleDto) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useReports(): UseReportsReturn {
  const { currentOrgId } = useOrgStore();
  const [data, setData] = useState<Report[]>([]);
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
      const res = await apiClient<{ data: Report[] }>(`/organizations/${currentOrgId}/reports`);
      setData(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const create = useCallback(
    async (dto: CreateReportDto) => {
      if (!currentOrgId) return;
      await apiClient(`/organizations/${currentOrgId}/reports`, {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      await fetch();
    },
    [currentOrgId, fetch],
  );

  const generate = useCallback(
    async (id: string) => {
      if (!currentOrgId) return;
      await apiClient(`/organizations/${currentOrgId}/reports/${id}/generate`, { method: 'POST' });
    },
    [currentOrgId],
  );

  const download = useCallback(
    async (id: string): Promise<string | null> => {
      if (!currentOrgId) return null;
      const res = await apiClient<{ data: { url: string } }>(
        `/organizations/${currentOrgId}/reports/${id}/download`,
      );
      return res.data?.url ?? null;
    },
    [currentOrgId],
  );

  const schedule = useCallback(
    async (reportId: string, dto: ScheduleDto) => {
      if (!currentOrgId) return;
      await apiClient(`/organizations/${currentOrgId}/reports/${reportId}/schedule`, {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      await fetch();
    },
    [currentOrgId, fetch],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!currentOrgId) return;
      await apiClient(`/organizations/${currentOrgId}/reports/${id}`, { method: 'DELETE' });
      setData((prev) => prev.filter((r) => r.id !== id));
    },
    [currentOrgId],
  );

  return { data, loading, error, refetch: fetch, create, generate, download, schedule, remove };
}
