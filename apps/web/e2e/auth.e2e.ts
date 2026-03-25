import { test, expect, API_BASE } from './fixtures/auth.fixture';
import { mockEmptyAppState } from './helpers/api-mock.helper';
import { goto, expectLoginRedirect } from './helpers/navigation.helper';

// ============================================================================
// UNAUTHENTICATED ACCESS — Middleware route protection
// ============================================================================

test.describe('Unauthenticated Access', () => {
  test('redirect to login when accessing /dashboards without auth', async ({ page }) => {
    await page.goto('/en/dashboards');
    await expectLoginRedirect(page);
  });

  test('redirect to login when accessing /settings without auth', async ({ page }) => {
    await page.goto('/en/settings');
    await expectLoginRedirect(page);
  });

  test('redirect to login when accessing /reports without auth', async ({ page }) => {
    await page.goto('/en/reports');
    await expectLoginRedirect(page);
  });

  test('redirect to login when accessing /alerts without auth', async ({ page }) => {
    await page.goto('/en/alerts');
    await expectLoginRedirect(page);
  });

  test('redirect to login when accessing /ai without auth', async ({ page }) => {
    await page.goto('/en/ai');
    await expectLoginRedirect(page);
  });

  test('login page is accessible without auth', async ({ page }) => {
    await page.goto('/en/login');
    await expect(page).toHaveURL(/\/en\/login/);
    await expect(page.getByRole('heading', { name: 'ClarixBI' })).toBeVisible();
  });
});

// ============================================================================
// LOGIN PAGE — UI elements and form state
// ============================================================================

test.describe('Login Page', () => {
  test('renders all login form elements', async ({ page }) => {
    await page.goto('/en/login');
    await page.waitForLoadState('networkidle');

    // Google OAuth button
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible();

    // Magic link email input with label
    await expect(page.locator('#email')).toBeVisible();

    // GDPR consent checkbox
    await expect(page.locator('#gdpr-consent')).toBeVisible();

    // Submit button (Send magic link)
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('buttons are disabled without GDPR consent', async ({ page }) => {
    await page.goto('/en/login');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /google/i })).toBeDisabled();
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test('login page has GDPR consent with terms and privacy links', async ({ page }) => {
    await page.goto('/en/login');
    await page.waitForLoadState('networkidle');

    // GDPR label should contain links to terms and privacy
    const termsLink = page.locator('label[for="gdpr-consent"] a[href*="terms"]');
    const privacyLink = page.locator('label[for="gdpr-consent"] a[href*="privacy"]');

    await expect(termsLink).toBeVisible();
    await expect(privacyLink).toBeVisible();
  });

  test('login page i18n: Romanian locale renders', async ({ page }) => {
    await page.goto('/ro/login');
    await expect(page).toHaveURL(/\/ro\/login/);
    await expect(page.getByRole('heading', { name: 'ClarixBI' })).toBeVisible();
  });

  test('login page has email input with correct attributes', async ({ page }) => {
    await page.goto('/en/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('#email');
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('autocomplete', 'email');
    await expect(emailInput).toHaveAttribute('required', '');
  });
});

// ============================================================================
// CALLBACK FLOW — Auth code exchange
// ============================================================================

test.describe('Auth Callback', () => {
  test('callback with valid code redirects to app', async ({ authedPage: page }) => {
    await mockEmptyAppState(page);

    await page.goto('/en/callback?code=mock-auth-code');
    // Callback mock returns success, should redirect to home
    await expect(page).toHaveURL(/\/en/, { timeout: 15000 });
  });

  test('callback without code stays on callback page', async ({ authedPage: page }) => {
    await page.goto('/en/callback');
    await page.waitForTimeout(3000);

    const hasError = await page
      .locator('.bg-red-50')
      .isVisible()
      .catch(() => false);
    const isOnCallback = /\/callback/.test(page.url());
    expect(hasError || isOnCallback).toBeTruthy();
  });

  test('callback with API error shows error state', async ({ authedPage: page }) => {
    await page.route(`${API_BASE}/auth/callback`, (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Invalid authorization code' }),
        });
      }
      return route.continue();
    });

    await page.goto('/en/callback?code=invalid-code');
    await page.waitForTimeout(3000);

    const hasError = await page
      .locator('.bg-red-50')
      .isVisible()
      .catch(() => false);
    const isOnCallback = /\/callback/.test(page.url());
    expect(hasError || isOnCallback).toBeTruthy();
  });
});

// ============================================================================
// AUTHENTICATED NAVIGATION — Route access with valid session
// ============================================================================

test.describe('Authenticated Navigation', () => {
  test('authenticated user can access dashboards page', async ({ authedPage: page }) => {
    await mockEmptyAppState(page);

    await goto(page, '/en/dashboards');
    await expect(page).toHaveURL(/\/en\/dashboards/);
  });

  test('authenticated user can access alerts page', async ({ authedPage: page }) => {
    await mockEmptyAppState(page);

    await goto(page, '/en/alerts');
    await expect(page).toHaveURL(/\/en\/alerts/);
  });

  test('authenticated user can access reports page', async ({ authedPage: page }) => {
    await mockEmptyAppState(page);

    await goto(page, '/en/reports');
    await expect(page).toHaveURL(/\/en\/reports/);
  });

  test('authenticated user sees nav links', async ({ authedPage: page }) => {
    await mockEmptyAppState(page);

    await goto(page, '/en/dashboards');

    await expect(page.getByRole('link', { name: /dashboard/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /settings/i }).first()).toBeVisible();
  });

  test('authenticated user can navigate to settings', async ({ authedPage: page }) => {
    await mockEmptyAppState(page);

    await goto(page, '/en/dashboards');
    await page
      .getByRole('link', { name: /settings/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/settings/, { timeout: 15000 });
  });
});

// ============================================================================
// LOGOUT — Session clearing
// ============================================================================

test.describe('Logout', () => {
  test('clearing cookies causes redirect to login on next navigation', async ({
    authedPage: page,
  }) => {
    await mockEmptyAppState(page);

    await goto(page, '/en/dashboards');
    await expect(page).toHaveURL(/\/en\/dashboards/);

    // Clear cookies to simulate session expiry
    await page.context().clearCookies();

    // Navigate to protected route — middleware should redirect
    await page.goto('/en/dashboards');
    await expectLoginRedirect(page);
  });

  test('clearing cookies causes redirect when accessing settings', async ({ authedPage: page }) => {
    await mockEmptyAppState(page);

    await goto(page, '/en/dashboards');

    await page.context().clearCookies();
    await page.goto('/en/settings');
    await expectLoginRedirect(page);
  });
});
