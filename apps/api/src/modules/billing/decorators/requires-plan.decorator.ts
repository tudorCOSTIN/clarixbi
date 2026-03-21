import { SetMetadata } from '@nestjs/common';

export const PLAN_RESOURCE_KEY = 'plan_resource';

/**
 * Decorator to enforce plan limits on resource creation endpoints.
 * Usage: @CheckPlanLimit('data_sources') on POST endpoints.
 */
export const CheckPlanLimit = (
  resource: 'data_sources' | 'dashboards' | 'team_members' | 'ai_queries' | 'alerts',
) => SetMetadata(PLAN_RESOURCE_KEY, resource);
