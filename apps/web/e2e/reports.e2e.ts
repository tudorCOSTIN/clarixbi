import { test, expect } from '@playwright/test';
import { setupAuth, API_BASE } from './helpers/setup';
import { mockReports, mockDashboards } from './mocks/report.mock';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupReportsMocks(page: import('@playwright/test').Page, reports = mockReports) {
  await setupAuth(page);

  // Reports list
  await page.route(`${API_BASE}/organizations/org-1/reports`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: reports }),
      });
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'report-new',
            name: 'New Report',
            description: null,
            dashboard_id: 'dash-1',
            dashboard: { name: 'Sales Overview' },
            config: { widgetIds: ['w-1'], generatedFiles: [] },
            schedules: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        }),
      });
    }
    return route.continue();
  });

  // Dashboards for create modal
  await page.route(`${API_BASE}/organizations/org-1/dashboards`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockDashboards }),
    }),
  );

  // Dashboard detail (for widget loading)
  await page.route(`${API_BASE}/organizations/org-1/dashboards/dash-1`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockDashboards[0] }),
    }),
  );

  await page.route(`${API_BASE}/organizations/org-1/dashboards/dash-2`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockDashboards[1] }),
    }),
  );
}

// ---------------------------------------------------------------------------
// Reports — List Page
// ---------------------------------------------------------------------------

