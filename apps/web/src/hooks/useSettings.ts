'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  preferred_language: string;
  preferred_timezone: string;
}

interface Preferences {
  theme: string;
  notifications_enabled: boolean;
  email_notifications: boolean;
}

interface UseSettingsReturn {
  profile: UserProfile | null;
  preferences: Preferences | null;
  loading: boolean;
  error: string | null;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<UserProfile | null>;
  fetchPreferences: () => Promise<void>;
  updatePreferences: (data: Partial<Preferences>) => Promise<Preferences | null>;
}

export function useSettings(): UseSettingsReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient<{ data: UserProfile }>('/users/me', {
        skipOrgHeader: true,
      });
      setProfile(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(
    async (data: Partial<UserProfile>): Promise<UserProfile | null> => {
      try {
        setError(null);
        const res = await apiClient<{ data: UserProfile }>('/users/me', {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
        setProfile(res.data);
        return res.data;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update profile');
        return null;
      }
    },
    [],
  );

  const fetchPreferences = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient<{ data: Preferences }>('/settings/preferences', {
        skipOrgHeader: true,
      });
      setPreferences(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch preferences');
    }
  }, []);

  const updatePreferences = useCallback(
    async (data: Partial<Preferences>): Promise<Preferences | null> => {
      try {
        setError(null);
        const res = await apiClient<{ data: Preferences }>('/settings/preferences', {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
        setPreferences(res.data);
        return res.data;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update preferences');
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    preferences,
    loading,
    error,
    fetchProfile,
    updateProfile,
    fetchPreferences,
    updatePreferences,
  };
}
