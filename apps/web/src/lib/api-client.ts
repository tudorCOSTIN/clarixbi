const API_URL = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:4000/api/v1';

interface FetchOptions extends RequestInit {
  skipOrgHeader?: boolean;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiClient<T = any>(path: string, options: FetchOptions = {}): Promise<T> {
  const { skipOrgHeader, ...fetchOptions } = options;

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
