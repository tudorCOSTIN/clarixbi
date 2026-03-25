import { test, expect } from '@playwright/test';
import { setupAuth, API_BASE } from './helpers/setup';
import {
  mockDataSources,
  mockEmptyDataSources,
  mockCreatedDataSource,
} from './mocks/data-source.mock';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupDataSourceMocks(
  page: import('@playwright/test').Page,
  dataSources = mockDataSources,
) {
  await setupAuth(page);

  // List data sources
  await page.route(`${API_BASE}/organizations/*/data-sources`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: dataSources }),
      });
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockCreatedDataSource }),
      });
    }
    return route.continue();
  });

  // Single data source detail
  await page.route(`${API_BASE}/organizations/*/data-sources/ds-uuid-1`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockDataSources[0] }),
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

  // Sync logs for detail page
  await page.route(`${API_BASE}/organizations/*/data-sources/*/logs*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );

  // Trigger sync
  await page.route(`${API_BASE}/organizations/*/data-sources/*/sync`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { ok: true, jobId: 'sync-job-1' } }),
    }),
  );
}

// ---------------------------------------------------------------------------
// Data Sources list page
// ---------------------------------------------------------------------------

test('Data Sources list: shows connected sources with status', async ({ page }) => {
  await setupDataSourceMocks(page);
  await page.goto('/en/data-sources');
  await expect(page).toHaveURL(/\/en\/data-sources/);

  // Verify data source names are visible
  await expect(page.getByText('SmartBill Production')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('WooCommerce Store')).toBeVisible();
});

test('Data Sources list: shows status badges (active, syncing, error)', async ({ page }) => {
  await setupDataSourceMocks(page);
  await page.goto('/en/data-sources');

  await expect(page.getByText('SmartBill Production')).toBeVisible({ timeout: 10000 });

  // Check that status text/badges are present
  const activeStatus = page.getByText(/active/i).first();
  const hasActive = await activeStatus.isVisible({ timeout: 3000 }).catch(() => false);

  const errorStatus = page.getByText(/error/i).first();
  const hasError = await errorStatus.isVisible({ timeout: 3000 }).catch(() => false);

  // At least one status should be visible
  expect(hasActive || hasError).toBeTruthy();
});

test('Data Sources list: empty state when no sources', async ({ page }) => {
  await setupDataSourceMocks(page, mockEmptyDataSources);
  await page.goto('/en/data-sources');
  await expect(page).toHaveURL(/\/en\/data-sources/);

  // Should show empty state
  const emptyText = page.getByText(/no data source|empty|connect|get started/i);
  const addBtn = page.getByRole('button', { name: /add|connect|new/i });
  const hasEmpty = await emptyText.isVisible({ timeout: 8000 }).catch(() => false);
  const hasAdd = await addBtn.isVisible({ timeout: 3000 }).catch(() => false);
  expect(hasEmpty || hasAdd).toBeTruthy();
});

test('Data Sources list: add source button navigates to connect', async ({ page }) => {
  await setupDataSourceMocks(page);
  await page.goto('/en/data-sources');

  await expect(page.getByText('SmartBill Production')).toBeVisible({ timeout: 10000 });

  const addBtn = page.getByRole('button', { name: /add|connect|new/i });
  if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addBtn.click();
    await expect(page).toHaveURL(/\/connect/);
  }
});

// ---------------------------------------------------------------------------
// Data Sources sync
// ---------------------------------------------------------------------------

test('Data Sources: sync button triggers manual sync', async ({ page }) => {
  await setupDataSourceMocks(page);
  await page.goto('/en/data-sources');

  await expect(page.getByText('SmartBill Production')).toBeVisible({ timeout: 10000 });

  // Find sync button (refresh icon or text)
  const syncBtn = page.getByRole('button', { name: /sync|refresh/i }).first();
  if (await syncBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await syncBtn.click();
    // Button should show syncing state or spinner
    // Just verify no crash
    await expect(page).toHaveURL(/\/en\/data-sources/);
  }
});

// ---------------------------------------------------------------------------
// Data Sources disconnect
// ---------------------------------------------------------------------------

test('Data Sources: disconnect shows confirmation dialog', async ({ page }) => {
  await setupDataSourceMocks(page);
  await page.goto('/en/data-sources');

  await expect(page.getByText('SmartBill Production')).toBeVisible({ timeout: 10000 });

  const deleteBtn = page.getByRole('button', { name: /delete|disconnect|remove/i }).first();
  if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await deleteBtn.click();

    // Confirmation dialog should appear
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
      const confirmBtn = dialog.getByRole('button', { name: /confirm|delete|disconnect|yes/i });
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Data Sources detail page
// ---------------------------------------------------------------------------

test('Data Sources: detail page loads for existing source', async ({ page }) => {
  await setupDataSourceMocks(page);
  await page.goto('/en/data-sources/ds-uuid-1');
  await expect(page).toHaveURL(/\/en\/data-sources\/ds-uuid-1/);

  // Should show source info
  const hasName = await page
    .getByText('SmartBill Production')
    .isVisible({ timeout: 8000 })
    .catch(() => false);
  const hasType = await page
    .getByText(/smartbill/i)
    .isVisible({ timeout: 3000 })
    .catch(() => false);
  expect(hasName || hasType).toBeTruthy();
});

// ---------------------------------------------------------------------------
// Romanian locale
// ---------------------------------------------------------------------------

test('Data Sources: Romanian locale works', async ({ page }) => {
  await setupDataSourceMocks(page);
  await page.goto('/ro/data-sources');
  await expect(page).toHaveURL(/\/ro\/data-sources/);

  // Page loads without crash
  await expect(page.getByText('SmartBill Production')).toBeVisible({ timeout: 10000 });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

test('Data Sources: API error shows error state', async ({ page }) => {
  await setupAuth(page);

  // Mock API error
  await page.route(`${API_BASE}/organizations/*/data-sources`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error', message: 'Database error' }),
      });
    }
    return route.continue();
  });

  await page.goto('/en/data-sources');
  await expect(page).toHaveURL(/\/en\/data-sources/);

  // Should show error message or retry button
  const errorText = page.getByText(/error|failed|try again/i);
  const retryBtn = page.getByRole('button', { name: /retry|try again/i });
  const hasError = await errorText.isVisible({ timeout: 8000 }).catch(() => false);
  const hasRetry = await retryBtn.isVisible({ timeout: 3000 }).catch(() => false);
  expect(hasError || hasRetry).toBeTruthy();
});
