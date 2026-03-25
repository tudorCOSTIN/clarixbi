import { Page, expect } from '@playwright/test';

/**
 * Navigate to a page and wait for hydration to complete.
 * Waits for the loading spinners to disappear.
 */
export async function goto(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await waitForPageReady(page);
}

/**
 * Wait for the page to be fully hydrated and interactive.
 * Looks for common loading indicators and waits for them to disappear.
 */
export async function waitForPageReady(page: Page): Promise<void> {
  // Wait for Next.js hydration — the page should have no loading spinners
  const spinner = page.locator('.animate-spin');
  try {
    // If a spinner is visible, wait for it to disappear (max 15s)
    if (await spinner.isVisible({ timeout: 1000 })) {
      await spinner.waitFor({ state: 'hidden', timeout: 15000 });
    }
  } catch {
    // No spinner found or it disappeared — page is ready
  }
}

/**
 * Assert that the current URL matches the expected path pattern.
 */
export async function expectUrl(page: Page, pattern: RegExp): Promise<void> {
  await expect(page).toHaveURL(pattern);
}

/**
 * Assert that we were redirected to login.
 */
export async function expectLoginRedirect(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/(ro|en)\/login/);
}
