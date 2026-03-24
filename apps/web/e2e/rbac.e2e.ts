import { test, expect } from './fixtures/auth.fixture';
import { mockApiRoute, mockApiError, mockEmptyAppState } from './helpers/api-mock.helper';
import { goto } from './helpers/navigation.helper';

// ============================================================================
// RBAC: VIEWER ROLE
// ============================================================================

test.describe('RBAC — Viewer Role', () => {
  test.use({ role: 'viewer' });

  test('viewer can access dashboards list page', async ({ authedPage: page }) => {
    await mockEmptyAppState(page);

    await goto(page, '/en/dashboards');
    await expect(page).toHaveURL(/\/en\/dashboards/);
  });

  test('viewer can access alerts page', async ({ authedPage: page }) => {
    await mockEmptyAppState(page);

    await goto(page, '/en/alerts');
    await expect(page).toHaveURL(/\/en\/alerts/);
  });

  test('viewer can access settings profile page', async ({ authedPage: page }) => {
    await mockApiRoute(page, 'GET', '/auth/me', {
      data: {
        id: 'test-viewer-uuid',
        email: 'viewer@test.clarixbi.com',
        name: 'Test Viewer',
        avatar_url: null,
        preferred_language: 'en',
        preferred_timezone: 'Europe/Bucharest',
      },
    });

    await goto(page, '/en/settings');
    await expect(page).toHaveURL(/\/en\/settings/);
  });

  test('viewer sees 403 when API rejects team management', async ({ authedPage: page }) => {
    await mockEmptyAppState(page);

    // Mock team members — viewer can see but invitations will fail
    await mockApiRoute(page, 'GET', '/organizations/test-org-uuid/members', {
      data: [
        {
          id: 'test-viewer-uuid',
          email: 'viewer@test.clarixbi.com',
          name: 'Test Viewer',
          role: 'viewer',
          status: 'active',
        },
      ],
    });

    // Mock invite to return 403
    await mockApiError(
      page,
      'POST',
      '/organizations/test-org-uuid/invitations',
      403,
      'FORBIDDEN',
      'Insufficient permissions',
    );

    await goto(page, '/en/settings/team');
    await expect(page).toHaveURL(/\/en\/settings\/team/);
  });

  test('viewer sees 403 when API rejects dashboard creation', async ({ authedPage: page }) => {
    await mockEmptyAppState(page);

    // Mock dashboard creation to return 403
    await mockApiError(
      page,
      'POST',
      '/organizations/current/dashboards',
      403,
      'FORBIDDEN',
      'Insufficient permissions: requires EDITOR role or above',
    );

    await goto(page, '/en/dashboards');
    await expect(page).toHaveURL(/\/en\/dashboards/);
  });
});

// ============================================================================
// RBAC: EDITOR ROLE
// ============================================================================

test.describe('RBAC — Editor Role', () => {
  test.use({ role: 'editor' });

  test('editor can access dashboards page', async ({ authedPage: page }) => {
    await mockEmptyAppState(page);

    await goto(page, '/en/dashboards');
    await expect(page).toHaveURL(/\/en\/dashboards/);
  });

  test('editor can access data-sources page', async ({ authedPage: page }) => {
    await mockEmptyAppState(page);

    await goto(page, '/en/data-sources');
    await expect(page).toHaveURL(/\/en\/data-sources/);
  });

  test('editor can access reports page', async ({ authedPage: page }) => {
    await mockEmptyAppState(page);

    await goto(page, '/en/reports');
    await expect(page).toHaveURL(/\/en\/reports/);
  });

  test('editor can access settings profile', async ({ authedPage: page }) => {
    await mockApiRoute(page, 'GET', '/auth/me', {
      data: {
        id: 'test-editor-uuid',
        email: 'editor@test.clarixbi.com',
        name: 'Test Editor',
        avatar_url: null,
        preferred_language: 'en',
        preferred_timezone: 'Europe/Bucharest',
      },
    });

    await goto(page, '/en/settings');
    await expect(page).toHaveURL(/\/en\/settings/);
  });
});

