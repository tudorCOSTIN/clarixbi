import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { BillingService, UsageInfo } from '../src/modules/billing/billing.service';
import {
  Subscription,
  SubscriptionStatus,
  BillingPeriod,
} from '../src/modules/billing/entities/subscription.entity';
import { Plan } from '../src/modules/billing/entities/plan.entity';
import { User } from '../src/modules/users/entities/user.entity';
import { EmailService } from '../src/modules/email/email.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = '00000000-0000-4000-a000-000000000001';
const PLAN_ID = '00000000-0000-4000-a000-000000000010';
const STARTER_PLAN_ID = '00000000-0000-4000-a000-000000000020';

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: PLAN_ID,
    name: 'pro',
    display_name: 'Pro',
    price_monthly_eur: 49,
    price_annual_eur: 468,
    stripe_price_monthly_id: 'price_monthly_xxx',
    stripe_price_annual_id: 'price_annual_xxx',
    limits: {
      max_data_sources: 10,
      max_dashboards: 50,
      max_team_members: 10,
      max_ai_queries_monthly: 1000,
      max_alerts: 20,
    },
    features: ['feature_a'],
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as Plan;
}

function makeStarterPlan(): Plan {
  return makePlan({
    id: STARTER_PLAN_ID,
    name: 'starter',
    display_name: 'Starter',
    price_monthly_eur: 0,
    price_annual_eur: 0,
    stripe_price_monthly_id: null,
    stripe_price_annual_id: null,
    limits: {
      max_data_sources: 1,
      max_dashboards: 3,
      max_team_members: 1,
      max_ai_queries_monthly: 100,
      max_alerts: 3,
    },
  });
}

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + 1);
  return {
    id: 'sub-uuid',
    org_id: ORG_ID,
    plan_id: PLAN_ID,
    stripe_subscription_id: 'sub_stripe_123',
    stripe_customer_id: 'cus_existing_123',
    status: SubscriptionStatus.ACTIVE,
    billing_period: BillingPeriod.MONTHLY,
    trial_ends_at: null,
    current_period_start: now,
    current_period_end: end,
    canceled_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  } as Subscription;
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function mockRepository(): Record<string, jest.Mock> {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve({ id: 'generated-id', ...entity })),
    createQueryBuilder: jest.fn(),
  };
}

// Capture fetch calls
const fetchSpy = jest.spyOn(globalThis, 'fetch');

// ---------------------------------------------------------------------------
// Helper: build a test module with a given STRIPE_SECRET_KEY
// ---------------------------------------------------------------------------

async function buildModule(stripeKey: string) {
  const subRepo = mockRepository();
  const planRepo = mockRepository();
  const userRepo = mockRepository();
  const dataSourceMock = { query: jest.fn() };
  const emailService = {
    sendTrialExpired: jest.fn().mockResolvedValue(undefined),
    sendTrialReminder: jest.fn().mockResolvedValue(undefined),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      BillingService,
      { provide: getRepositoryToken(Subscription), useValue: subRepo },
      { provide: getRepositoryToken(Plan), useValue: planRepo },
      { provide: getRepositoryToken(User), useValue: userRepo },
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((key: string) => {
            const map: Record<string, string> = {
              STRIPE_SECRET_KEY: stripeKey,
              NEXT_PUBLIC_APP_URL: 'https://app.clarixbi.com',
            };
            return map[key] ?? '';
          }),
        },
      },
      { provide: DataSource, useValue: dataSourceMock },
      { provide: EmailService, useValue: emailService },
    ],
  }).compile();

  return {
    service: module.get<BillingService>(BillingService),
    subRepo,
    planRepo,
    userRepo,
    dataSourceMock,
    emailService,
  };
}

// ===========================================================================
// REAL Stripe path (STRIPE_SECRET_KEY is set)
// ===========================================================================

