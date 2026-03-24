export const mockUserProfile = {
  id: 'user-1',
  email: 'test@clarixbi.com',
  name: 'Test User',
  avatar_url: null,
  preferred_language: 'en',
  preferred_timezone: 'Europe/Bucharest',
};

export const mockOrganization = {
  id: 'org-1',
  name: 'Test Org',
  slug: 'test-org',
  timezone: 'Europe/Bucharest',
  language: 'en',
  logo_url: null,
};

// TeamMember interface: { id, user_id, role, invite_email, invite_status, invite_expires_at, joined_at, user?: { id, name, email, avatar_url } }
export const mockTeamMembers = [
  {
    id: 'tm-1',
    user_id: 'user-1',
    role: 'owner',
    invite_email: null,
    invite_status: null,
    invite_expires_at: null,
    joined_at: '2026-01-01T00:00:00Z',
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@clarixbi.com',
      avatar_url: null,
    },
  },
  {
    id: 'tm-2',
    user_id: 'user-2',
    role: 'admin',
    invite_email: null,
    invite_status: null,
    invite_expires_at: null,
    joined_at: '2026-02-01T00:00:00Z',
    user: {
      id: 'user-2',
      name: 'Admin User',
      email: 'admin@clarixbi.com',
      avatar_url: null,
    },
  },
];

// Pending invites use same TeamMember structure but with invite_email and no user
export const mockPendingInvites = [
  {
    id: 'inv-1',
    user_id: '',
    role: 'editor',
    invite_email: 'pending@clarixbi.com',
    invite_status: 'pending',
    invite_expires_at: '2026-04-01T00:00:00Z',
    joined_at: null,
    user: undefined,
  },
];

// Billing data matches: { subscription: Subscription, usage: Usage }
// Subscription.plan is an object, not a string
export const mockBillingData = {
  subscription: {
    id: 'sub-1',
    status: 'active',
    billing_period: 'monthly',
    trial_ends_at: null,
    current_period_end: '2026-04-24T00:00:00Z',
    plan: {
      id: 'starter',
      name: 'starter',
      display_name: 'Starter',
      price_monthly_eur: 29,
      price_annual_eur: 290,
      limits: {
        max_data_sources: 5,
        max_dashboards: 10,
        max_team_members: 5,
        max_ai_queries_monthly: 50,
        max_alerts: 3,
      },
      features: ['5 data sources', '10 dashboards', '50 AI queries'],
    },
  },
  usage: {
    dataSources: { used: 2, limit: 5 },
    dashboards: { used: 3, limit: 10 },
    teamMembers: { used: 2, limit: 5 },
    aiQueries: { used: 15, limit: 50 },
    alerts: { used: 1, limit: 3 },
  },
};

// Plan interface: { id, name, display_name, price_monthly_eur, price_annual_eur, limits: PlanLimits, features: string[] }
export const mockPlans = [
  {
    id: 'free',
    name: 'free',
    display_name: 'Free',
    price_monthly_eur: 0,
    price_annual_eur: 0,
    limits: {
      max_data_sources: 1,
      max_dashboards: 2,
      max_team_members: 1,
      max_ai_queries_monthly: 10,
      max_alerts: 1,
    },
    features: ['1 data source', '2 dashboards', '10 AI queries'],
  },
  {
    id: 'starter',
    name: 'starter',
    display_name: 'Starter',
    price_monthly_eur: 29,
    price_annual_eur: 290,
    limits: {
      max_data_sources: 5,
      max_dashboards: 10,
      max_team_members: 5,
      max_ai_queries_monthly: 50,
      max_alerts: 3,
    },
    features: ['5 data sources', '10 dashboards', '50 AI queries'],
  },
  {
    id: 'business',
    name: 'business',
    display_name: 'Business',
    price_monthly_eur: 99,
    price_annual_eur: 990,
    limits: {
      max_data_sources: -1,
      max_dashboards: -1,
      max_team_members: -1,
      max_ai_queries_monthly: 500,
      max_alerts: -1,
    },
    features: ['Unlimited data sources', 'Unlimited dashboards', '500 AI queries'],
  },
];

// Invoice interface: { id, number, status, amount_paid, currency, created (unix timestamp), hosted_invoice_url }
export const mockInvoices = [
  {
    id: 'inv-stripe-1',
    number: 'INV-2026-001',
    status: 'paid',
    amount_paid: 2900,
    currency: 'eur',
    created: 1740787200,
    hosted_invoice_url: 'https://invoice.stripe.com/inv-1',
  },
];
