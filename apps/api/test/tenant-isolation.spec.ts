/**
 * Tenant Isolation Tests
 *
 * Verifies that data from one organization cannot be accessed by another organization.
 * Uses direct service instantiation with mocked repositories.
 */
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardsService } from '../src/modules/dashboards/dashboards.service';
import { Dashboard } from '../src/modules/dashboards/entities/dashboard.entity';
import { DashboardShare } from '../src/modules/dashboards/entities/dashboard-share.entity';
import { Widget } from '../src/modules/widgets/entities/widget.entity';
import { WidgetsService } from '../src/modules/widgets/widgets.service';
import { ClickHouseService } from '../src/modules/clickhouse/clickhouse.service';

jest.mock('../src/modules/clickhouse/clickhouse.service');

jest.mock('../src/config/redis.config', () => ({
  cacheRedis: { ping: jest.fn().mockResolvedValue('PONG') },
  bullRedis: {},
  CACHE_TTL_DEFAULT: 300,
}));

const ORG_A = '00000000-0000-4000-a000-aaaaaaaaaaaa';
const ORG_B = '00000000-0000-4000-a000-bbbbbbbbbbbb';
const DASHBOARD_A = '00000000-0000-4000-a000-dddddddddddd';
const WIDGET_A = '00000000-0000-4000-a000-wwwwwwwwwwww';

describe('Tenant Isolation Tests', () => {
  // ===========================================================================
  // DashboardsService — org_id filtering
  // ===========================================================================
  describe('DashboardsService — cross-org access denied', () => {
    let service: DashboardsService;
    const mockDashboardRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
    };

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DashboardsService,
          { provide: getRepositoryToken(Dashboard), useValue: mockDashboardRepo },
          { provide: getRepositoryToken(DashboardShare), useValue: {} },
          { provide: getRepositoryToken(Widget), useValue: {} },
          { provide: ClickHouseService, useValue: {} },
        ],
      }).compile();

      service = module.get<DashboardsService>(DashboardsService);
      jest.clearAllMocks();
    });

    it('findAll should only return dashboards for the requested org', async () => {
      mockDashboardRepo.find.mockResolvedValue([]);

      await service.findAll(ORG_A);

      expect(mockDashboardRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { org_id: ORG_A },
        }),
      );
    });

    it('findOne with wrong org_id should throw NotFoundException', async () => {
      // Dashboard belongs to ORG_A but queried with ORG_B
      mockDashboardRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(ORG_B, DASHBOARD_A)).rejects.toThrow(NotFoundException);

      // Verify the query included org_id
      expect(mockDashboardRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: DASHBOARD_A, org_id: ORG_B },
        }),
      );
    });

    it('findOne with correct org_id should succeed', async () => {
      const dashboard = { id: DASHBOARD_A, org_id: ORG_A, name: 'OrgA Dashboard' };
      mockDashboardRepo.findOne.mockResolvedValue(dashboard);

      const result = await service.findOne(ORG_A, DASHBOARD_A);
      expect(result.id).toBe(DASHBOARD_A);
    });

    it('update with wrong org_id should throw NotFoundException', async () => {
      mockDashboardRepo.findOne.mockResolvedValue(null);

      await expect(service.update(ORG_B, DASHBOARD_A, { name: 'hacked' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('remove with wrong org_id should throw NotFoundException', async () => {
      mockDashboardRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(ORG_B, DASHBOARD_A)).rejects.toThrow(NotFoundException);
    });
  });

  // ===========================================================================
  // WidgetsService — org_id filtering
  // ===========================================================================
  describe('WidgetsService — cross-org access denied', () => {
    let service: WidgetsService;
    const mockWidgetRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          WidgetsService,
          { provide: getRepositoryToken(Widget), useValue: mockWidgetRepo },
        ],
      }).compile();

      service = module.get<WidgetsService>(WidgetsService);
      jest.clearAllMocks();
    });

    it('findByDashboard should filter by org_id', async () => {
      mockWidgetRepo.find.mockResolvedValue([]);

      await service.findByDashboard(ORG_A, DASHBOARD_A);

      expect(mockWidgetRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { dashboard_id: DASHBOARD_A, org_id: ORG_A },
        }),
      );
    });

    it('findOne with wrong org_id should throw NotFoundException', async () => {
      mockWidgetRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(ORG_B, DASHBOARD_A, WIDGET_A)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockWidgetRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: WIDGET_A, dashboard_id: DASHBOARD_A, org_id: ORG_B },
        }),
      );
    });
  });
});