describe('BillingService — Real Stripe path (key present)', () => {
  let service: BillingService;
  let subRepo: Record<string, jest.Mock>;
  let planRepo: Record<string, jest.Mock>;
  let dataSourceMock: { query: jest.Mock };
  let emailService: { sendTrialExpired: jest.Mock; sendTrialReminder: jest.Mock };

  beforeEach(async () => {
    fetchSpy.mockReset();
    const ctx = await buildModule('sk_test_fake');
    service = ctx.service;
    subRepo = ctx.subRepo;
    planRepo = ctx.planRepo;
    dataSourceMock = ctx.dataSourceMock;
    emailService = ctx.emailService;
  });

  afterAll(() => {
    fetchSpy.mockRestore();
  });

  // -----------------------------------------------------------------------
  // getOrCreateStripeCustomer — real
  // -----------------------------------------------------------------------

  test('creates a new Stripe customer via API when none exists', async () => {
    subRepo.findOne.mockResolvedValue(null);

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'cus_new_abc123' }),
    } as Response);

    const customerId = await service.getOrCreateStripeCustomer(ORG_ID, 'user@clarixbi.com');

    expect(customerId).toBe('cus_new_abc123');
    expect(customerId).not.toMatch(/^cus_mock_/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.stripe.com/v1/customers');
    expect(opts?.method).toBe('POST');
    expect(opts?.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer sk_test_fake' }),
    );
    expect(opts?.body).toContain('email=user%40clarixbi.com');
  });

  test('returns existing customer without calling Stripe', async () => {
    subRepo.findOne.mockResolvedValue(makeSub({ stripe_customer_id: 'cus_existing_123' }));

    const customerId = await service.getOrCreateStripeCustomer(ORG_ID, 'user@clarixbi.com');

    expect(customerId).toBe('cus_existing_123');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // createCheckoutSession — real
  // -----------------------------------------------------------------------

  test('creates a Stripe Checkout Session via API', async () => {
    planRepo.findOne.mockResolvedValue(makePlan());
    subRepo.findOne.mockResolvedValue(makeSub());

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ url: 'https://checkout.stripe.com/c/pay_xxx' }),
    } as Response);

    const url = await service.createCheckoutSession(
      ORG_ID,
      'user@clarixbi.com',
      PLAN_ID,
      BillingPeriod.MONTHLY,
    );

    expect(url).toBe('https://checkout.stripe.com/c/pay_xxx');
    expect(url).not.toContain('mock_cs_');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [fetchUrl, fetchOpts] = fetchSpy.mock.calls[0];
    expect(fetchUrl).toBe('https://api.stripe.com/v1/checkout/sessions');

    const body = fetchOpts?.body as string;
    expect(body).toContain('mode=subscription');
    expect(body).toContain('customer=cus_existing_123');
    expect(body).toContain(encodeURIComponent('price_monthly_xxx'));
    expect(body).toContain(encodeURIComponent(ORG_ID));
  });

  test('createCheckoutSession uses annual price when billing period is ANNUAL', async () => {
    planRepo.findOne.mockResolvedValue(makePlan());
    subRepo.findOne.mockResolvedValue(makeSub());

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ url: 'https://checkout.stripe.com/c/pay_annual' }),
    } as Response);

    await service.createCheckoutSession(ORG_ID, 'user@clarixbi.com', PLAN_ID, BillingPeriod.ANNUAL);

    const body = fetchSpy.mock.calls[0][1]?.body as string;
    expect(body).toContain(encodeURIComponent('price_annual_xxx'));
  });

  // -----------------------------------------------------------------------
  // createPortalSession — real
  // -----------------------------------------------------------------------

  test('creates a Stripe Portal Session via API', async () => {
    subRepo.findOne.mockResolvedValue(makeSub());

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ url: 'https://billing.stripe.com/p/session_xxx' }),
    } as Response);

    const url = await service.createPortalSession(ORG_ID);

    expect(url).toBe('https://billing.stripe.com/p/session_xxx');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [fetchUrl, fetchOpts] = fetchSpy.mock.calls[0];
    expect(fetchUrl).toBe('https://api.stripe.com/v1/billing_portal/sessions');
    expect(fetchOpts?.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer sk_test_fake' }),
    );
    const body = fetchOpts?.body as string;
    expect(body).toContain('customer=cus_existing_123');
  });

  // -----------------------------------------------------------------------
  // getInvoices — real
  // -----------------------------------------------------------------------

  test('fetches invoices from Stripe API', async () => {
    subRepo.findOne.mockResolvedValue(makeSub());

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              id: 'inv_001',
              number: 'INV-001',
              status: 'paid',
              amount_due: 4900,
              amount_paid: 4900,
              currency: 'eur',
              created: 1700000000,
              hosted_invoice_url: 'https://invoice.stripe.com/i/xxx',
              invoice_pdf: 'https://pay.stripe.com/invoice/xxx/pdf',
            },
          ],
        }),
    } as Response);

    const invoices = await service.getInvoices(ORG_ID);

    expect(invoices).toHaveLength(1);
    expect(invoices[0]).toEqual(
      expect.objectContaining({ id: 'inv_001', status: 'paid', amount_due: 4900 }),
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const fetchUrl = fetchSpy.mock.calls[0][0] as string;
    expect(fetchUrl).toContain('https://api.stripe.com/v1/invoices');
    expect(fetchUrl).toContain('customer=cus_existing_123');
  });

  // -----------------------------------------------------------------------
  // changePlan — real
  // -----------------------------------------------------------------------

  test('changePlan updates subscription plan_id', async () => {
    const existingSub = makeSub();
    subRepo.findOne.mockResolvedValue(existingSub);

    const enterprisePlan = makePlan({ id: 'enterprise-id', name: 'enterprise' });
    planRepo.findOne.mockResolvedValue(enterprisePlan);

    const result = await service.changePlan(ORG_ID, 'enterprise-id');

    expect(subRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ plan_id: 'enterprise-id' }),
    );
    expect(result).toEqual(expect.objectContaining({ plan_id: 'enterprise-id' }));
  });

  // -----------------------------------------------------------------------
  // cancelSubscription — real
  // -----------------------------------------------------------------------

  test('cancelSubscription sets status CANCELED', async () => {
    const existingSub = makeSub({ status: SubscriptionStatus.ACTIVE });
    subRepo.findOne.mockResolvedValue(existingSub);

    const result = await service.cancelSubscription(ORG_ID);

    expect(subRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: SubscriptionStatus.CANCELED }),
    );
    expect(result.canceled_at).toBeInstanceOf(Date);
  });

  // -----------------------------------------------------------------------
  // getUsage — real
  // -----------------------------------------------------------------------

  test('getUsage returns counts from DB', async () => {
    subRepo.findOne.mockResolvedValue(makeSub({ plan: makePlan() } as Partial<Subscription>));

    dataSourceMock.query
      .mockResolvedValueOnce([{ count: '3' }]) // data_sources
      .mockResolvedValueOnce([{ count: '7' }]) // dashboards
      .mockResolvedValueOnce([{ count: '2' }]) // team_members
      .mockResolvedValueOnce([{ count: '5' }]); // alerts

    const usage: UsageInfo = await service.getUsage(ORG_ID);

    expect(usage.dataSources).toEqual({ used: 3, limit: 10 });
    expect(usage.dashboards).toEqual({ used: 7, limit: 50 });
    expect(usage.teamMembers).toEqual({ used: 2, limit: 10 });
    expect(usage.alerts).toEqual({ used: 5, limit: 20 });
    expect(usage.aiQueries).toEqual({ used: 0, limit: 1000 });
  });

  // -----------------------------------------------------------------------
  // checkTrialExpiry
  // -----------------------------------------------------------------------

  test('checkTrialExpiry downgrades expired trials', async () => {
    const expiredTrial = makeSub({
      status: SubscriptionStatus.TRIALING,
      trial_ends_at: new Date('2020-01-01'),
    });

    subRepo.find.mockResolvedValue([expiredTrial]);
    planRepo.findOne.mockResolvedValue(makeStarterPlan());

    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    } as unknown as SelectQueryBuilder<Subscription>;
    subRepo.createQueryBuilder.mockReturnValue(qb);

    dataSourceMock.query.mockResolvedValue([{ email: 'owner@clarixbi.com' }]);

    const count = await service.checkTrialExpiry();

    expect(count).toBe(1);
    expect(subRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: SubscriptionStatus.UNPAID,
        plan_id: STARTER_PLAN_ID,
      }),
    );
    expect(emailService.sendTrialExpired).toHaveBeenCalledWith('owner@clarixbi.com');
  });
});

