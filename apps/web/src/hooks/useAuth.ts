'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useOrgStore } from '@/stores/org-store';

interface UserOrg {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  role: string;
}

interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  preferred_language: string;
  preferred_timezone: string;
  organizations: UserOrg[];
}

interface UseAuthReturn {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => Promise<void>;
  switchOrg: (orgId: string) => void;
  refetch: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { currentOrgId, setCurrentOrg, clearOrg } = useOrgStore();

  const fetchUser = useCallback(async () => {
    try {
      const response = await apiClient<{ data: AuthUser }>('/auth/me', {
        skipOrgHeader: true,
      });
      const userData = response.data;
      setUser(userData);

      // Set default org if none selected
      if (!currentOrgId && userData.organizations.length > 0) {
        setCurrentOrg(userData.organizations[0]!.id);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrgId, setCurrentOrg]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(() => {
    const domain = process.env['NEXT_PUBLIC_AUTH0_DOMAIN'];
    const clientId = process.env['NEXT_PUBLIC_AUTH0_CLIENT_ID'];
    const audience = process.env['NEXT_PUBLIC_AUTH0_AUDIENCE'];
    const callbackUrl = `${window.location.origin}/api/auth/callback`;

    window.location.href =
      `https://${domain}/authorize?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
      `audience=${encodeURIComponent(audience || '')}&` +
      `scope=openid%20profile%20email&` +
      `connection=google-oauth2`;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient('/auth/logout', { method: 'POST' });
    } catch {
      // continue logout even if API fails
    }
    setUser(null);
    clearOrg();
    window.location.href = '/login';
  }, [clearOrg]);

  const switchOrg = useCallback(
    (orgId: string) => {
      setCurrentOrg(orgId);
    },
    [setCurrentOrg],
  );

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    switchOrg,
    refetch: fetchUser,
  };
}
