'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useOrgStore } from '@/stores/org-store';

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  default_timezone: string;
  default_language: string;
  member_count?: number;
}

interface UseOrganizationReturn {
  data: Organization | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOrganization(): UseOrganizationReturn {
  const { currentOrgId } = useOrgStore();
  const [data, setData] = useState<Organization | null>(null);
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
      const res = await apiClient<{ data: Organization }>(`/organizations/${currentOrgId}`);
      setData(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch organization');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
