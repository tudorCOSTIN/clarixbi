import { Test, TestingModule } from '@nestjs/testing';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('OverviewController', () => {
  let controller: OverviewController;
  let mockOverviewService: { getOverview: jest.Mock };

  const orgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    mockOverviewService = {
      getOverview: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OverviewController],
      providers: [
        { provide: OverviewService, useValue: mockOverviewService },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrgMemberGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OverviewController>(OverviewController);

    jest.clearAllMocks();
  });

  describe('getOverview', () => {
    it('should call getOverview and return { data }', async () => {
      const overviewData = {
        totalRevenue: 10000,
        previousRevenue: 8000,
        totalOrders: 50,
        previousOrders: 40,
        activeDataSources: 2,
        activeAlerts: 3,
        revenueTrend: [{ date: '2026-03-24', revenue: 1000 }],
        topProducts: [{ name: 'Widget', sales: 20 }],
        recentSyncJobs: [],
        recentAlertTriggers: [],
      };

      mockOverviewService.getOverview.mockResolvedValue(overviewData);

      const result = await controller.getOverview(orgId);

      expect(mockOverviewService.getOverview).toHaveBeenCalledWith(orgId);
      expect(result).toEqual({ data: overviewData });
    });

    it('should return correct data structure', async () => {
      const overviewData = {
        totalRevenue: 0,
        previousRevenue: 0,
        totalOrders: 0,
        previousOrders: 0,
        activeDataSources: 0,
        activeAlerts: 0,
        revenueTrend: [],
        topProducts: [],
        recentSyncJobs: [],
        recentAlertTriggers: [],
      };

      mockOverviewService.getOverview.mockResolvedValue(overviewData);

      const result = await controller.getOverview(orgId);

      expect(result.data).toBeDefined();
      expect(result.data.totalRevenue).toBe(0);
      expect(result.data.activeDataSources).toBe(0);
      expect(Array.isArray(result.data.revenueTrend)).toBe(true);
      expect(Array.isArray(result.data.topProducts)).toBe(true);
      expect(Array.isArray(result.data.recentSyncJobs)).toBe(true);
      expect(Array.isArray(result.data.recentAlertTriggers)).toBe(true);
    });
  });
});
