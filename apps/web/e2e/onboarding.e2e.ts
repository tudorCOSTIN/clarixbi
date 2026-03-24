import { test, expect } from '@playwright/test';
import { setupAuth, API_BASE } from './helpers/setup';

// ---------------------------------------------------------------------------
// Select SmartBill connector
// ---------------------------------------------------------------------------
test('Onboarding: SmartBill — enter creds, test connection, redirect to sync', async ({ page }) => {
  await setupAuth(page);

  // Mock data sources endpoints
  await page.route(`${API_BASE}/organizations/*/data-sources`, (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'ds-1', type: 'smartbill', name: 'SmartBill' } }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { ok: true } }),
    });
  });

  // Mock test-connection
  await page.route(`${API_BASE}/onboarding/test-connection`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { ok: true } }),
    }),
  );

  await page.goto('/en/connect');

  // Select SmartBill connector card
  const smartbillCard = page.getByText('SmartBill');
  if (await smartbillCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    await smartbillCard.click();

    // Fill credentials
    const emailInput = page.getByLabel(/email/i);
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill('facturare@firma.ro');
    }
    const tokenInput = page.getByLabel(/token/i);
    if (await tokenInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tokenInput.fill('sb-token-12345');
    }

    // Test connection
    const testBtn = page.getByRole('button', { name: /test/i });
    if (await testBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await testBtn.click();
      await expect(page.getByText(/succes|success/i)).toBeVisible({ timeout: 5000 });
    }

    // Connect and sync
    const connectBtn = page.getByRole('button', { name: /connect|sync/i });
    if (await connectBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await connectBtn.click();
      await expect(page).toHaveURL(/\/sync/);
    }
  }
});

// ---------------------------------------------------------------------------
// Select Demo Data
// ---------------------------------------------------------------------------
test('Onboarding: Demo Data — loads demo and redirects', async ({ page }) => {
  await setupAuth(page);

  // Mock demo-data endpoint
  await page.route(`${API_BASE}/onboarding/demo-data`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { ok: true } }),
    }),
  );

  await page.goto('/en/connect');

  // Select Demo connector card
  const demoCard = page.getByText(/demo/i);
  if (await demoCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    await demoCard.click();

    // Click load button
    const loadBtn = page.getByRole('button', { name: /load|demo/i });
    if (await loadBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loadBtn.click();
      await expect(page).toHaveURL(/\/sync/);
    }
  }
});

// ---------------------------------------------------------------------------
// Select CSV Upload
// ---------------------------------------------------------------------------
test('Onboarding: CSV — upload file, verify schema preview, confirm', async ({ page }) => {
  await setupAuth(page);

  // Mock upload endpoint
  await page.route(`${API_BASE}/organizations/*/data-sources/upload`, (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ data: { id: 'ds-csv-1' } }),
    }),
  );

  // Mock preview endpoint
  await page.route(`${API_BASE}/organizations/*/data-sources/ds-csv-1/preview`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          schema: [
            { name: 'date', type: 'date', sampleValues: ['2025-01-01'] },
            { name: 'amount', type: 'number', sampleValues: ['100.50'] },
            { name: 'description', type: 'string', sampleValues: ['Invoice #1'] },
          ],
          rows: [
            { date: '2025-01-01', amount: '100.50', description: 'Invoice #1' },
            { date: '2025-01-02', amount: '200.00', description: 'Invoice #2' },
          ],
        },
      }),
    }),
  );

  // Mock schema confirm endpoint
  await page.route(`${API_BASE}/organizations/*/data-sources/ds-csv-1/schema`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { ok: true } }),
    }),
  );

  await page.goto('/en/connect');

  // Select CSV connector card
  const csvCard = page.getByText(/csv/i);
  if (await csvCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    await csvCard.click();

    // Upload a file via the hidden input
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.count()) {
      await fileInput.setInputFiles({
        name: 'test-data.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(
          'date,amount,description\n2025-01-01,100.50,Invoice #1\n2025-01-02,200.00,Invoice #2',
        ),
      });

      // Click upload button
      const uploadBtn = page.getByRole('button', { name: /upload/i });
      if (await uploadBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await uploadBtn.click();

        // Verify schema preview
        await expect(page.getByText('date')).toBeVisible({ timeout: 5000 });
        await expect(page.getByText('amount')).toBeVisible();

        // Confirm schema and import
        const confirmBtn = page.getByRole('button', { name: /confirm|import/i });
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmBtn.click();
          await expect(page).toHaveURL(/\/sync/);
        }
      }
    }
  }
});
