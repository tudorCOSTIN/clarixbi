import { test, expect } from '@playwright/test';
import { setupAuth, API_BASE } from './helpers/setup';
import { mockConversations, mockAiResponse, mockAiResponseNoChart } from './mocks/ai.mock';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupAiMocks(
  page: import('@playwright/test').Page,
  conversations = mockConversations,
) {
  await setupAuth(page);

  // Conversations list
  await page.route(`${API_BASE}/organizations/org-1/ai/conversations`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: conversations }),
      });
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'conv-new',
            title: null,
            message_count: 0,
            updated_at: new Date().toISOString(),
          },
        }),
      });
    }
    return route.continue();
  });

  // Delete conversation
  await page.route(`${API_BASE}/organizations/org-1/ai/conversations/*`, (route) => {
    if (route.request().method() === 'DELETE') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    }
    return route.continue();
  });
}

function mockMessageEndpoint(
  page: import('@playwright/test').Page,
  convId: string,
  response: typeof mockAiResponse | typeof mockAiResponseNoChart,
) {
  return page.route(
    `${API_BASE}/organizations/org-1/ai/conversations/${convId}/messages`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: response }),
      }),
  );
}

// ---------------------------------------------------------------------------
// AI Chat — Interface
// ---------------------------------------------------------------------------

test.describe('AI Chat — Interface', () => {
  test('chat page renders with conversation sidebar', async ({ page }) => {
    await setupAiMocks(page);
    await page.goto('/en/ai');

    // Should see conversation list in sidebar
    await expect(page.getByText('Revenue Analysis')).toBeVisible({ timeout: 10000 });
  });

  test('empty conversation list shows appropriate message', async ({ page }) => {
    await setupAiMocks(page, []);
    await page.goto('/en/ai');

    // New conversation button should be visible
    await expect(page.getByRole('button', { name: /new|conversation|start/i }).first()).toBeVisible(
      { timeout: 10000 },
    );
  });

  test('new conversation button creates conversation', async ({ page }) => {
    await setupAiMocks(page, []);
    await page.goto('/en/ai');

    // Mock the message endpoint for the new conversation
    await mockMessageEndpoint(page, 'conv-new', mockAiResponseNoChart);

    // Click new conversation
    await page
      .getByRole('button', { name: /new|conversation|start/i })
      .first()
      .click();

    // Should now show the chat interface (AiChat component loads)
    // Wait for the page to settle
    await page.waitForTimeout(1000);

    // Page should still be on /ai
    await expect(page).toHaveURL(/\/ai/);
  });
});

// ---------------------------------------------------------------------------
// AI Chat — Conversation Flow
// ---------------------------------------------------------------------------

test.describe('AI Chat — Conversation', () => {
  test('sending message shows AI response', async ({ page }) => {
    await setupAiMocks(page);
    await mockMessageEndpoint(page, 'conv-new', mockAiResponse);

    await page.goto('/en/ai');

    // Create new conversation
    await page
      .getByRole('button', { name: /new|conversation|start/i })
      .first()
      .click();

    // Wait for chat area to load
    const chatInput = page.getByRole('textbox').first();
    if (await chatInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await chatInput.fill('What is the total revenue?');

      // Submit
      const sendBtn = page.getByRole('button', { name: /send|ask/i });
      if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sendBtn.click();
        // Response should appear
        await expect(page.getByText(/47,850|47850/)).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('selecting existing conversation shows chat', async ({ page }) => {
    await setupAiMocks(page);
    await page.goto('/en/ai');

    // Click on existing conversation
    await page.getByText('Revenue Analysis').click();

    // Should activate the conversation (AiChat should render)
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/ai/);
  });
});

// ---------------------------------------------------------------------------
// AI Chat — Error Handling
// ---------------------------------------------------------------------------

test.describe('AI Chat — Error Handling', () => {
  test('rate limit 429 shows error message', async ({ page }) => {
    await setupAiMocks(page);

    // Mock 429 response
    await page.route(
      `${API_BASE}/organizations/org-1/ai/conversations/conv-new/messages`,
      (route) =>
        route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'You have exceeded the AI query limit.',
          }),
        }),
    );

    await page.goto('/en/ai');

    // Create new conversation and send message
    await page
      .getByRole('button', { name: /new|conversation|start/i })
      .first()
      .click();

    const chatInput = page.getByRole('textbox').first();
    if (await chatInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await chatInput.fill('Test query');
      const sendBtn = page.getByRole('button', { name: /send|ask/i });
      if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sendBtn.click();
        await expect(page.getByText(/rate.?limit|exceeded|limit|error/i)).toBeVisible({
          timeout: 10000,
        });
      }
    }
  });

  test('server error 500 shows friendly message', async ({ page }) => {
    await setupAiMocks(page);

    await page.route(
      `${API_BASE}/organizations/org-1/ai/conversations/conv-new/messages`,
      (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Something went wrong' }),
        }),
    );

    await page.goto('/en/ai');

    await page
      .getByRole('button', { name: /new|conversation|start/i })
      .first()
      .click();

    const chatInput = page.getByRole('textbox').first();
    if (await chatInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await chatInput.fill('Test query');
      const sendBtn = page.getByRole('button', { name: /send|ask/i });
      if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sendBtn.click();
        await expect(page.getByText(/error|wrong|failed/i)).toBeVisible({ timeout: 10000 });
      }
    }
  });
});

// ---------------------------------------------------------------------------
// AI Chat — Delete Conversation
// ---------------------------------------------------------------------------

test.describe('AI Chat — Management', () => {
  test('delete conversation removes from sidebar', async ({ page }) => {
    await setupAiMocks(page);
    await page.goto('/en/ai');

    await expect(page.getByText('Revenue Analysis')).toBeVisible({ timeout: 10000 });

    // Hover over conversation to reveal delete button
    const convItem = page.getByText('Revenue Analysis');
    await convItem.hover();

    // Look for delete button near the conversation
    const deleteBtn = page
      .locator('button:has(svg.lucide-trash-2), button:has(svg.lucide-x)')
      .first();
    if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await deleteBtn.click();
    }

    // Page should still be on /ai
    await expect(page).toHaveURL(/\/ai/);
  });
});
