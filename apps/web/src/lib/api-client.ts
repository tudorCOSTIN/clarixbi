export const API_URL = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:4000/api/v1';

interface FetchOptions extends RequestInit {
  skipOrgHeader?: boolean;
  _isRetry?: boolean;
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
    // ignore parse errors
  }
  return null;
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiClient<T = any>(path: string, options: FetchOptions = {}): Promise<T> {
  const { skipOrgHeader, _isRetry, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (!skipOrgHeader) {
    const orgId = getOrgId();
    if (orgId) {
      headers['X-Org-Id'] = orgId;
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers,
    credentials: 'include',
  });

  // Auto-refresh on 401 (only once to prevent infinite loops)
  if (response.status === 401 && !_isRetry) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return apiClient<T>(path, { ...options, _isRetry: true });
    }

    // Refresh failed — redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Session expired');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));

    // Preserve error code for downstream handling
    const errorMessage = error.error
      ? `${error.error}: ${error.message || `API error: ${response.status}`}`
      : error.message || `API error: ${response.status}`;

    throw new Error(errorMessage);
  }

  return response.json();
}
