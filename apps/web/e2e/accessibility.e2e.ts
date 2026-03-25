import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const API_BASE = 'http://localhost:4000/api/v1';

async function mockAuthState(page: import('@playwright/test').Page) {
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

async function mockAuthMeApi(page: import('@playwright/test').Page) {
  await page.route(`${API_BASE}/auth/me`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'user-1',
          email: 'test@clarixbi.com',
          name: 'Test User',
          avatar_url: null,
          preferred_language: 'en',
          preferred_timezone: 'Europe/Bucharest',
          organizations: [
            { id: 'org-1', name: 'Test Org', slug: 'test-org', logo_url: null, role: 'owner' },
          ],
        },
      }),
    }),
  );
}

async function mockAppApis(page: import('@playwright/test').Page) {
  await page.route(`${API_BASE}/organizations/current/dashboards**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 20 } }),
    }),
  );
  await page.route(`${API_BASE}/organizations/current/alerts**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 20 } }),
    }),
  );
  await page.route(`${API_BASE}/organizations/current/reports**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 20 } }),
    }),
  );
  await page.route(`${API_BASE}/organizations/current/data-sources**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 20 } }),
    }),
  );
  await page.route(`${API_BASE}/organizations/current/overview**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          dashboards: 0,
          dataSources: 0,
          alerts: 0,
          reports: 0,
          teamMembers: 1,
          aiQueries: 0,
        },
      }),
    }),
  );
  await page.route(`${API_BASE}/ai/conversations**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );
  await page.route(`${API_BASE}/ai/usage**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { used: 0, limit: 100, remaining: 100 } }),
    }),
  );
  await page.route(`${API_BASE}/organizations/current/team**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );
  await page.route(`${API_BASE}/notifications**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );
}

// ---------------------------------------------------------------------------
// Public pages — no auth required
// ---------------------------------------------------------------------------
test.describe('Accessibility: Public pages', () => {
  test('Login page has no critical a11y violations', async ({ page }) => {
    await page.goto('/en/login');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    if (critical.length > 0) {
      const summary = critical.map(
        (v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`,
      );
      expect(critical, `Critical violations:\n${summary.join('\n')}`).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// Authenticated pages — mock auth + API
// ---------------------------------------------------------------------------
test.describe('Accessibility: Authenticated pages', () => {
  const authenticatedPages = [
    { name: 'Home', path: '/en' },
    { name: 'Dashboards', path: '/en/dashboards' },
    { name: 'Alerts', path: '/en/alerts' },
    { name: 'Reports', path: '/en/reports' },
    { name: 'Data Sources', path: '/en/data-sources' },
    { name: 'AI Chat', path: '/en/ai' },
    { name: 'Settings', path: '/en/settings' },
  ];

  for (const pg of authenticatedPages) {
    test(`${pg.name} page has no critical a11y violations`, async ({ page }) => {
      await mockAuthState(page);
      await mockAuthMeApi(page);
      await mockAppApis(page);

      await page.goto(pg.path);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const critical = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );

      if (critical.length > 0) {
        const summary = critical.map(
          (v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`,
        );
        expect(critical, `Critical violations on ${pg.name}:\n${summary.join('\n')}`).toEqual([]);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Color contrast
// ---------------------------------------------------------------------------
test.describe('Color Contrast', () => {
  test('Login page meets WCAG AA contrast ratio', async ({ page }) => {
    await page.goto('/en/login');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();

    expect(results.violations).toEqual([]);
  });

  test('Dashboard list page meets WCAG AA contrast ratio', async ({ page }) => {
    await mockAuthState(page);
    await mockAuthMeApi(page);
    await mockAppApis(page);

    await page.goto('/en/dashboards');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();

    expect(results.violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ARIA and Semantic HTML
// ---------------------------------------------------------------------------
test.describe('ARIA and Semantic HTML', () => {
  test('authenticated pages have main and nav landmarks', async ({ page }) => {
    await mockAuthState(page);
    await mockAuthMeApi(page);
    await mockAppApis(page);

    await page.goto('/en/dashboards');
    await page.waitForLoadState('networkidle');

    expect(await page.locator('main').count()).toBeGreaterThan(0);
    expect(await page.locator('nav').count()).toBeGreaterThan(0);
  });

  test('form inputs on login page have associated labels', async ({ page }) => {
    await page.goto('/en/login');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).withRules(['label']).analyze();

    expect(results.violations).toEqual([]);
  });

  test('images have alt text', async ({ page }) => {
    await mockAuthState(page);
    await mockAuthMeApi(page);
    await mockAppApis(page);

    await page.goto('/en/dashboards');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).withRules(['image-alt']).analyze();

    expect(results.violations).toEqual([]);
  });
});
