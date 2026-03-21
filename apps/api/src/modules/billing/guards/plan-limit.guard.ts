import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BillingService } from '../billing.service';
import { PLAN_RESOURCE_KEY } from '../decorators/requires-plan.decorator';

@Injectable()
export class PlanLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private billingService: BillingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.getAllAndOverride<string>(PLAN_RESOURCE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!resource) return true;

    const request = context.switchToHttp().getRequest();
    const orgId = request.orgId || request.params?.orgId;

    if (!orgId) return true;

    const limitInfo = await this.billingService.checkPlanLimit(
      orgId,
      resource as 'data_sources' | 'dashboards' | 'team_members' | 'ai_queries' | 'alerts',
    );

    if (limitInfo) {
      throw new HttpException(
        {
          error: 'PLAN_LIMIT',
          message: `You have reached the ${resource.replace('_', ' ')} limit for your plan. Upgrade to unlock more.`,
          resource,
          used: limitInfo.used,
          limit: limitInfo.limit,
          upgradePlan: limitInfo.upgradePlan,
        },
        402,
      );
    }

    return true;
  }
}
