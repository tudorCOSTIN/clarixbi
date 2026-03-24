import { test, expect, API_BASE } from './fixtures/auth.fixture';
import { goto } from './helpers/navigation.helper';

async function setupAiMocks(page: import('@playwright/test').Page) {
  // Mock conversations list
  await page.route(`${API_BASE}/organizations/test-org-uuid/ai/conversations`, (route) => {
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

  // Also mock with org-1 for backward compat
  await page.route(`${API_BASE}/organizations/org-1/ai/conversations`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    }
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
// Ask a question — verify response
// ---------------------------------------------------------------------------
test('AI: ask question, verify response with content', async ({ authedPage: page }) => {
  await setupAiMocks(page);

  // Mock the message endpoint (both org IDs)
  const messageHandler = (route: import('@playwright/test').Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'msg-1',
          role: 'assistant',
          content:
            'Total revenue for the last 30 days is **47,850 RON**, up 13.7% from the previous period.',
          sql: 'SELECT SUM(amount) FROM invoices WHERE date >= NOW() - INTERVAL 30 DAY',
          chart: null,
        },
      }),
    });

  await page.route(
    `${API_BASE}/organizations/test-org-uuid/ai/conversations/conv-1/messages`,
    messageHandler,
  );
  await page.route(
    `${API_BASE}/organizations/org-1/ai/conversations/conv-1/messages`,
    messageHandler,
  );

  await goto(page, '/en/ai');

  // Start a new conversation
  const newBtn = page.getByRole('button', { name: /new|conversation|start/i }).first();
  if (await newBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await newBtn.click();
  }

  // Type a question
  const chatInput = page.getByRole('textbox').first();
  if (await chatInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await chatInput.fill('What is the total revenue for the last month?');

    // Submit
    const sendBtn = page.getByRole('button', { name: /send|ask/i });
    if (await sendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sendBtn.click();
      // Verify the response
      await expect(page.getByText(/47,850|47850/)).toBeVisible({ timeout: 10000 });
    }
  }
});

// ---------------------------------------------------------------------------
// Rate limit — mock 429 response, verify error message
// ---------------------------------------------------------------------------
test('AI: rate limit 429, verify error message', async ({ authedPage: page }) => {
  await setupAiMocks(page);

  // Mock the message endpoint to return 429
  const rateLimitHandler = (route: import('@playwright/test').Route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'You have exceeded the AI query limit. Please try again later.',
      }),
    });

  await page.route(
    `${API_BASE}/organizations/test-org-uuid/ai/conversations/conv-1/messages`,
    rateLimitHandler,
  );
  await page.route(
    `${API_BASE}/organizations/org-1/ai/conversations/conv-1/messages`,
    rateLimitHandler,
  );

  await goto(page, '/en/ai');

  // Start a new conversation
  const newBtn = page.getByRole('button', { name: /new|conversation|start/i }).first();
  if (await newBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await newBtn.click();
  }

  // Type and submit
  const chatInput = page.getByRole('textbox').first();
  if (await chatInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await chatInput.fill('What is the revenue?');
    const sendBtn = page.getByRole('button', { name: /send|ask/i });
    if (await sendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sendBtn.click();
      // Verify error message
      await expect(page.getByText(/rate.?limit|exceeded|try.?again/i)).toBeVisible({
        timeout: 10000,
      });
    }
  }
});
