import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OverviewService } from './overview.service';
import { DataSource } from '../data-sources/entities/data-source.entity';
import { Dashboard } from '../dashboards/entities/dashboard.entity';
import { Alert } from '../alerts/entities/alert.entity';
import { AlertTrigger } from '../alerts/entities/alert-trigger.entity';
import { SyncJob } from '../sync/entities/sync-job.entity';
import { ClickHouseService } from '../clickhouse/clickhouse.service';

describe('OverviewService', () => {
  let service: OverviewService;
  let dataSourceRepo: { [k: string]: jest.Mock } & {
    count: jest.Mock;
    find: jest.Mock;
  };
  let dashboardRepo: Record<string, jest.Mock>;
  let alertRepo: { [k: string]: jest.Mock } & { count: jest.Mock };
  let alertTriggerRepo: { [k: string]: jest.Mock } & {
    createQueryBuilder: jest.Mock;
  };
  let syncJobRepo: { [k: string]: jest.Mock } & { find: jest.Mock };
  let mockClickhouse: { query: jest.Mock };

  const orgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    dataSourceRepo = {
      count: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    } as typeof dataSourceRepo;

    dashboardRepo = {
      count: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    alertRepo = {
      count: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    } as typeof alertRepo;

    const mockQb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    alertTriggerRepo = {
      count: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    } as typeof alertTriggerRepo;

    syncJobRepo = {
      count: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    } as typeof syncJobRepo;

    mockClickhouse = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OverviewService,
        { provide: getRepositoryToken(DataSource), useValue: dataSourceRepo },
        { provide: getRepositoryToken(Dashboard), useValue: dashboardRepo },
        { provide: getRepositoryToken(Alert), useValue: alertRepo },
        { provide: getRepositoryToken(AlertTrigger), useValue: alertTriggerRepo },
        { provide: getRepositoryToken(SyncJob), useValue: syncJobRepo },
        { provide: ClickHouseService, useValue: mockClickhouse },
      ],
    }).compile();

    service = module.get<OverviewService>(OverviewService);

    jest.clearAllMocks();
  });

  describe('getOverview', () => {
    it('should return overview data with all fields', async () => {
      dataSourceRepo.count.mockResolvedValue(3);
      alertRepo.count.mockResolvedValue(2);
      syncJobRepo.find.mockResolvedValue([]);

      const mockQb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      alertTriggerRepo.createQueryBuilder.mockReturnValue(mockQb);

      mockClickhouse.query
        .mockResolvedValueOnce([{ revenue: '15000', orders: '120' }])
        .mockResolvedValueOnce([{ revenue: '12000', orders: '100' }])
        .mockResolvedValueOnce([
          { date: '2026-03-17', revenue: '2000' },
          { date: '2026-03-18', revenue: '2500' },
        ])
        .mockResolvedValueOnce([
          { name: 'Product A', sales: '50' },
          { name: 'Product B', sales: '30' },
        ]);

      const result = await service.getOverview(orgId);

      expect(result).toEqual({
        totalRevenue: 15000,
        previousRevenue: 12000,
        totalOrders: 120,
        previousOrders: 100,
        activeDataSources: 3,
        activeAlerts: 2,
        revenueTrend: [
          { date: '2026-03-17', revenue: 2000 },
          { date: '2026-03-18', revenue: 2500 },
        ],
        topProducts: [
          { name: 'Product A', sales: 50 },
          { name: 'Product B', sales: 30 },
        ],
        recentSyncJobs: [],
        recentAlertTriggers: [],
      });
    });

    it('should return zeros for new org when ClickHouse query fails', async () => {
      dataSourceRepo.count.mockResolvedValue(0);
      alertRepo.count.mockResolvedValue(0);
      syncJobRepo.find.mockResolvedValue([]);

      const mockQb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      alertTriggerRepo.createQueryBuilder.mockReturnValue(mockQb);

      mockClickhouse.query.mockRejectedValue(new Error('Table not found'));

      const result = await service.getOverview(orgId);

      expect(result.totalRevenue).toBe(0);
      expect(result.previousRevenue).toBe(0);
      expect(result.totalOrders).toBe(0);
      expect(result.previousOrders).toBe(0);
      expect(result.revenueTrend).toEqual([]);
      expect(result.topProducts).toEqual([]);
      expect(result.activeDataSources).toBe(0);
      expect(result.activeAlerts).toBe(0);
    });

    it('should count active data sources correctly', async () => {
      dataSourceRepo.count.mockResolvedValue(5);
      alertRepo.count.mockResolvedValue(0);
      syncJobRepo.find.mockResolvedValue([]);

      const mockQb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      alertTriggerRepo.createQueryBuilder.mockReturnValue(mockQb);

      mockClickhouse.query.mockRejectedValue(new Error('fail'));

      const result = await service.getOverview(orgId);

      expect(result.activeDataSources).toBe(5);
      expect(dataSourceRepo.count).toHaveBeenCalledWith({
        where: { org_id: orgId, status: 'active' },
      });
    });

    it('should count active alerts correctly', async () => {
      dataSourceRepo.count.mockResolvedValue(0);
      alertRepo.count.mockResolvedValue(7);
      syncJobRepo.find.mockResolvedValue([]);

      const mockQb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      alertTriggerRepo.createQueryBuilder.mockReturnValue(mockQb);

      mockClickhouse.query.mockRejectedValue(new Error('fail'));

      const result = await service.getOverview(orgId);

      expect(result.activeAlerts).toBe(7);
      expect(alertRepo.count).toHaveBeenCalledWith({
        where: { org_id: orgId, is_active: true },
      });
    });

    it('should map recent sync jobs with duration calculation', async () => {
      const startedAt = new Date('2026-03-24T10:00:00Z');
      const completedAt = new Date('2026-03-24T10:05:30Z');

      dataSourceRepo.count.mockResolvedValue(1);
      alertRepo.count.mockResolvedValue(0);
      syncJobRepo.find.mockResolvedValue([
        {
          id: 'job-1',
          status: 'completed',
          started_at: startedAt,
          completed_at: completedAt,
          rows_imported: 500,
          created_at: new Date('2026-03-24T10:00:00Z'),
          data_source: { name: 'SmartBill' },
        },
        {
          id: 'job-2',
          status: 'running',
          started_at: new Date('2026-03-24T10:10:00Z'),
          completed_at: null,
          rows_imported: 100,
          created_at: new Date('2026-03-24T10:10:00Z'),
          data_source: null,
        },
      ]);

      const mockQb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      alertTriggerRepo.createQueryBuilder.mockReturnValue(mockQb);

      mockClickhouse.query.mockRejectedValue(new Error('fail'));

      const result = await service.getOverview(orgId);

      expect(result.recentSyncJobs).toHaveLength(2);
      expect(result.recentSyncJobs[0]).toEqual({
        id: 'job-1',
        status: 'completed',
        source_name: 'SmartBill',
        duration: 330,
        rows_imported: 500,
        created_at: '2026-03-24T10:00:00.000Z',
      });
      expect(result.recentSyncJobs[1]).toEqual({
        id: 'job-2',
        status: 'running',
        source_name: 'Unknown',
        duration: 0,
        rows_imported: 100,
        created_at: '2026-03-24T10:10:00.000Z',
      });
    });

    it('should map recent alert triggers from QueryBuilder', async () => {
      dataSourceRepo.count.mockResolvedValue(0);
      alertRepo.count.mockResolvedValue(1);
      syncJobRepo.find.mockResolvedValue([]);

      const triggeredAt = new Date('2026-03-24T09:30:00Z');
      const mockQb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'trigger-1',
            metric_value: '150.50',
            triggered_at: triggeredAt,
            alert: { name: 'High Revenue Alert' },
          },
          {
            id: 'trigger-2',
            metric_value: '42',
            triggered_at: triggeredAt,
            alert: null,
          },
        ]),
      };
      alertTriggerRepo.createQueryBuilder.mockReturnValue(mockQb);

      mockClickhouse.query.mockRejectedValue(new Error('fail'));

      const result = await service.getOverview(orgId);

      expect(result.recentAlertTriggers).toHaveLength(2);
      expect(result.recentAlertTriggers[0]).toEqual({
        id: 'trigger-1',
        alert_name: 'High Revenue Alert',
        value: 150.5,
        created_at: '2026-03-24T09:30:00.000Z',
      });
      expect(result.recentAlertTriggers[1]).toEqual({
        id: 'trigger-2',
        alert_name: 'Unknown',
        value: 42,
        created_at: '2026-03-24T09:30:00.000Z',
      });

      expect(mockQb.innerJoinAndSelect).toHaveBeenCalledWith('trigger.alert', 'alert');
      expect(mockQb.where).toHaveBeenCalledWith('alert.org_id = :orgId', { orgId });
      expect(mockQb.orderBy).toHaveBeenCalledWith('trigger.triggered_at', 'DESC');
      expect(mockQb.take).toHaveBeenCalledWith(5);
    });
  });
});
