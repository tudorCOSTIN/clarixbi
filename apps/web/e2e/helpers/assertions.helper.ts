import { Page, expect } from '@playwright/test';

/**
 * Assert that a page has a visible heading (h1 or h2).
 */
export async function expectPageHeading(page: Page): Promise<void> {
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
}

/**
 * Assert that an element with the given text is visible.
 */
export async function expectVisible(page: Page, text: string | RegExp): Promise<void> {
  await expect(page.getByText(text)).toBeVisible({ timeout: 10000 });
}

/**
 * Assert that a specific nav item exists and is accessible.
 */
export async function expectNavItem(page: Page, name: RegExp): Promise<void> {
  await expect(page.getByRole('link', { name })).toBeVisible();
}

/**
 * Assert that the user name is visible in the navbar (authenticated state).
 */
export async function expectUserInNav(page: Page, name: string): Promise<void> {
  await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
}