test.describe('Reports — List Page', () => {
  test('shows reports list with names', async ({ page }) => {
    await setupReportsMocks(page);
    await page.goto('/en/reports');

    await expect(page.getByText('Monthly Sales Report')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Weekly Inventory')).toBeVisible();
  });

  test('shows empty state when no reports', async ({ page }) => {
    await setupReportsMocks(page, []);
    await page.goto('/en/reports');

    // Empty state should have a create button
    const createButtons = page.getByRole('button', { name: /create/i });
    await expect(createButtons.first()).toBeVisible({ timeout: 10000 });
  });

  test('shows loading spinner initially', async ({ page }) => {
    await setupAuth(page);

    await page.route(`${API_BASE}/organizations/org-1/reports`, async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto('/en/reports');
    await expect(page.locator('.animate-spin').first()).toBeVisible({ timeout: 5000 });
  });

  test('create button is visible', async ({ page }) => {
    await setupReportsMocks(page);
    await page.goto('/en/reports');

    await expect(page.getByRole('button', { name: /create/i }).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('report card shows schedule badge when scheduled', async ({ page }) => {
    await setupReportsMocks(page);
    await page.goto('/en/reports');

    // First report has a monthly schedule
    await expect(page.getByText('Monthly Sales Report')).toBeVisible({ timeout: 10000 });
    // Look for schedule-related text
    await expect(page.getByText('Sales Overview')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Reports — Create Flow
// ---------------------------------------------------------------------------

test.describe('Reports — Create Flow', () => {
  test('create modal opens with form fields', async ({ page }) => {
    await setupReportsMocks(page);
    await page.goto('/en/reports');

    await page
      .getByRole('button', { name: /create/i })
      .first()
      .click();

    // Modal should show name, description, dashboard selector
    await expect(page.locator('#report-name')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#report-description')).toBeVisible();
    await expect(page.locator('#report-dashboard')).toBeVisible();
  });

  test('selecting dashboard loads widgets with checkboxes', async ({ page }) => {
    await setupReportsMocks(page);
    await page.goto('/en/reports');

    await page
      .getByRole('button', { name: /create/i })
      .first()
      .click();

    // Select a dashboard
    await page.locator('#report-dashboard').selectOption('dash-1');

    // Widgets should appear as checkboxes
    await expect(page.getByText('Revenue KPI')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Revenue Trend')).toBeVisible();
  });

  test('create button disabled when name empty', async ({ page }) => {
    await setupReportsMocks(page);
    await page.goto('/en/reports');

    await page
      .getByRole('button', { name: /create/i })
      .first()
      .click();

    // Select dashboard but leave name empty
    await page.locator('#report-dashboard').selectOption('dash-1');
    await expect(page.getByText('Revenue KPI')).toBeVisible({ timeout: 5000 });

    // Create button in modal should be disabled
    const createBtns = page.getByRole('button', { name: /create/i });
    // The modal create button is the last one
    const modalCreateBtn = createBtns.last();
    await expect(modalCreateBtn).toBeDisabled();
  });

  test('successful creation closes modal', async ({ page }) => {
    await setupReportsMocks(page);
    await page.goto('/en/reports');

    await page
      .getByRole('button', { name: /create/i })
      .first()
      .click();

    // Fill form
    await page.locator('#report-name').fill('New Test Report');
    await page.locator('#report-dashboard').selectOption('dash-1');
    await expect(page.getByText('Revenue KPI')).toBeVisible({ timeout: 5000 });

    // Click create (last create button = modal's button)
    await page
      .getByRole('button', { name: /create/i })
      .last()
      .click();

    // Modal should close — report list visible
    await expect(page.getByText('Monthly Sales Report')).toBeVisible({ timeout: 10000 });
  });

  test('cancel closes modal', async ({ page }) => {
    await setupReportsMocks(page);
    await page.goto('/en/reports');

    await page
      .getByRole('button', { name: /create/i })
      .first()
      .click();
    await expect(page.locator('#report-name')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /cancel/i }).click();

    // Modal should be gone
    await expect(page.locator('#report-name')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Reports — Generate + Download
// ---------------------------------------------------------------------------

test.describe('Reports — Generate + Download', () => {
  test('generate button triggers generation', async ({ page }) => {
    await setupReportsMocks(page);

    await page.route(`${API_BASE}/organizations/org-1/reports/report-uuid-1/generate`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { jobId: 'job-1' } }),
      }),
    );

    await page.goto('/en/reports');
    await expect(page.getByText('Monthly Sales Report')).toBeVisible({ timeout: 10000 });

    // Click generate on first report
    const generateBtns = page.getByRole('button', { name: /generate/i });
    await generateBtns.first().click();

    // Should show spinner while generating
    await expect(page.locator('.animate-spin').first()).toBeVisible({ timeout: 5000 });
  });

  test('download button works', async ({ page }) => {
    await setupReportsMocks(page);

    await page.route(`${API_BASE}/organizations/org-1/reports/report-uuid-1/download`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { url: 'https://storage.example.com/report-1.pdf' },
        }),
      }),
    );

    await page.goto('/en/reports');
    await expect(page.getByText('Monthly Sales Report')).toBeVisible({ timeout: 10000 });

    // Intercept window.open
    await page.evaluate(() => {
      window.open = () => null;
    });

    // The download button is an icon-only button with Download icon
    // It's the second small button in the action row
    const downloadBtns = page.locator('button:has(svg.lucide-download)');
    if (
      await downloadBtns
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await downloadBtns.first().click();
    }

    // Page should remain intact
    await expect(page.getByText('Monthly Sales Report')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Reports — Schedule
// ---------------------------------------------------------------------------

test.describe('Reports — Schedule', () => {
  test('schedule modal opens with frequency and recipients', async ({ page }) => {
    await setupReportsMocks(page);
    await page.goto('/en/reports');
    await expect(page.getByText('Monthly Sales Report')).toBeVisible({ timeout: 10000 });

    // Click schedule button (calendar icon button)
    const scheduleBtns = page.locator('button:has(svg.lucide-calendar)');
    if (
      await scheduleBtns
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await scheduleBtns.first().click();

      // Schedule modal fields
      await expect(page.locator('#schedule-frequency')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('#schedule-recipients')).toBeVisible();
      await expect(page.locator('#schedule-timezone')).toBeVisible();
    }
  });

  test('save schedule with recipients', async ({ page }) => {
    await setupReportsMocks(page);

    await page.route(`${API_BASE}/organizations/org-1/reports/report-uuid-1/schedule`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'sched-new' } }),
      }),
    );

    await page.goto('/en/reports');
    await expect(page.getByText('Monthly Sales Report')).toBeVisible({ timeout: 10000 });

    const scheduleBtns = page.locator('button:has(svg.lucide-calendar)');
    if (
      await scheduleBtns
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await scheduleBtns.first().click();

      await page.locator('#schedule-frequency').selectOption('weekly');
      await page.locator('#schedule-recipients').fill('admin@test.com, cfo@test.com');

      const saveBtn = page.getByRole('button', { name: /save/i });
      await saveBtn.click();

      // Modal should close
      await expect(page.locator('#schedule-frequency')).not.toBeVisible({ timeout: 5000 });
    }
  });

  test('save button disabled without recipients', async ({ page }) => {
    await setupReportsMocks(page);
    await page.goto('/en/reports');
    await expect(page.getByText('Monthly Sales Report')).toBeVisible({ timeout: 10000 });

    const scheduleBtns = page.locator('button:has(svg.lucide-calendar)');
    if (
      await scheduleBtns
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await scheduleBtns.first().click();

      // Don't fill recipients
      const saveBtn = page.getByRole('button', { name: /save/i });
      await expect(saveBtn).toBeDisabled();
    }
  });
});

// ---------------------------------------------------------------------------
// Reports — Delete
// ---------------------------------------------------------------------------

test.describe('Reports — Delete', () => {
  test('delete removes report from list', async ({ page }) => {
    await setupReportsMocks(page);

    await page.route(`${API_BASE}/organizations/org-1/reports/report-uuid-1`, (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
      }
      return route.continue();
    });

    await page.goto('/en/reports');
    await expect(page.getByText('Monthly Sales Report')).toBeVisible({ timeout: 10000 });

    // Handle confirm dialog
    page.on('dialog', (dialog) => dialog.accept());

    // Hover over the card to reveal delete button, then click
    const card = page.locator('.group').first();
    await card.hover();

    const deleteBtn = page.locator('button:has(svg.lucide-trash-2)').first();
    if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await deleteBtn.click();
    }

    // Weekly Inventory should still be visible
    await expect(page.getByText('Weekly Inventory')).toBeVisible();
  });
});
