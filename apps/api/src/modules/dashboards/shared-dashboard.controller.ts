import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { DashboardsService } from './dashboards.service';

@Controller('shared/dashboards')
export class SharedDashboardController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Get(':shareToken')
  async getSharedDashboard(@Param('shareToken') shareToken: string) {
    try {
      const result = await this.dashboardsService.getSharedDashboard(shareToken);
      return { data: result };
    } catch {
      throw new NotFoundException('Dashboard not found');
    }
  }
}
