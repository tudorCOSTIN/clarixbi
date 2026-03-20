'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const POSTHOG_KEY = process.env['NEXT_PUBLIC_POSTHOG_KEY'];
const POSTHOG_HOST = process.env['NEXT_PUBLIC_POSTHOG_HOST'] || 'https://eu.i.posthog.com';

if (typeof window !== 'undefined' && POSTHOG_KEY) {
  const consent = localStorage.getItem('clarixbi_cookie_consent');

  // Only initialize PostHog if user has not opted out
  if (consent !== 'necessary') {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: 'identified_only',
      capture_pageview: false, // We handle this manually
      capture_pageleave: true,
      opt_out_capturing_by_default: !consent, // Don't capture until consent given
    });
  }
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (pathname && ph) {
      let url = window.origin + pathname;
      if (searchParams?.toString()) {
        url = url + '?' + searchParams.toString();
      }
      ph.capture('$pageview', { $current_url: url });
    }
  }, [pathname, searchParams, ph]);

  return null;
}

export function PostHogIdentify({ userId, orgId }: { userId: string; orgId: string | null }) {
  const ph = usePostHog();
  const identified = useRef(false);

  useEffect(() => {
    if (ph && userId && !identified.current) {
      ph.identify(userId, { org_id: orgId });
      identified.current = true;
    }
  }, [ph, userId, orgId]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!POSTHOG_KEY) {
    return <>{children}</>;
  }

  // If user opted out, don't wrap with PostHog provider
  if (typeof window !== 'undefined') {
    const consent = localStorage.getItem('clarixbi_cookie_consent');
    if (consent === 'necessary') {
      return <>{children}</>;
    }
  }

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}
