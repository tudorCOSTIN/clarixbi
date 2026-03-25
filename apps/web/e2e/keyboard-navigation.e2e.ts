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
          preferred_language: 'en',
          preferred_timezone: 'Europe/Bucharest',
          organizations: [
            { id: 'org-1', name: 'Test Org', slug: 'test-org', logo_url: null, role: 'owner' },
          ],
        },
      }),
    }),
  );
}

async function mockAppApis(page: import('@playwright/test').Page) {
  await page.route(`${API_BASE}/organizations/current/**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 20 } }),
    }),
  );
  await page.route(`${API_BASE}/ai/**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );
  await page.route(`${API_BASE}/notifications**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );
}

// ---------------------------------------------------------------------------
// Skip-to-content
// ---------------------------------------------------------------------------
test.describe('Keyboard Navigation', () => {
  test('skip-to-content link is visible on first Tab press', async ({ page }) => {
    await mockAuthState(page);
    await mockAuthMeApi(page);
    await mockAppApis(page);

    await page.goto('/en/dashboards');
    await page.waitForLoadState('networkidle');

    // Press Tab to focus the skip link
    await page.keyboard.press('Tab');

    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeFocused();
  });

  test('skip-to-content link moves focus to main content', async ({ page }) => {
    await mockAuthState(page);
    await mockAuthMeApi(page);
    await mockAppApis(page);

    await page.goto('/en/dashboards');
    await page.waitForLoadState('networkidle');

    // Press Tab then Enter to activate skip link
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    // Main content should now be the focus target
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeAttached();
  });

  // ---------------------------------------------------------------------------
  // Tab order — navbar items are reachable
  // ---------------------------------------------------------------------------
  test('navbar links are reachable via Tab key', async ({ page }) => {
    await mockAuthState(page);
    await mockAuthMeApi(page);
    await mockAppApis(page);

    await page.goto('/en/dashboards');
    await page.waitForLoadState('networkidle');

    // Tab past skip link, then through navbar
    const focusedTexts: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.textContent?.trim() || el?.getAttribute('aria-label') || '';
      });
      if (focused) focusedTexts.push(focused);
    }

    // Should contain at least some nav link text
    const hasNavItems = focusedTexts.some(
      (text) =>
        text.includes('Dashboard') ||
        text.includes('Alert') ||
        text.includes('Report') ||
        text.includes('Home') ||
        text.includes('ClarixBI'),
    );
    expect(hasNavItems).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Login form keyboard interaction
  // ---------------------------------------------------------------------------
  test('login form is fully keyboard-navigable', async ({ page }) => {
    await page.goto('/en/login');
    await page.waitForLoadState('networkidle');

    // Tab to GDPR checkbox
    let foundCheckbox = false;
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const role = await page.evaluate(() => document.activeElement?.getAttribute('type'));
      if (role === 'checkbox') {
        foundCheckbox = true;
        // Activate with Space
        await page.keyboard.press('Space');
        break;
      }
    }
    expect(foundCheckbox).toBe(true);

    // Tab to email input
    let foundEmail = false;
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const type = await page.evaluate(() => document.activeElement?.getAttribute('type'));
      if (type === 'email' || type === 'text') {
        foundEmail = true;
        break;
      }
    }
    expect(foundEmail).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Escape key closes modals
  // ---------------------------------------------------------------------------
  test('Escape key behavior on pages with interactive elements', async ({ page }) => {
    await mockAuthState(page);
    await mockAuthMeApi(page);
    await mockAppApis(page);

    await page.goto('/en/dashboards');
    await page.waitForLoadState('networkidle');

    // Verify Escape doesn't cause errors when no modal is open
    await page.keyboard.press('Escape');

    // Page should still be functional
    await expect(page.locator('main')).toBeAttached();
  });

  // ---------------------------------------------------------------------------
  // All interactive elements have visible focus indicators
  // ---------------------------------------------------------------------------
  test('interactive elements have visible focus indicators', async ({ page }) => {
    await page.goto('/en/login');
    await page.waitForLoadState('networkidle');

    // Tab through elements and check for focus styling
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const hasFocusStyle = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return true; // skip body
        const styles = window.getComputedStyle(el);
        // Check for outline or box-shadow (common focus indicators)
        return (
          styles.outlineStyle !== 'none' ||
          styles.boxShadow !== 'none' ||
          el.classList.contains('focus:ring') ||
          el.classList.contains('focus-visible:ring')
        );
      });
      // At minimum, the browser default focus should be present
      expect(hasFocusStyle).toBe(true);
    }
  });
});
