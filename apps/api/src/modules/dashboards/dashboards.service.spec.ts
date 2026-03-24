/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { DashboardsService } from './dashboards.service';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardShare } from './entities/dashboard-share.entity';
import { Widget } from '../widgets/entities/widget.entity';
import { ClickHouseService } from '../clickhouse/clickhouse.service';

describe('DashboardsService', () => {
  let service: DashboardsService;
  let repo: jest.Mocked<Repository<Dashboard>>;
  let shareRepo: jest.Mocked<Repository<DashboardShare>>;
  let widgetRepo: jest.Mocked<Repository<Widget>>;
  let clickhouseMock: { query: jest.Mock };

  const orgId = uuid();
  const userId = uuid();
  const dashboardId = uuid();

  const mockDashboard: Dashboard = {
    id: dashboardId,
    org_id: orgId,
    created_by: userId,
    name: 'Sales Dashboard',
    description: 'Monthly sales overview',
    layout: [],
    is_auto_generated: false,
    source_type: null,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    organization: null as any,
    creator: null as any,
    widgets: [],
    shares: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardsService,
        {
          provide: getRepositoryToken(Dashboard),
          useValue: {
            create: jest.fn((dto) => ({ ...mockDashboard, ...dto })),
            save: jest.fn((entity) => Promise.resolve({ ...mockDashboard, ...entity })),
            find: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            softRemove: jest.fn(),
            recover: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(DashboardShare),
          useValue: {
            create: jest.fn((dto) => ({
              id: 'share-1',
              view_count: 0,
              created_at: new Date(),
              ...dto,
            })),
            save: jest.fn((entity) => Promise.resolve({ id: 'share-1', ...entity })),
            find: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Widget),
          useValue: {
            create: jest.fn((dto) => ({ id: 'widget-new', ...dto })),
            save: jest.fn((entity) => Promise.resolve({ id: 'widget-new', ...entity })),
          },
        },
        {
          provide: ClickHouseService,
          useValue: {
            query: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<DashboardsService>(DashboardsService);
    repo = module.get(getRepositoryToken(Dashboard));
    shareRepo = module.get(getRepositoryToken(DashboardShare));
    widgetRepo = module.get(getRepositoryToken(Widget));
    clickhouseMock = module.get(ClickHouseService);
  });

  describe('create', () => {
    it('should create a dashboard with orgId, userId, and dto', async () => {
      const dto = { name: 'New Dashboard', description: 'Description here' };

      const result = await service.create(orgId, userId, dto);

      expect(repo.create).toHaveBeenCalledWith({
        org_id: orgId,
        created_by: userId,
        name: dto.name,
        description: dto.description,
        layout: [],
        is_auto_generated: false,
      });
      expect(repo.save).toHaveBeenCalled();
      expect(result.name).toBe(dto.name);
      expect(result.org_id).toBe(orgId);
    });

    it('should set description to null when not provided', async () => {
      const dto = { name: 'No Desc' };

      await service.create(orgId, userId, dto);

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ description: null }));
    });
  });

  describe('findAll', () => {
    it('should return paginated dashboards with widgets relation ordered by created_at DESC', async () => {
      const dashboards = [mockDashboard, { ...mockDashboard, id: uuid(), name: 'Second' }];
      repo.findAndCount.mockResolvedValue([dashboards, 2]);

      const result = await service.findAll(orgId);

      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: { org_id: orgId },
        order: { created_at: 'DESC' },
        relations: ['widgets'],
        take: 20,
        skip: 0,
      });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should return empty items when no dashboards exist', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll(orgId);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return a dashboard with widgets and data_source relations', async () => {
      repo.findOne.mockResolvedValue(mockDashboard);

      const result = await service.findOne(orgId, dashboardId);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: dashboardId, org_id: orgId },
        relations: ['widgets', 'widgets.data_source'],
      });
      expect(result).toEqual(mockDashboard);
    });

    it('should throw NotFoundException when dashboard is not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne(orgId, 'nonexistent-id')).rejects.toThrow(NotFoundException);
      await expect(service.findOne(orgId, 'nonexistent-id')).rejects.toThrow('Dashboard not found');
    });
  });

  describe('update', () => {
    it('should update name only', async () => {
      repo.findOne.mockResolvedValue({ ...mockDashboard });

      const result = await service.update(orgId, dashboardId, { name: 'Updated Name' });

      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated Name' }));
      expect(result.name).toBe('Updated Name');
    });

    it('should update description only', async () => {
      repo.findOne.mockResolvedValue({ ...mockDashboard });

      await service.update(orgId, dashboardId, { description: 'New description' });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'New description' }),
      );
    });

    it('should update layout only', async () => {
      repo.findOne.mockResolvedValue({ ...mockDashboard });
      const newLayout = [{ i: 'w1', x: 0, y: 0, w: 6, h: 4 }];

      await service.update(orgId, dashboardId, { layout: newLayout as any });

      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ layout: newLayout }));
    });

    it('should update multiple fields at once', async () => {
      repo.findOne.mockResolvedValue({ ...mockDashboard });

      await service.update(orgId, dashboardId, {
        name: 'Multi Update',
        description: 'Multi desc',
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Multi Update',
          description: 'Multi desc',
        }),
      );
    });

    it('should throw NotFoundException when dashboard is not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update(orgId, 'nonexistent-id', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should soft remove the dashboard', async () => {
      repo.findOne.mockResolvedValue(mockDashboard);

      await service.remove(orgId, dashboardId);

      expect(repo.softRemove).toHaveBeenCalledWith(mockDashboard);
    });

    it('should throw NotFoundException when dashboard is not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove(orgId, 'nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createShare', () => {
    it('should create a share link and return token and url', async () => {
      repo.findOne.mockResolvedValue(mockDashboard);

      const result = await service.createShare(orgId, dashboardId, userId);

      expect(shareRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          dashboard_id: dashboardId,
          created_by: userId,
        }),
      );
      expect(shareRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('url');
      expect(result.url).toContain('/d/');
    });

    it('should throw NotFoundException when dashboard does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.createShare(orgId, 'nonexistent', userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getShares', () => {
    it('should return all shares for a dashboard', async () => {
      repo.findOne.mockResolvedValue(mockDashboard);
      const mockShares = [
        {
          id: 'share-1',
          dashboard_id: dashboardId,
          share_token: 'tok-1',
          view_count: 5,
          created_at: new Date(),
        },
        {
          id: 'share-2',
          dashboard_id: dashboardId,
          share_token: 'tok-2',
          view_count: 0,
          created_at: new Date(),
        },
      ];
      shareRepo.find.mockResolvedValue(mockShares as any);

      const result = await service.getShares(orgId, dashboardId);

      expect(result).toHaveLength(2);
      expect(shareRepo.find).toHaveBeenCalledWith({
        where: { dashboard_id: dashboardId },
        order: { created_at: 'DESC' },
      });
    });
  });

  describe('revokeShare', () => {
    it('should remove a specific share', async () => {
      repo.findOne.mockResolvedValue(mockDashboard);
      const mockShare = { id: 'share-1', dashboard_id: dashboardId, share_token: 'tok-1' };
      shareRepo.findOne.mockResolvedValue(mockShare as any);

      await service.revokeShare(orgId, dashboardId, 'share-1');

      expect(shareRepo.remove).toHaveBeenCalledWith(mockShare);
    });

    it('should throw NotFoundException when share does not exist', async () => {
      repo.findOne.mockResolvedValue(mockDashboard);
      shareRepo.findOne.mockResolvedValue(null);

      await expect(service.revokeShare(orgId, dashboardId, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('revokeAllShares', () => {
    it('should remove all shares for a dashboard', async () => {
      repo.findOne.mockResolvedValue(mockDashboard);
      const mockShares = [
        { id: 'share-1', dashboard_id: dashboardId },
        { id: 'share-2', dashboard_id: dashboardId },
      ];
      shareRepo.find.mockResolvedValue(mockShares as any);

      await service.revokeAllShares(orgId, dashboardId);

      expect(shareRepo.remove).toHaveBeenCalledWith(mockShares);
    });
  });

  describe('getSharedDashboard', () => {
    it('should return dashboard with widget data and increment view count', async () => {
      const mockShare = {
        id: 'share-1',
        share_token: 'valid-token',
        view_count: 3,
        dashboard: {
          ...mockDashboard,
          widgets: [
            { id: 'w1', title: 'Widget 1', type: 'bar', query_sql: 'SELECT 1', config: {} },
          ],
        },
      };
      shareRepo.findOne.mockResolvedValue(mockShare as any);
      clickhouseMock.query.mockResolvedValue([{ value: 100 }]);

      const result = await service.getSharedDashboard('valid-token');

      expect(result.dashboard).toBeDefined();
      expect(result.widgets).toHaveLength(1);
      expect(mockShare.view_count).toBe(4);
      expect(shareRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException for invalid token', async () => {
      shareRepo.findOne.mockResolvedValue(null);

      await expect(service.getSharedDashboard('invalid-token')).rejects.toThrow(NotFoundException);
    });
  });

  describe('duplicate', () => {
    it('should clone dashboard with all widgets and name with (copie)', async () => {
      const dashWithWidgets = {
        ...mockDashboard,
        widgets: [
          {
            id: 'w1',
            type: 'bar',
            title: 'Revenue',
            config: {},
            query_sql: 'SELECT 1',
            position: { x: 0, y: 0 },
            data_source_id: null,
          },
          {
            id: 'w2',
            type: 'kpi',
            title: 'Total',
            config: {},
            query_sql: 'SELECT 2',
            position: { x: 4, y: 0 },
            data_source_id: 'ds-1',
          },
        ] as any,
      };
      // First call: findOne for original, subsequent calls: findOne for new dashboard
      repo.findOne.mockResolvedValueOnce(dashWithWidgets as any).mockResolvedValueOnce({
        ...dashWithWidgets,
        id: 'new-dashboard-id',
        name: 'Sales Dashboard (copie)',
      } as any);

      const result = await service.duplicate(orgId, dashboardId, userId);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Sales Dashboard (copie)',
          org_id: orgId,
          created_by: userId,
        }),
      );
      expect(widgetRepo.create).toHaveBeenCalledTimes(2);
      expect(widgetRepo.save).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
    });

    it('should not copy shares when duplicating', async () => {
      repo.findOne.mockResolvedValue({ ...mockDashboard, widgets: [] });

      await service.duplicate(orgId, dashboardId, userId);

      expect(shareRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('restore', () => {
    it('should recover a soft-deleted dashboard', async () => {
      const deletedDashboard = { ...mockDashboard, deleted_at: new Date() };
      repo.findOne
        .mockResolvedValueOnce(deletedDashboard) // withDeleted find
        .mockResolvedValueOnce(mockDashboard); // findOne after recovery
      repo.recover = jest.fn().mockResolvedValue(mockDashboard);

      const result = await service.restore(orgId, dashboardId);

      expect(repo.recover).toHaveBeenCalledWith(deletedDashboard);
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when dashboard was not deleted', async () => {
      repo.findOne.mockResolvedValue({ ...mockDashboard, deleted_at: null });

      await expect(service.restore(orgId, dashboardId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when dashboard does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.restore(orgId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('exportPdf', () => {
    it('should generate a PDF buffer', async () => {
      repo.findOne.mockResolvedValue({
        ...mockDashboard,
        widgets: [
          { id: 'w1', title: 'Chart', type: 'bar', query_sql: 'SELECT 1', config: {} },
        ] as any,
      });
      clickhouseMock.query.mockResolvedValue([{ value: 42 }]);

      const result = await service.exportPdf(orgId, dashboardId);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
      // PDF starts with %PDF
      expect(result.toString('ascii', 0, 5)).toContain('%PDF');
    });

    it('should handle widgets with no data', async () => {
      repo.findOne.mockResolvedValue({
        ...mockDashboard,
        widgets: [
          { id: 'w1', title: 'Empty', type: 'bar', query_sql: 'SELECT 1', config: {} },
        ] as any,
      });
      clickhouseMock.query.mockRejectedValue(new Error('ClickHouse down'));

      const result = await service.exportPdf(orgId, dashboardId);

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should throw NotFoundException when dashboard does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.exportPdf(orgId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
