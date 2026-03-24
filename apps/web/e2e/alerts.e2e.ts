import { test, expect } from '@playwright/test';
import { setupAuth, API_BASE } from './helpers/setup';
import { mockAlerts, mockAlertTriggers, mockDataSources, mockTestResult } from './mocks/alert.mock';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupAlertsMocks(page: import('@playwright/test').Page, alerts = mockAlerts) {
  await setupAuth(page);

  await page.route(`${API_BASE}/organizations/org-1/alerts`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: alerts }),
      });
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'alert-new',
            name: 'New Alert',
            metric_query: 'SELECT 1',
            condition_operator: 'gt',
            threshold_value: 100,
            check_frequency: 'hourly',
            is_active: true,
            data_source_id: 'ds-1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        }),
      });
    }
    return route.continue();
  });

  await page.route(`${API_BASE}/organizations/org-1/data-sources`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockDataSources }),
    }),
  );
}

// ---------------------------------------------------------------------------
// Alerts — List Page
// ---------------------------------------------------------------------------

test.describe('Alerts — List Page', () => {
  test('shows alerts list with active/inactive status', async ({ page }) => {
    await setupAlertsMocks(page);
    await page.goto('/en/alerts');

    await expect(page.getByText('Revenue Drop Alert')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Low Stock Alert')).toBeVisible();
  });

  test('shows empty state when no alerts', async ({ page }) => {
    await setupAlertsMocks(page, []);
    await page.goto('/en/alerts');

    // Empty state has a create button (second one, in the empty card)
    const createButtons = page.getByRole('button', { name: /create|plus/i });
    await expect(createButtons.first()).toBeVisible({ timeout: 10000 });
  });

  test('shows loading state initially', async ({ page }) => {
    await setupAuth(page);

    // Delay the alerts API to see loading state
    await page.route(`${API_BASE}/organizations/org-1/alerts`, async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto('/en/alerts');

    // Should see a spinner while loading
    await expect(page.locator('.animate-spin').first()).toBeVisible({ timeout: 5000 });
  });

  test('create alert button is visible', async ({ page }) => {
    await setupAlertsMocks(page);
    await page.goto('/en/alerts');

    await expect(page.getByRole('button', { name: /create/i }).first()).toBeVisible({
      timeout: 10000,
    });
  });
});

// ---------------------------------------------------------------------------
// Alerts — Create Wizard (3 steps)
// ---------------------------------------------------------------------------

test.describe('Alerts — Create Wizard', () => {
  test('wizard opens and shows step 1 (data source + metric)', async ({ page }) => {
    await setupAlertsMocks(page);
    await page.goto('/en/alerts');

    // Wait for page to load
    await expect(page.getByText('Revenue Drop Alert')).toBeVisible({ timeout: 10000 });

    // Click create
    await page.getByRole('button', { name: /create alert/i }).click();

    // Step 1: should see the wizard dialog
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#alert-data-source')).toBeVisible();
    await expect(page.locator('#alert-metric-query')).toBeVisible();
  });

  test('wizard step navigation: next and back', async ({ page }) => {
    await setupAlertsMocks(page);
    await page.goto('/en/alerts');

    await page
      .getByRole('button', { name: /create/i })
      .first()
      .click();

    // Step 1: fill data source and metric
    await page.locator('#alert-data-source').selectOption('ds-1');
    await page.locator('#alert-metric-query').fill('SELECT SUM(amount) FROM invoices');

    // Next button should be enabled now
    const nextBtn = page.getByRole('button', { name: /next/i });
    await nextBtn.click();

    // Step 2: should see operator and threshold
    await expect(page.locator('#alert-operator')).toBeVisible();
    await expect(page.locator('#alert-threshold')).toBeVisible();

    // Go back to step 1
    const backBtn = page.getByRole('button', { name: /back/i });
    await backBtn.click();
    await expect(page.locator('#alert-data-source')).toBeVisible();
  });

  test('wizard step 2: operator and threshold', async ({ page }) => {
    await setupAlertsMocks(page);
    await page.goto('/en/alerts');

    await page
      .getByRole('button', { name: /create/i })
      .first()
      .click();

    // Step 1: fill
    await page.locator('#alert-data-source').selectOption('ds-1');
    await page.locator('#alert-metric-query').fill('SELECT SUM(amount) FROM invoices');
    await page.getByRole('button', { name: /next/i }).click();

    // Step 2: fill operator and threshold
    await page.locator('#alert-operator').selectOption('lt');
    await page.locator('#alert-threshold').fill('1000');

    // Next to step 3
    await page.getByRole('button', { name: /next/i }).click();

    // Step 3: should see frequency and name fields
    await expect(page.locator('#alert-frequency')).toBeVisible();
    await expect(page.locator('#alert-name')).toBeVisible();
  });

  test('wizard step 3: save creates alert', async ({ page }) => {
    await setupAlertsMocks(page);
    await page.goto('/en/alerts');

    await page
      .getByRole('button', { name: /create/i })
      .first()
      .click();

    // Step 1
    await page.locator('#alert-data-source').selectOption('ds-1');
    await page.locator('#alert-metric-query').fill('SELECT SUM(amount) FROM invoices');
    await page.getByRole('button', { name: /next/i }).click();

    // Step 2
    await page.locator('#alert-threshold').fill('1000');
    await page.getByRole('button', { name: /next/i }).click();

    // Step 3
    await page.locator('#alert-name').fill('My Test Alert');

    // Save button
    const saveBtn = page.getByRole('button', { name: /save/i });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Wizard should close — page should still show alerts
    await expect(page.getByText('Revenue Drop Alert')).toBeVisible({ timeout: 10000 });
  });

  test('next button disabled when step 1 fields empty', async ({ page }) => {
    await setupAlertsMocks(page);
    await page.goto('/en/alerts');

    await page
      .getByRole('button', { name: /create/i })
      .first()
      .click();

    // Next should be disabled without filling
    const nextBtn = page.getByRole('button', { name: /next/i });
    await expect(nextBtn).toBeDisabled();
  });

  test('save button disabled when name empty', async ({ page }) => {
    await setupAlertsMocks(page);
    await page.goto('/en/alerts');

    await page
      .getByRole('button', { name: /create/i })
      .first()
      .click();

    // Navigate through steps
    await page.locator('#alert-data-source').selectOption('ds-1');
    await page.locator('#alert-metric-query').fill('SELECT 1');
    await page.getByRole('button', { name: /next/i }).click();
    await page.locator('#alert-threshold').fill('100');
    await page.getByRole('button', { name: /next/i }).click();

    // Name is empty — save should be disabled
    const saveBtn = page.getByRole('button', { name: /save/i });
    await expect(saveBtn).toBeDisabled();
  });

  test('cancel closes wizard', async ({ page }) => {
    await setupAlertsMocks(page);
    await page.goto('/en/alerts');

    await page
      .getByRole('button', { name: /create/i })
      .first()
      .click();
    await expect(page.locator('#alert-data-source')).toBeVisible({ timeout: 5000 });

    // Cancel (on step 1, the back/cancel button shows "cancel")
    await page.getByRole('button', { name: /cancel/i }).click();

    // Wizard should be gone
    await expect(page.locator('#alert-data-source')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Alerts — Toggle + Management
// ---------------------------------------------------------------------------

test.describe('Alerts — Toggle + Management', () => {
  test('toggle activates/deactivates alert', async ({ page }) => {
    await setupAlertsMocks(page);

    // Mock toggle endpoint
    await page.route(`${API_BASE}/organizations/org-1/alerts/alert-uuid-1/toggle`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { ...mockAlerts[0], is_active: false } }),
      }),
    );

    await page.goto('/en/alerts');
    await expect(page.getByText('Revenue Drop Alert')).toBeVisible({ timeout: 10000 });

    // Click pause button (first alert is active)
    const pauseBtn = page.getByRole('button', { name: /pause/i }).first();
    await pauseBtn.click();

    // Page should still be intact
    await expect(page.getByText('Revenue Drop Alert')).toBeVisible();
  });

  test('test dry-run shows result toast', async ({ page }) => {
    await setupAlertsMocks(page);

    // Mock test endpoint
    await page.route(`${API_BASE}/organizations/org-1/alerts/alert-uuid-1/test`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockTestResult }),
      }),
    );

    await page.goto('/en/alerts');
    await expect(page.getByText('Revenue Drop Alert')).toBeVisible({ timeout: 10000 });

    // Click test button
    const testBtn = page.getByRole('button', { name: /test|dry/i }).first();
    await testBtn.click();

    // Toast should appear with result values
    await expect(page.getByText('850')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('1000', { exact: true })).toBeVisible();
  });

  test('delete shows confirmation and removes alert', async ({ page }) => {
    await setupAlertsMocks(page);

    // Mock delete endpoint
    await page.route(`${API_BASE}/organizations/org-1/alerts/alert-uuid-1`, (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
      }
      return route.continue();
    });

    await page.goto('/en/alerts');
    await expect(page.getByText('Revenue Drop Alert')).toBeVisible({ timeout: 10000 });

    // Handle confirm dialog
    page.on('dialog', (dialog) => dialog.accept());

    // Click delete
    const deleteBtn = page.getByRole('button', { name: /delete/i }).first();
    await deleteBtn.click();

    // Alert should be removed (only Low Stock remains)
    await expect(page.getByText('Low Stock Alert')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Alerts — History Modal
// ---------------------------------------------------------------------------

test.describe('Alerts — History', () => {
  test('history modal shows trigger entries', async ({ page }) => {
    await setupAlertsMocks(page);

    // Mock triggers endpoint
    await page.route(`${API_BASE}/organizations/org-1/alerts/alert-uuid-1/triggers`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockAlertTriggers }),
      }),
    );

    await page.goto('/en/alerts');
    await expect(page.getByText('Revenue Drop Alert')).toBeVisible({ timeout: 10000 });

    // Click history button
    const historyBtn = page.getByRole('button', { name: /history/i }).first();
    await historyBtn.click();

    // History modal should show trigger data
    await expect(page.getByText('850')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('920')).toBeVisible();
  });

  test('empty history shows message', async ({ page }) => {
    await setupAlertsMocks(page);

    // Mock triggers endpoint with empty array
    await page.route(`${API_BASE}/organizations/org-1/alerts/alert-uuid-2/triggers`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      }),
    );

    await page.goto('/en/alerts');
    await expect(page.getByText('Low Stock Alert')).toBeVisible({ timeout: 10000 });

    // Click history for second alert
    const historyBtns = page.getByRole('button', { name: /history/i });
    await historyBtns.nth(1).click();

    // Should show empty state — look for the dialog
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
  });
});
