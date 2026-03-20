import { test, expect } from '@playwright/test';

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
          preferred_language: 'ro',
          preferred_timezone: 'Europe/Bucharest',
          organizations: [
            { id: 'org-1', name: 'Test Org', slug: 'test-org', logo_url: null, role: 'owner' },
          ],
        },
      }),
    }),
  );
}

async function setupOrgStore(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'clarixbi-org-store',
      JSON.stringify({ state: { currentOrgId: 'org-1' } }),
    );
  });
}

// ---------------------------------------------------------------------------
// Select SmartBill connector
// ---------------------------------------------------------------------------
test('Onboarding: SmartBill — enter creds, test connection, redirect to sync', async ({ page }) => {
  await mockAuthState(page);
  await mockAuthMeApi(page);
  await setupOrgStore(page);

  // Mock test-connection endpoint
  await page.route(`${API_BASE}/organizations/test/data-sources`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { ok: true } }),
    }),
  );

  // Mock connect endpoint — triggers redirect to /sync
  await page.route(`${API_BASE}/organizations/current/data-sources`, (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'ds-1', type: 'smartbill', name: 'SmartBill' } }),
      });
    }
    return route.continue();
  });

  await page.goto('/ro/connect');

  // Select SmartBill connector card
  await page.getByText('SmartBill').click();

  // Fill credentials
  await page.getByLabel(/email/i).fill('facturare@firma.ro');
  await page.getByLabel(/token/i).fill('sb-token-12345');

  // Test connection
  await page.getByRole('button', { name: /test/i }).click();
  await expect(page.getByText(/succes|success/i)).toBeVisible();

  // Connect and sync
  await page.getByRole('button', { name: /connect|sync|conectează/i }).click();

  await expect(page).toHaveURL(/\/sync/);
});

// ---------------------------------------------------------------------------
// Select Demo Data
// ---------------------------------------------------------------------------
test('Onboarding: Demo Data — loads demo and redirects', async ({ page }) => {
  await mockAuthState(page);
  await mockAuthMeApi(page);
  await setupOrgStore(page);

  // Mock demo-data endpoint
  await page.route(`${API_BASE}/onboarding/demo-data`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { ok: true } }),
    }),
  );

  await page.goto('/ro/connect');

  // Select Demo connector card
  await page.getByText(/demo/i).click();

  // Click load button
  await page.getByRole('button', { name: /load|încarcă|demo/i }).click();

  await expect(page).toHaveURL(/\/sync/);
});

// ---------------------------------------------------------------------------
// Select CSV Upload
// ---------------------------------------------------------------------------
test('Onboarding: CSV — upload file, verify schema preview, confirm', async ({ page }) => {
  await mockAuthState(page);
  await mockAuthMeApi(page);
  await setupOrgStore(page);

  // Mock upload endpoint
  await page.route(`${API_BASE}/organizations/current/data-sources/upload`, (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ data: { id: 'ds-csv-1' } }),
    }),
  );

  // Mock preview endpoint
  await page.route(`${API_BASE}/organizations/current/data-sources/ds-csv-1/preview`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          schema: [
            { name: 'date', type: 'date', sampleValues: ['2025-01-01'] },
            { name: 'amount', type: 'number', sampleValues: ['100.50'] },
            { name: 'description', type: 'string', sampleValues: ['Factura #1'] },
          ],
          rows: [
            { date: '2025-01-01', amount: '100.50', description: 'Factura #1' },
            { date: '2025-01-02', amount: '200.00', description: 'Factura #2' },
          ],
        },
      }),
    }),
  );

  // Mock schema confirm endpoint
  await page.route(`${API_BASE}/organizations/current/data-sources/ds-csv-1/schema`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { ok: true } }),
    }),
  );

  await page.goto('/ro/connect');

  // Select CSV connector card
  await page.getByText(/csv/i).click();

  // Upload a file via the hidden input
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'test-data.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'date,amount,description\n2025-01-01,100.50,Factura #1\n2025-01-02,200.00,Factura #2',
    ),
  });

  // Click upload button
  await page.getByRole('button', { name: /upload|încarcă/i }).click();

  // Verify schema preview is displayed (table with column headers)
  await expect(page.getByText('date')).toBeVisible();
  await expect(page.getByText('amount')).toBeVisible();
  await expect(page.getByText('description')).toBeVisible();

  // Confirm schema and import
  await page.getByRole('button', { name: /confirm|import|confirmă/i }).click();

  await expect(page).toHaveURL(/\/sync/);
});
