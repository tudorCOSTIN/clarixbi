import type { Page } from '@playwright/test';

export const API_BASE = 'http://localhost:4000/api/v1';

export async function mockAuthState(page: Page) {
  await page.context().addCookies([
    {
      name: 'access_token',
      value: 'fake-jwt-token-for-testing',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

export async function mockAuthMeApi(
  page: Page,
  overrides?: { role?: string; email?: string; name?: string; language?: string },
) {
  const role = overrides?.role ?? 'owner';
  const email = overrides?.email ?? 'test@clarixbi.com';
  const name = overrides?.name ?? 'Test User';
  const language = overrides?.language ?? 'en';

  await page.route(`${API_BASE}/auth/me`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'user-1',
          email,
          name,
          avatar_url: null,
          preferred_language: language,
          preferred_timezone: 'Europe/Bucharest',
          organizations: [
            { id: 'org-1', name: 'Test Org', slug: 'test-org', logo_url: null, role },
          ],
        },
      }),
    }),
  );
}

export async function setupOrgStore(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'clarixbi-org-store',
      JSON.stringify({ state: { currentOrgId: 'org-1' } }),
    );
    // Dismiss cookie consent banner to avoid UI interference
    localStorage.setItem('clarixbi_cookie_consent', 'accepted');
  });
}

/**
 * Mock layout-level API calls that the app layout makes on every page.
 * Without these, failed network requests can break React rendering.
 */
export async function mockLayoutApis(page: Page) {
  // Notifications unread count (navbar badge)
  await page.route(`${API_BASE}/organizations/*/notifications/unread-count`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { count: 0 } }),
    }),
  );

  // AI usage (layout-level check)
  await page.route(`${API_BASE}/organizations/*/ai/usage`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { used: 5, limit: 50 } }),
    }),
  );

  // Auth refresh (fallback for 401 retry)
  await page.route(`${API_BASE}/auth/refresh`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    }),
  );
}

export async function setupAuth(
  page: Page,
  overrides?: { role?: string; email?: string; name?: string; language?: string },
) {
  await mockAuthState(page);
  await mockAuthMeApi(page, overrides);
  await setupOrgStore(page);
  await mockLayoutApis(page);
}
