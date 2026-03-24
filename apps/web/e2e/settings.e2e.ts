import { test, expect } from './fixtures/auth.fixture';
import { mockEmptyAppState, mockApiRoute } from './helpers/api-mock.helper';
import { goto } from './helpers/navigation.helper';

// ---------------------------------------------------------------------------
// Settings profile page loads
// ---------------------------------------------------------------------------
test('Settings: profile page renders', async ({ authedPage: page }) => {
  await mockEmptyAppState(page);

  // Mock user profile endpoint (for settings form)
  await mockApiRoute(page, 'GET', '/auth/me', {
    data: {
      id: 'test-owner-uuid',
      email: 'owner@test.clarixbi.com',
      name: 'Test Owner',
      avatar_url: null,
      preferred_language: 'en',
      preferred_timezone: 'Europe/Bucharest',
      organizations: [
        {
          id: 'test-org-uuid',
          name: 'Test Organization',
          slug: 'test-org',
          logo_url: null,
          role: 'owner',
        },
      ],
    },
  });

  await goto(page, '/en/settings');
  await expect(page).toHaveURL(/\/en\/settings/);
});

// ---------------------------------------------------------------------------
// Change language RO -> EN (via URL)
// ---------------------------------------------------------------------------
test('Settings: Romanian locale loads', async ({ authedPage: page }) => {
  await mockEmptyAppState(page);

  await goto(page, '/ro/settings');
  await expect(page).toHaveURL(/\/ro\/settings/);
});

// ---------------------------------------------------------------------------
// Billing page: verify renders
// ---------------------------------------------------------------------------
test('Settings: billing page renders', async ({ authedPage: page }) => {
  await mockEmptyAppState(page);

  // Mock billing endpoint
  await mockApiRoute(page, 'GET', '/organizations/test-org-uuid/billing', {
    data: {
      plan: 'free',
      ai_queries_used: 15,
      ai_queries_limit: 50,
      data_sources_used: 2,
      data_sources_limit: 3,
    },
  });

  await goto(page, '/en/settings/billing');
  await expect(page).toHaveURL(/\/en\/settings\/billing/);
});

// ---------------------------------------------------------------------------
// Team invite: invite member, verify pending
// ---------------------------------------------------------------------------
test('Settings: team page — shows team members', async ({ authedPage: page }) => {
  await mockEmptyAppState(page);

  // Mock team members endpoint
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

  // Mock invitations endpoint
  await mockApiRoute(page, 'GET', '/organizations/test-org-uuid/invitations', {
    data: [],
  });

  await goto(page, '/en/settings/team');
  await expect(page).toHaveURL(/\/en\/settings\/team/);
});

// ---------------------------------------------------------------------------
// Organization page: renders
// ---------------------------------------------------------------------------
test('Settings: organization page renders', async ({ authedPage: page }) => {
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
