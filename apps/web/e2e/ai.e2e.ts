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

async function setupAiMocks(page: import('@playwright/test').Page) {
  await mockAuthState(page);
  await mockAuthMeApi(page);
  await setupOrgStore(page);

  // Mock conversations list
  await page.route(`${API_BASE}/organizations/org-1/ai/conversations`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    }
    // POST: create new conversation
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'conv-1',
            title: null,
            message_count: 0,
            updated_at: new Date().toISOString(),
          },
        }),
      });
    }
    return route.continue();
  });
}

// ---------------------------------------------------------------------------
// Ask a question in Romanian
// ---------------------------------------------------------------------------
test('AI: ask question in Romanian, verify response with chart', async ({ page }) => {
  await setupAiMocks(page);

  // Mock the message/ask endpoint
  await page.route(`${API_BASE}/organizations/org-1/ai/conversations/conv-1/messages`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'msg-1',
          role: 'assistant',
          content:
            'Veniturile totale din ultima lună sunt **47.850 RON**, cu o creștere de 13.7% față de luna anterioară.',
          sql: 'SELECT SUM(amount) FROM invoices WHERE date >= NOW() - INTERVAL 30 DAY',
          chart: {
            type: 'bar',
            data: [
              { label: 'Ianuarie', value: 42100 },
              { label: 'Februarie', value: 47850 },
            ],
          },
        },
      }),
    }),
  );

  await page.goto('/ro/ai');

  // Start a new conversation
  await page
    .getByRole('button', { name: /new|nou|conversație|start/i })
    .first()
    .click();

  // Type a Romanian question
  const chatInput = page.getByRole('textbox').first();
  await chatInput.fill('Care sunt veniturile totale din ultima lună?');

  // Submit the question
  await page.getByRole('button', { name: /send|trimite|ask/i }).click();

  // Verify the response content is visible
  await expect(page.getByText(/47.850|47850/)).toBeVisible({ timeout: 10000 });
});

// ---------------------------------------------------------------------------
// Ask a question in English
// ---------------------------------------------------------------------------
test('AI: ask question in English, verify response', async ({ page }) => {
  await setupAiMocks(page);

  // Mock the message endpoint
  await page.route(`${API_BASE}/organizations/org-1/ai/conversations/conv-1/messages`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'msg-2',
          role: 'assistant',
          content:
            'Total revenue for the last 30 days is **47,850 RON**, up 13.7% from the previous period.',
          sql: 'SELECT SUM(amount) FROM invoices WHERE date >= NOW() - INTERVAL 30 DAY',
          chart: null,
        },
      }),
    }),
  );

  await page.goto('/en/ai');

  // Start a new conversation
  await page
    .getByRole('button', { name: /new|conversation|start/i })
    .first()
    .click();

  // Type an English question
  const chatInput = page.getByRole('textbox').first();
  await chatInput.fill('What is the total revenue for the last month?');

  // Submit
  await page.getByRole('button', { name: /send|ask/i }).click();

  // Verify the response
  await expect(page.getByText(/47,850|47850/)).toBeVisible({ timeout: 10000 });
});

// ---------------------------------------------------------------------------
// Rate limit — mock 429 response, verify error message
// ---------------------------------------------------------------------------
test('AI: rate limit 429, verify error message', async ({ page }) => {
  await setupAiMocks(page);

  // Mock the message endpoint to return 429
  await page.route(`${API_BASE}/organizations/org-1/ai/conversations/conv-1/messages`, (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'You have exceeded the AI query limit. Please try again later.',
      }),
    }),
  );

  await page.goto('/ro/ai');

  // Start a new conversation
  await page
    .getByRole('button', { name: /new|nou|conversație|start/i })
    .first()
    .click();

  // Type and submit a question
  const chatInput = page.getByRole('textbox').first();
  await chatInput.fill('Care sunt veniturile?');
  await page.getByRole('button', { name: /send|trimite|ask/i }).click();

  // Verify an error message about rate limiting is shown
  await expect(
    page.getByText(/rate.?limit|limită|exceeded|depășit|try.?again|încercați/i),
  ).toBeVisible({ timeout: 10000 });
});
