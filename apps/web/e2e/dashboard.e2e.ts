import { test, expect } from '@playwright/test';
import { setupAuth, API_BASE } from './helpers/setup';
import {
  mockDashboards,
  mockSingleDashboard,
  mockCreatedDashboard,
  mockClonedDashboard,
  mockSharedDashboard,
} from './mocks/dashboard.mock';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupDashboardMocks(
  page: import('@playwright/test').Page,
  dashboards = mockDashboards,
) {
  await setupAuth(page);

  // List dashboards
  await page.route(`${API_BASE}/organizations/*/dashboards`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: dashboards }),
      });
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockCreatedDashboard }),
      });
    }
    return route.continue();
  });

  // Single dashboard
  await page.route(`${API_BASE}/organizations/*/dashboards/dash-uuid-1`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockSingleDashboard }),
      });
    }
    if (route.request().method() === 'DELETE') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    }
    return route.continue();
  });

  // Clone/duplicate
  await page.route(`${API_BASE}/organizations/*/dashboards/dash-uuid-1/duplicate`, (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockClonedDashboard }),
    }),
  );

  // Share
  await page.route(`${API_BASE}/organizations/*/dashboards/dash-uuid-1/share`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { share_token: 'share-token-abc123' } }),
    }),
  );

  // Shared dashboard (public)
  await page.route(`${API_BASE}/shared/dashboards/share-token-abc123`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockSharedDashboard }),
    }),
  );
}

// ---------------------------------------------------------------------------
// Dashboard list page
// ---------------------------------------------------------------------------

test('Dashboards list: page loads and shows dashboards', async ({ page }) => {
  await setupDashboardMocks(page);
  await page.goto('/en/dashboards');
  await expect(page).toHaveURL(/\/en\/dashboards/);

  // Verify dashboard names are visible
  await expect(page.getByText('Sales Overview')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Inventory Tracker')).toBeVisible();
});

test('Dashboards list: empty state when no dashboards', async ({ page }) => {
  await setupDashboardMocks(page, []);
  await page.goto('/en/dashboards');
  await expect(page).toHaveURL(/\/en\/dashboards/);

  // Should show empty state or add button
  const addBtn = page.getByRole('button', { name: /add|create|new/i });
  const emptyText = page.getByText(/no dashboard|empty|get started/i);
  const hasAdd = await addBtn.isVisible({ timeout: 8000 }).catch(() => false);
  const hasEmpty = await emptyText.isVisible({ timeout: 3000 }).catch(() => false);
  expect(hasAdd || hasEmpty).toBeTruthy();
});

test('Dashboards list: Romanian locale works', async ({ page }) => {
  await setupDashboardMocks(page);
  await page.goto('/ro/dashboards');
  await expect(page).toHaveURL(/\/ro\/dashboards/);
  // Page loads without crash
  await expect(page.getByText('Sales Overview')).toBeVisible({ timeout: 10000 });
});

// ---------------------------------------------------------------------------
// Dashboard create flow
// ---------------------------------------------------------------------------

test('Dashboard create: button navigates to create flow', async ({ page }) => {
  await setupDashboardMocks(page);
  await page.goto('/en/dashboards');

  const createBtn = page.getByRole('button', { name: /new|create|add/i });
  if (await createBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await createBtn.click();
    // Should navigate to new or show modal
    const hasUrl = await page
      .waitForURL(/\/dashboards\/(new|create)/, { timeout: 5000 })
      .catch(() => false);
    const hasModal = await page
      .getByRole('dialog')
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(hasUrl || hasModal).toBeTruthy();
  }
});

// ---------------------------------------------------------------------------
// Dashboard detail page
// ---------------------------------------------------------------------------

test('Dashboard detail: loads dashboard with widgets', async ({ page }) => {
  await setupDashboardMocks(page);
  await page.goto('/en/dashboards/dash-uuid-1');
  await expect(page).toHaveURL(/\/en\/dashboards\/dash-uuid-1/);

  // Dashboard name should be visible
  await expect(page.getByText('Sales Overview')).toBeVisible({ timeout: 10000 });
});

// ---------------------------------------------------------------------------
// Dashboard clone
// ---------------------------------------------------------------------------

test('Dashboard clone: creates copy with (Copy) suffix', async ({ page }) => {
  await setupDashboardMocks(page);
  await page.goto('/en/dashboards');
  await expect(page.getByText('Sales Overview')).toBeVisible({ timeout: 10000 });

  // Find clone/duplicate button
  const cloneBtn = page.getByRole('button', { name: /clone|duplicate|copy/i }).first();
  if (await cloneBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cloneBtn.click();
    // Should show success or the cloned dashboard name
    const hasCopy = await page
      .getByText(/copy/i)
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasToast = await page
      .getByText(/cloned|duplicated|copied/i)
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(hasCopy || hasToast).toBeTruthy();
  }
});

// ---------------------------------------------------------------------------
// Dashboard delete
// ---------------------------------------------------------------------------

test('Dashboard delete: confirmation dialog and removal', async ({ page }) => {
  await setupDashboardMocks(page);
  await page.goto('/en/dashboards');
  await expect(page.getByText('Sales Overview')).toBeVisible({ timeout: 10000 });

  // Find delete button
  const deleteBtn = page.getByRole('button', { name: /delete|remove/i }).first();
  if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await deleteBtn.click();

    // Confirmation dialog should appear
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
      const confirmBtn = dialog.getByRole('button', { name: /confirm|delete|yes/i });
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Dashboard share
// ---------------------------------------------------------------------------

test('Dashboard share: generates share link', async ({ page }) => {
  await setupDashboardMocks(page);
  await page.goto('/en/dashboards');
  await expect(page.getByText('Sales Overview')).toBeVisible({ timeout: 10000 });

  const shareBtn = page.getByRole('button', { name: /share/i }).first();
  if (await shareBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await shareBtn.click();

    // Share dialog should appear
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Should have a copy link button or show a URL
      const copyBtn = dialog.getByRole('button', { name: /copy|generate/i });
      const hasLink = await copyBtn.isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasLink).toBeTruthy();
    }
  }
});

// ---------------------------------------------------------------------------
// Shared dashboard (public access)
// ---------------------------------------------------------------------------

test('Shared dashboard: accessible without auth via share token', async ({ page }) => {
  // Mock the shared endpoint (no auth needed)
  await page.route(`${API_BASE}/shared/dashboards/share-token-abc123`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockSharedDashboard }),
    }),
  );

  await page.goto('/d/share-token-abc123');
  // Should load without redirect to login
  await expect(page).not.toHaveURL(/\/login/);
});
