'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface UsageData {
  used: number;
  limit: number;
  percentage: number;
  tier: string;
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
    // Refresh every 60 seconds
    const interval = setInterval(fetchUsage, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!usage) return null;

  const colorClass =
    usage.percentage > 85
      ? 'text-red-600'
      : usage.percentage > 70
        ? 'text-amber-600'
        : 'text-green-600';

  const barColor =
    usage.percentage > 85 ? 'bg-red-500' : usage.percentage > 70 ? 'bg-amber-500' : 'bg-green-500';

  const bgColor =
    usage.percentage > 85 ? 'bg-red-50' : usage.percentage > 70 ? 'bg-amber-50' : 'bg-green-50';

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${colorClass} ${bgColor}`}
    >
      <span>
        {usage.used}/{usage.limit}
      </span>
      <span className="w-8 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <span
          className={`block h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(usage.percentage, 100)}%` }}
        />
      </span>
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
