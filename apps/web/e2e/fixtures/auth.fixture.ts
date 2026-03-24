import { test as base, Page, expect } from '@playwright/test';

const API_BASE = process.env['E2E_API_URL'] || 'http://localhost:4000/api/v1';

/**
 * Mock user profiles for different team roles.
 * Matches the AuthUser shape returned by GET /auth/me.
 */
const mockUsers = {
  owner: {
    id: 'test-owner-uuid',
    email: 'owner@test.clarixbi.com',
    name: 'Test Owner',
    avatar_url: null,
    preferred_language: 'en',
    preferred_timezone: 'Europe/Bucharest',
    organizations: [
      {
        id: 'test-org-uuid',
        name: 'Test Organization',
        slug: 'test-org',
        logo_url: null,
        role: 'owner',
      },
    ],
  },
  admin: {
    id: 'test-admin-uuid',
    email: 'admin@test.clarixbi.com',
    name: 'Test Admin',
    avatar_url: null,
    preferred_language: 'en',
    preferred_timezone: 'Europe/Bucharest',
    organizations: [
      {
        id: 'test-org-uuid',
        name: 'Test Organization',
        slug: 'test-org',
        logo_url: null,
        role: 'admin',
      },
    ],
  },
  editor: {
    id: 'test-editor-uuid',
    email: 'editor@test.clarixbi.com',
    name: 'Test Editor',
    avatar_url: null,
    preferred_language: 'en',
    preferred_timezone: 'Europe/Bucharest',
    organizations: [
      {
        id: 'test-org-uuid',
        name: 'Test Organization',
        slug: 'test-org',
        logo_url: null,
        role: 'editor',
      },
    ],
  },
  viewer: {
    id: 'test-viewer-uuid',
    email: 'viewer@test.clarixbi.com',
    name: 'Test Viewer',
    avatar_url: null,
    preferred_language: 'en',
    preferred_timezone: 'Europe/Bucharest',
    organizations: [
      {
        id: 'test-org-uuid',
        name: 'Test Organization',
        slug: 'test-org',
        logo_url: null,
        role: 'viewer',
      },
    ],
  },
};

type UserRole = keyof typeof mockUsers;

/**
 * Setup auth mock: intercept API routes and inject session cookies.
 * This replaces real Auth0 calls with mock responses.
 */
async function setupAuthMock(page: Page, role: UserRole): Promise<void> {
  const user = mockUsers[role];

  // Intercept GET /auth/me — returns mock user profile
  await page.route(`${API_BASE}/auth/me`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: user }),
    }),
  );

  // Intercept POST /auth/callback — mock code exchange
  await page.route(`${API_BASE}/auth/callback`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { is_new_user: false } }),
    }),
  );

  // Intercept POST /auth/logout — mock logout
  await page.route(`${API_BASE}/auth/logout`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    }),
  );

  // Intercept POST /auth/refresh — mock token refresh
  await page.route(`${API_BASE}/auth/refresh`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { access_token: 'refreshed-token' } }),
    }),
  );

  // Set the access_token httpOnly cookie so middleware allows access
  await page.context().addCookies([
    {
      name: 'access_token',
      value: `mock-jwt-${role}`,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);

  // Set org store in localStorage so apiClient sends X-Org-Id
  await page.addInitScript(() => {
    localStorage.setItem(
      'clarixbi-org-store',
      JSON.stringify({ state: { currentOrgId: 'test-org-uuid' } }),
    );
  });
}

/**
 * Custom test fixture extending Playwright base test with auth support.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/auth.fixture';
 *   test('my test', async ({ authedPage }) => { ... });
 *   test.use({ role: 'viewer' });
 */
export const test = base.extend<{
  authedPage: Page;
  role: UserRole;
}>({
  role: ['owner', { option: true }],
  authedPage: async ({ page, role }, use) => {
    await setupAuthMock(page, role);
    await use(page);
  },
});

export { expect, mockUsers, setupAuthMock, API_BASE };
export type { UserRole };
