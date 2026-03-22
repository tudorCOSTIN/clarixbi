import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { BillingService } from './billing.service';
import { Plan } from './entities/plan.entity';
import { Subscription, SubscriptionStatus, BillingPeriod } from './entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { EmailService } from '../email/email.service';

jest.mock('./billing.utils', () => ({
  encryptStripeId: jest.fn((id: string | null) => id),
  decryptStripeId: jest.fn((id: string | null) => id),
}));

// Mock global fetch to prevent real Stripe API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

type MockRepository<T extends Record<string, any> = any> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockQueryBuilder = () => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue([]),
});

const createMockRepository = (): MockRepository => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(createMockQueryBuilder()),
});

describe('BillingService', () => {
  let service: BillingService;
  let subscriptionRepo: MockRepository<Subscription>;
  let planRepo: MockRepository<Plan>;

  const orgId = 'org-uuid-1';
  const planId = 'plan-uuid-1';

  const mockPlan: Partial<Plan> = {
    id: planId,
    name: 'pro',
    display_name: 'Pro Plan',
    price_monthly_eur: 29,
    price_annual_eur: 290,
    is_active: true,
    limits: {
      max_data_sources: 10,
      max_dashboards: 20,
      max_team_members: 10,
      max_ai_queries_monthly: 1000,
      max_alerts: 50,
    },
    features: ['ai_assistant', 'pdf_export'],
  };

  beforeEach(async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ id: 'cus_test123', email: 'test@test.com', object: 'customer' }),
    });

    subscriptionRepo = createMockRepository();
    planRepo = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionRepo,
        },
        {
          provide: getRepositoryToken(Plan),
          useValue: planRepo,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'STRIPE_SECRET_KEY') return 'sk_test_mock';
              return undefined;
            }),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepository(),
        },
        {
          provide: DataSource,
          useValue: {
            query: jest.fn().mockResolvedValue([{ count: '0' }]),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendTrialExpired: jest.fn(),
            sendTrialReminder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  // ---------------------------------------------------------------------------
  // getOrCreateStripeCustomer
  // ---------------------------------------------------------------------------
  describe('getOrCreateStripeCustomer', () => {
    it('should return existing stripe_customer_id when subscription exists', async () => {
      subscriptionRepo.findOne!.mockResolvedValue({
        id: 'sub-1',
        org_id: orgId,
        stripe_customer_id: 'cus_existing_123',
      } as Partial<Subscription>);

      const result = await service.getOrCreateStripeCustomer(orgId, 'test@example.com');

      expect(result).toBe('cus_existing_123');
      expect(subscriptionRepo.save).not.toHaveBeenCalled();
    });

    it('should create a new Stripe customer when no customer ID exists', async () => {
      const existingSub = {
        id: 'sub-1',
        org_id: orgId,
        stripe_customer_id: null,
      };
      subscriptionRepo.findOne!.mockResolvedValue(existingSub);
      subscriptionRepo.save!.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.getOrCreateStripeCustomer(orgId, 'test@example.com');

      expect(result).toBe('cus_test123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.stripe.com/v1/customers',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(subscriptionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ stripe_customer_id: 'cus_test123' }),
      );
    });

    it('should create a new customer when no subscription exists at all', async () => {
      subscriptionRepo.findOne!.mockResolvedValue(null);

      const result = await service.getOrCreateStripeCustomer(orgId, 'test@example.com');

      expect(result).toBe('cus_test123');
      expect(mockFetch).toHaveBeenCalled();
      // No subscription to update
      expect(subscriptionRepo.save).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // startTrial
  // ---------------------------------------------------------------------------
  describe('startTrial', () => {
    it('should create a 14-day trial subscription', async () => {
      planRepo.findOne!.mockResolvedValue(mockPlan);
      subscriptionRepo.findOne!.mockResolvedValue(null);
      subscriptionRepo.create!.mockImplementation((dto) => dto);
      subscriptionRepo.save!.mockImplementation((entity) =>
        Promise.resolve({ id: 'sub-new', ...entity }),
      );

      const result = await service.startTrial(orgId, planId);

      expect(result.status).toBe(SubscriptionStatus.TRIALING);
      expect(result.billing_period).toBe(BillingPeriod.MONTHLY);
      expect(result.plan_id).toBe(planId);

      // trial_ends_at should be ~14 days from now
      const trialEnd = new Date(result.trial_ends_at!);
      const now = new Date();
      const diffDays = Math.round((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(13);
      expect(diffDays).toBeLessThanOrEqual(14);
    });

    it('should throw ConflictException if organization already has a subscription', async () => {
      planRepo.findOne!.mockResolvedValue(mockPlan);
      subscriptionRepo.findOne!.mockResolvedValue({
        id: 'sub-existing',
        org_id: orgId,
      });

      await expect(service.startTrial(orgId, planId)).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if plan does not exist', async () => {
      planRepo.findOne!.mockResolvedValue(null);

      await expect(service.startTrial(orgId, 'bad-plan')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // subscribe
  // ---------------------------------------------------------------------------
  describe('subscribe', () => {
    it('should create a new ACTIVE subscription', async () => {
      planRepo.findOne!.mockResolvedValue(mockPlan);
      subscriptionRepo.findOne!.mockResolvedValue(null);
      subscriptionRepo.create!.mockImplementation((dto) => dto);
      subscriptionRepo.save!.mockImplementation((entity) =>
        Promise.resolve({ id: 'sub-new', ...entity }),
      );

      const result = await service.subscribe(orgId, planId, 'pm_mock_123');

      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
      expect(result.plan_id).toBe(planId);
      expect(result.stripe_subscription_id).toMatch(/^sub_mock_/);
    });

    it('should upgrade an existing subscription to ACTIVE', async () => {
      planRepo.findOne!.mockResolvedValue(mockPlan);
      const existingSub: Partial<Subscription> = {
        id: 'sub-existing',
        org_id: orgId,
        plan_id: 'old-plan',
        status: SubscriptionStatus.TRIALING,
        stripe_customer_id: 'cus_123',
        trial_ends_at: new Date(),
        canceled_at: null,
      };
      subscriptionRepo.findOne!.mockResolvedValue(existingSub);
      subscriptionRepo.save!.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.subscribe(orgId, planId, 'pm_mock_123');

      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
      expect(result.plan_id).toBe(planId);
      expect(result.trial_ends_at).toBeNull();
      expect(result.canceled_at).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // changePlan
  // ---------------------------------------------------------------------------
  describe('changePlan', () => {
    it('should update the plan on an existing subscription', async () => {
      const newPlanId = 'plan-uuid-2';
      const newPlan: Partial<Plan> = { ...mockPlan, id: newPlanId, name: 'enterprise' };
      const existingSub: Partial<Subscription> = {
        id: 'sub-1',
        org_id: orgId,
        plan_id: planId,
        status: SubscriptionStatus.ACTIVE,
      };

      subscriptionRepo.findOne!.mockResolvedValue(existingSub);
      planRepo.findOne!.mockResolvedValue(newPlan);
      subscriptionRepo.save!.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.changePlan(orgId, newPlanId);

      expect(result.plan_id).toBe(newPlanId);
    });

    it('should throw NotFoundException if no subscription exists', async () => {
      subscriptionRepo.findOne!.mockResolvedValue(null);

      await expect(service.changePlan(orgId, 'plan-2')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if new plan does not exist', async () => {
      subscriptionRepo.findOne!.mockResolvedValue({
        id: 'sub-1',
        org_id: orgId,
      });
      planRepo.findOne!.mockResolvedValue(null);

      await expect(service.changePlan(orgId, 'bad-plan')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // cancelSubscription
  // ---------------------------------------------------------------------------
  describe('cancelSubscription', () => {
    it('should set status to CANCELED and record canceled_at timestamp', async () => {
      const existingSub: Partial<Subscription> = {
        id: 'sub-1',
        org_id: orgId,
        status: SubscriptionStatus.ACTIVE,
        canceled_at: null,
      };
      subscriptionRepo.findOne!.mockResolvedValue(existingSub);
      subscriptionRepo.save!.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.cancelSubscription(orgId);

      expect(result.status).toBe(SubscriptionStatus.CANCELED);
      expect(result.canceled_at).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException if no subscription exists', async () => {
      subscriptionRepo.findOne!.mockResolvedValue(null);

      await expect(service.cancelSubscription(orgId)).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // getCurrentSubscription
  // ---------------------------------------------------------------------------
  describe('getCurrentSubscription', () => {
    it('should return the subscription with plan relation', async () => {
      const sub: Partial<Subscription> = {
        id: 'sub-1',
        org_id: orgId,
        plan_id: planId,
        plan: mockPlan as Plan,
        status: SubscriptionStatus.ACTIVE,
      };
      subscriptionRepo.findOne!.mockResolvedValue(sub);

      const result = await service.getCurrentSubscription(orgId);

      expect(subscriptionRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { org_id: orgId },
          relations: ['plan'],
        }),
      );
      expect(result.plan).toBeDefined();
    });

    it('should throw NotFoundException if no subscription found', async () => {
      subscriptionRepo.findOne!.mockResolvedValue(null);

      await expect(service.getCurrentSubscription(orgId)).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // getPlans
  // ---------------------------------------------------------------------------
  describe('getPlans', () => {
    it('should return active plans sorted by price ascending', async () => {
      const plans: Partial<Plan>[] = [
        { ...mockPlan, id: 'p1', price_monthly_eur: 0 },
        { ...mockPlan, id: 'p2', price_monthly_eur: 29 },
        { ...mockPlan, id: 'p3', price_monthly_eur: 99 },
      ];
      planRepo.find!.mockResolvedValue(plans);

      const result = await service.getPlans();

      expect(planRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { is_active: true },
          order: { price_monthly_eur: 'ASC' },
        }),
      );
      expect(result).toHaveLength(3);
    });
  });

  // ---------------------------------------------------------------------------
  // checkTrialExpiry
  // ---------------------------------------------------------------------------
  describe('checkTrialExpiry', () => {
    it('should update expired trials to UNPAID status', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const expiredTrials: Partial<Subscription>[] = [
        {
          id: 'sub-1',
          org_id: 'org-1',
          status: SubscriptionStatus.TRIALING,
          trial_ends_at: pastDate,
        },
        {
          id: 'sub-2',
          org_id: 'org-2',
          status: SubscriptionStatus.TRIALING,
          trial_ends_at: pastDate,
        },
      ];
      subscriptionRepo.find!.mockResolvedValue(expiredTrials);
      subscriptionRepo.save!.mockImplementation((entity) => Promise.resolve(entity));

      const count = await service.checkTrialExpiry();

      expect(count).toBe(2);
      expect(subscriptionRepo.save).toHaveBeenCalledTimes(2);

      // Each trial should have been set to UNPAID
      for (const trial of expiredTrials) {
        expect(trial.status).toBe(SubscriptionStatus.UNPAID);
      }
    });

    it('should return 0 when no expired trials exist', async () => {
      subscriptionRepo.find!.mockResolvedValue([]);

      const count = await service.checkTrialExpiry();

      expect(count).toBe(0);
      expect(subscriptionRepo.save).not.toHaveBeenCalled();
    });
  });
});