// ===========================================================================
// MOCK Stripe path (STRIPE_SECRET_KEY is empty)
// ===========================================================================

describe('BillingService — Mock Stripe path (no key)', () => {
  let service: BillingService;
  let subRepo: Record<string, jest.Mock>;
  let planRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    fetchSpy.mockReset();
    const ctx = await buildModule('');
    service = ctx.service;
    subRepo = ctx.subRepo;
    planRepo = ctx.planRepo;
  });

  afterAll(() => {
    fetchSpy.mockRestore();
  });

  // -----------------------------------------------------------------------
  // getOrCreateStripeCustomer — mock
  // -----------------------------------------------------------------------

  test('returns cus_mock_ ID without calling Stripe API', async () => {
    subRepo.findOne.mockResolvedValue(null);

    const customerId = await service.getOrCreateStripeCustomer(ORG_ID, 'user@clarixbi.com');

    expect(customerId).toMatch(/^cus_mock_\d+$/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('still returns existing customer without calling Stripe', async () => {
    subRepo.findOne.mockResolvedValue(makeSub({ stripe_customer_id: 'cus_existing_123' }));

    const customerId = await service.getOrCreateStripeCustomer(ORG_ID, 'user@clarixbi.com');

    expect(customerId).toBe('cus_existing_123');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // createCheckoutSession — mock
  // -----------------------------------------------------------------------

  test('returns mock URL without calling Stripe API', async () => {
    planRepo.findOne.mockResolvedValue(makePlan());
    // Need to return a sub with stripe_customer_id so getOrCreateStripeCustomer
    // returns existing customer (not trigger createStripeCustomer mock)
    subRepo.findOne.mockResolvedValue(makeSub());

    const url = await service.createCheckoutSession(
      ORG_ID,
      'user@clarixbi.com',
      PLAN_ID,
      BillingPeriod.MONTHLY,
    );

    expect(url).toContain('mock_cs_');
    expect(url).toContain('https://app.clarixbi.com');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('returns mock URL for plan with null stripe price IDs', async () => {
    planRepo.findOne.mockResolvedValue(
      makePlan({ stripe_price_monthly_id: null, stripe_price_annual_id: null }),
    );
    subRepo.findOne.mockResolvedValue(makeSub());

    const url = await service.createCheckoutSession(
      ORG_ID,
      'user@clarixbi.com',
      PLAN_ID,
      BillingPeriod.MONTHLY,
    );

    expect(url).toContain('mock_cs_');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // createPortalSession — mock
  // -----------------------------------------------------------------------

  test('returns app URL without calling Stripe API', async () => {
    subRepo.findOne.mockResolvedValue(makeSub());

    const url = await service.createPortalSession(ORG_ID);

    expect(url).toBe('https://app.clarixbi.com/settings/billing');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('returns app URL when no stripe_customer_id', async () => {
    subRepo.findOne.mockResolvedValue(makeSub({ stripe_customer_id: null }));

    const url = await service.createPortalSession(ORG_ID);

    expect(url).toBe('https://app.clarixbi.com/settings/billing');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // getInvoices — mock
  // -----------------------------------------------------------------------

  test('returns empty array without calling Stripe API', async () => {
    subRepo.findOne.mockResolvedValue(makeSub());

    const invoices = await service.getInvoices(ORG_ID);

    expect(invoices).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('returns empty array when no subscription', async () => {
    subRepo.findOne.mockResolvedValue(null);

    const invoices = await service.getInvoices(ORG_ID);

    expect(invoices).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // subscribe — mock (createStripeSubscription always returns sub_mock_)
  // -----------------------------------------------------------------------

  test('subscribe returns sub_mock_ subscription ID', async () => {
    planRepo.findOne.mockResolvedValue(makePlan());
    subRepo.findOne.mockResolvedValue(null);
    subRepo.create.mockImplementation((dto) => dto);

    const result = await service.subscribe(ORG_ID, PLAN_ID, 'pm_mock_123');

    expect(result.stripe_subscription_id).toMatch(/^sub_mock_\d+$/);
    expect(result.status).toBe(SubscriptionStatus.ACTIVE);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
