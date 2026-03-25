import { Page } from '@playwright/test';

const API_BASE = process.env['E2E_API_URL'] || 'http://localhost:4000/api/v1';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Mock a specific API route with a successful response.
 * Matches both method and path.
 */
export async function mockApiRoute(
  page: Page,
  method: HttpMethod,
  path: string,
  response: unknown,
  status = 200,
): Promise<void> {
  await page.route(`${API_BASE}${path}`, (route) => {
    if (route.request().method() === method) {
      return route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    }
    return route.continue();
  });
}

/**
 * Mock a specific API route with an error response.
 */
export async function mockApiError(
  page: Page,
  method: HttpMethod,
  path: string,
  status: number,
  errorCode: string,
  message: string,
): Promise<void> {
  await page.route(`${API_BASE}${path}`, (route) => {
    if (route.request().method() === method) {
      return route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({
          error: errorCode,
          message,
          statusCode: status,
        }),
      });
    }
    return route.continue();
  });
}

/**
 * Mock the dashboards list endpoint with empty data.
 * Commonly needed after auth to prevent 404 on redirect to home.
 */
export async function mockEmptyDashboards(page: Page): Promise<void> {
  await mockApiRoute(page, 'GET', '/organizations/current/dashboards*', {
    data: [],
    meta: { page: 1, limit: 20, total: 0 },
  });
}

/**
 * Mock multiple GET endpoints with empty arrays.
 * Useful for loading authenticated pages without real data.
 */
export async function mockEmptyAppState(page: Page): Promise<void> {
  await mockEmptyDashboards(page);

  await mockApiRoute(page, 'GET', '/organizations/current/data-sources*', {
    data: [],
    meta: { page: 1, limit: 20, total: 0 },
  });

  await mockApiRoute(page, 'GET', '/organizations/current/alerts*', {
    data: [],
    meta: { page: 1, limit: 20, total: 0 },
  });

  await mockApiRoute(page, 'GET', '/organizations/current/reports*', {
    data: [],
    meta: { page: 1, limit: 20, total: 0 },
  });
}

export { API_BASE };
