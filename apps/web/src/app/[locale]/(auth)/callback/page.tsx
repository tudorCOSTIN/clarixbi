'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { apiClient } from '@/lib/api-client';

export default function CallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setError('No authorization code received');
      return;
    }

    const exchangeCode = async () => {
      try {
        const response = await apiClient<{ data: { is_new_user: boolean } }>('/auth/callback', {
          method: 'POST',
          body: JSON.stringify({ code }),
        });

        if (response.data.is_new_user) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          router.push('/onboarding' as any);
        } else {
          router.push('/');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    exchangeCode();
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-lg bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <a href="/login" className="mt-3 inline-block text-sm text-red-600 underline">
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-blue border-t-transparent" />
        <p className="mt-4 text-sm text-gray-500">Authenticating...</p>
      </div>
    </div>
  );
}