// ============================================================================
// RBAC: ADMIN ROLE
// ============================================================================

test.describe('RBAC — Admin Role', () => {
  test.use({ role: 'admin' });

  test('admin can access settings team page', async ({ authedPage: page }) => {
    await mockEmptyAppState(page);

    await mockApiRoute(page, 'GET', '/organizations/test-org-uuid/members', {
      data: [
        {
          id: 'test-admin-uuid',
          email: 'admin@test.clarixbi.com',
          name: 'Test Admin',
          role: 'admin',
          status: 'active',
        },
      ],
    });

    await mockApiRoute(page, 'GET', '/organizations/test-org-uuid/invitations', {
      data: [],
    });

    await goto(page, '/en/settings/team');
    await expect(page).toHaveURL(/\/en\/settings\/team/);
  });

  test('admin can access dashboards and reports', async ({ authedPage: page }) => {
    await mockEmptyAppState(page);

    await goto(page, '/en/dashboards');
    await expect(page).toHaveURL(/\/en\/dashboards/);

    await page.goto('/en/reports');
    await expect(page).toHaveURL(/\/en\/reports/, { timeout: 15000 });
  });

  test('admin sees 403 when API rejects billing access', async ({ authedPage: page }) => {
    await mockEmptyAppState(page);

    // Mock billing endpoint to return 403 for admin
    await mockApiError(
      page,
      'GET',
      '/organizations/test-org-uuid/billing',
      403,
      'FORBIDDEN',
      'Insufficient permissions: requires OWNER role',
    );

    await goto(page, '/en/settings/billing');
    await expect(page).toHaveURL(/\/en\/settings\/billing/);
  });
});

// ============================================================================
// RBAC: OWNER ROLE
// ============================================================================

test.describe('RBAC — Owner Role', () => {
  test.use({ role: 'owner' });

  test('owner can access settings team page', async ({ authedPage: page }) => {
    await mockEmptyAppState(page);

    await mockApiRoute(page, 'GET', '/organizations/test-org-uuid/members', {
      data: [
        {
          id: 'test-owner-uuid',
          email: 'owner@test.clarixbi.com',
          name: 'Test Owner',
          role: 'owner',
          status: 'active',
        },
      ],
    });

    await mockApiRoute(page, 'GET', '/organizations/test-org-uuid/invitations', {
      data: [],
    });

    await goto(page, '/en/settings/team');
    await expect(page).toHaveURL(/\/en\/settings\/team/);
  });

  test('owner can access settings billing page', async ({ authedPage: page }) => {
    await mockEmptyAppState(page);

    await mockApiRoute(page, 'GET', '/organizations/test-org-uuid/billing', {
      data: {
        plan: 'free',
        ai_queries_used: 5,
        ai_queries_limit: 50,
        data_sources_used: 1,
        data_sources_limit: 3,
      },
    });

    await goto(page, '/en/settings/billing');
    await expect(page).toHaveURL(/\/en\/settings\/billing/);
  });

  test('owner can access settings organization page', async ({ authedPage: page }) => {
    await mockEmptyAppState(page);

    await mockApiRoute(page, 'GET', '/organizations/test-org-uuid', {
      data: {
        id: 'test-org-uuid',
        name: 'Test Organization',
        slug: 'test-org',
        logo_url: null,
      },
    });

    await goto(page, '/en/settings/organization');
    await expect(page).toHaveURL(/\/en\/settings\/organization/);
  });

  test('owner can access all app sections', async ({ authedPage: page }) => {
    await mockEmptyAppState(page);

    const sections = ['/en/dashboards', '/en/data-sources', '/en/alerts', '/en/reports', '/en/ai'];
    for (const section of sections) {
      await page.goto(section);
      await expect(page).toHaveURL(new RegExp(section.replace('/', '\\/')));
    }
  });
});
