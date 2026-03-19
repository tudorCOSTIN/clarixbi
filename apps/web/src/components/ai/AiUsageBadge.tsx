'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface UsageData {
  used: number;
  limit: number;
  percentage: number;
}

export function AiUsageBadge() {
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const orgId = getOrgId();
        if (!orgId) return;
        const res = await apiClient<{ data: UsageData }>(`/organizations/${orgId}/ai/usage`);
        setUsage(res.data);
      } catch {
        // ignore
      }
    };
    fetchUsage();
  }, []);

  if (!usage) return null;

  const colorClass =
    usage.percentage > 90
      ? 'text-red-600 bg-red-50'
      : usage.percentage > 70
        ? 'text-amber-600 bg-amber-50'
        : 'text-green-600 bg-green-50';

  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${colorClass}`}>
      {usage.used}/{usage.limit}
    </span>
  );
}

function getOrgId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('clarixbi-org-store');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.state?.currentOrgId || null;
    }
  } catch {
    // ignore
  }
  return null;
}
