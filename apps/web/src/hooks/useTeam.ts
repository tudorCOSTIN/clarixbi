'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useOrgStore } from '@/stores/org-store';

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  invite_email: string | null;
  invite_status: string | null;
  invite_expires_at: string | null;
  joined_at: string | null;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface UseTeamReturn {
  members: TeamMember[];
  pendingInvites: TeamMember[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  inviteMember: (dto: { email: string; role: string }) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  updateRole: (id: string, role: string) => Promise<void>;
  resendInvite: (id: string) => Promise<void>;
  revokeInvite: (id: string) => Promise<void>;
}

export function useTeam(): UseTeamReturn {
  const { currentOrgId } = useOrgStore();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<TeamMember[]>([]);
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
      const res = await apiClient<{
        data: { members: TeamMember[]; pendingInvites: TeamMember[] };
      }>(`/organizations/${currentOrgId}/team`);
      setMembers(
        res.data.members.filter((m) => m.invite_status === 'accepted' || !m.invite_status),
      );
      setPendingInvites(res.data.pendingInvites);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch team');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const inviteMember = useCallback(
    async (dto: { email: string; role: string }) => {
      if (!currentOrgId) return;
      await apiClient(`/organizations/${currentOrgId}/team/invite`, {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      await fetch();
    },
    [currentOrgId, fetch],
  );

  const removeMember = useCallback(
    async (id: string) => {
      if (!currentOrgId) return;
      await apiClient(`/organizations/${currentOrgId}/team/${id}`, {
        method: 'DELETE',
      });
      await fetch();
    },
    [currentOrgId, fetch],
  );

  const updateRole = useCallback(
    async (id: string, role: string) => {
      if (!currentOrgId) return;
      await apiClient(`/organizations/${currentOrgId}/team/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      await fetch();
    },
    [currentOrgId, fetch],
  );

  const resendInvite = useCallback(
    async (id: string) => {
      if (!currentOrgId) return;
      await apiClient(`/organizations/${currentOrgId}/team/${id}/resend`, {
        method: 'POST',
      });
      await fetch();
    },
    [currentOrgId, fetch],
  );

  const revokeInvite = useCallback(
    async (id: string) => {
      if (!currentOrgId) return;
      await apiClient(`/organizations/${currentOrgId}/team/${id}/revoke`, {
        method: 'DELETE',
      });
      await fetch();
    },
    [currentOrgId, fetch],
  );

  return {
    members,
    pendingInvites,
    loading,
    error,
    refetch: fetch,
    inviteMember,
    removeMember,
    updateRole,
    resendInvite,
    revokeInvite,
  };
}
