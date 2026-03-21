import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanLimitGuard } from './plan-limit.guard';
import { BillingService } from '../billing.service';

describe('PlanLimitGuard', () => {
  let guard: PlanLimitGuard;
  let billingService: { checkPlanLimit: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    billingService = { checkPlanLimit: jest.fn() };
    reflector = { getAllAndOverride: jest.fn() };
    guard = new PlanLimitGuard(
      reflector as unknown as Reflector,
      billingService as unknown as BillingService,
    );
  });

  const createMockContext = (orgId: string): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          orgId,
          params: { orgId },
        }),
      }),
    }) as unknown as ExecutionContext;

  it('should allow when no resource annotation', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const result = await guard.canActivate(createMockContext('org-1'));
    expect(result).toBe(true);
  });

  it('should allow when under limit', async () => {
    reflector.getAllAndOverride.mockReturnValue('dashboards');
    billingService.checkPlanLimit.mockResolvedValue(null);
    const result = await guard.canActivate(createMockContext('org-1'));
    expect(result).toBe(true);
  });

  it('should throw 402 when plan limit exceeded', async () => {
    reflector.getAllAndOverride.mockReturnValue('dashboards');
    billingService.checkPlanLimit.mockResolvedValue({
      used: 3,
      limit: 3,
      upgradePlan: 'pro',
    });

    await expect(guard.canActivate(createMockContext('org-1'))).rejects.toThrow(HttpException);
    try {
      await guard.canActivate(createMockContext('org-1'));
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(402);
      const response = (e as HttpException).getResponse() as Record<string, unknown>;
      expect(response['error']).toBe('PLAN_LIMIT');
      expect(response['resource']).toBe('dashboards');
    }
  });
});
