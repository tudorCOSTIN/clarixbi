import { test, expect } from './fixtures/auth.fixture';
import { mockEmptyAppState } from './helpers/api-mock.helper';
import { goto } from './helpers/navigation.helper';

// NOTE: Dashboard content rendering tests are limited because CSP blocks
// React hydration (unsafe-eval) in Next.js dev mode. Dynamic imports
// (react-grid-layout, recharts) require eval which CSP prevents.
// Content assertions require a CSP fix (allow unsafe-eval in dev).

// ---------------------------------------------------------------------------
// Dashboard list page loads
// ---------------------------------------------------------------------------
test('Dashboards list: page loads successfully', async ({ authedPage: page }) => {
  await mockEmptyAppState(page);

  await goto(page, '/en/dashboards');
  await expect(page).toHaveURL(/\/en\/dashboards/);
});

// ---------------------------------------------------------------------------
// Dashboard detail page loads
// ---------------------------------------------------------------------------
test('Dashboard detail: page loads without crash', async ({ authedPage: page }) => {
  await mockEmptyAppState(page);

  await page.goto('/en/dashboards/dash-1');
  await expect(page).toHaveURL(/\/en\/dashboards\/dash-1/);
});

// ---------------------------------------------------------------------------
// Dashboard i18n — Romanian locale
// ---------------------------------------------------------------------------
test('Dashboards: Romanian locale loads', async ({ authedPage: page }) => {
  await mockEmptyAppState(page);

  await goto(page, '/ro/dashboards');
  await expect(page).toHaveURL(/\/ro\/dashboards/);
});
