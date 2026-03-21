import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { SubscriptionStatus, BillingPeriod } from './entities/subscription.entity';

describe('BillingController', () => {
  let controller: BillingController;
  let billingService: Record<string, jest.Mock>;

  const orgId = 'org-uuid-1';
  const mockUser = { id: 'user-1', email: 'test@test.com', auth0_id: 'auth0|123' };

  const mockSubscription = {
    id: 'sub-1',
    org_id: orgId,
    plan_id: 'plan-1',
    status: SubscriptionStatus.ACTIVE,
    billing_period: BillingPeriod.MONTHLY,
    current_period_end: new Date('2026-04-21'),
    plan: {
      id: 'plan-1',
      name: 'pro',
      display_name: 'Pro',
      price_monthly_eur: 149,
      price_annual_eur: 1430.4,
    },
  };

  const mockUsage = {
    dataSources: { used: 2, limit: 5 },
    dashboards: { used: 5, limit: 20 },
    teamMembers: { used: 3, limit: 5 },
    aiQueries: { used: 50, limit: 500 },
    alerts: { used: 1, limit: 20 },
  };

  beforeEach(() => {
    billingService = {
      getCurrentSubscription: jest.fn().mockResolvedValue(mockSubscription),
      getUsage: jest.fn().mockResolvedValue(mockUsage),
      getPlans: jest.fn().mockResolvedValue([]),
      createCheckoutSession: jest.fn().mockResolvedValue('https://checkout.stripe.com/test'),
      changePlan: jest.fn().mockResolvedValue(mockSubscription),
      cancelSubscription: jest
        .fn()
        .mockResolvedValue({ ...mockSubscription, status: SubscriptionStatus.CANCELED }),
      getInvoices: jest.fn().mockResolvedValue([]),
      createPortalSession: jest.fn().mockResolvedValue('https://billing.stripe.com/test'),
    };

    controller = new BillingController(billingService as unknown as BillingService);
  });

  describe('getBilling', () => {
    it('should return subscription and usage', async () => {
      const result = await controller.getBilling(orgId);
      expect(result.data.subscription).toEqual(mockSubscription);
      expect(result.data.usage).toEqual(mockUsage);
      expect(result.data.nextBilling).toBeDefined();
    });
  });

  describe('getPlans', () => {
    it('should return available plans', async () => {
      const mockPlans = [{ id: 'p1', name: 'starter' }];
      billingService['getPlans']!.mockResolvedValue(mockPlans);

      const result = await controller.getPlans();
      expect(result.data).toEqual(mockPlans);
    });
  });

  describe('subscribe', () => {
    it('should return a checkout URL', async () => {
      const result = await controller.subscribe(orgId, mockUser, {
        planId: 'plan-1',
        billingPeriod: BillingPeriod.MONTHLY,
      });
      expect(result.data.url).toBe('https://checkout.stripe.com/test');
      expect(billingService['createCheckoutSession']).toHaveBeenCalledWith(
        orgId,
        mockUser.email,
        'plan-1',
        BillingPeriod.MONTHLY,
      );
    });
  });

  describe('changePlan', () => {
    it('should change the plan', async () => {
      const result = await controller.changePlan(orgId, { planId: 'plan-2' });
      expect(billingService['changePlan']).toHaveBeenCalledWith(orgId, 'plan-2');
      expect(result.data).toBeDefined();
    });
  });

  describe('cancel', () => {
    it('should cancel the subscription', async () => {
      const result = await controller.cancel(orgId);
      expect(result.data.status).toBe(SubscriptionStatus.CANCELED);
    });
  });

  describe('getInvoices', () => {
    it('should return invoices', async () => {
      billingService['getInvoices']!.mockResolvedValue([{ id: 'inv_1' }]);
      const result = await controller.getInvoices(orgId);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getPortal', () => {
    it('should return portal URL', async () => {
      const result = await controller.getPortal(orgId);
      expect(result.data.url).toBe('https://billing.stripe.com/test');
    });
  });
});
