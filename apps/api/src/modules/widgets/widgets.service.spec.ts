import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { WidgetsService } from './widgets.service';
import { Widget, WidgetType } from './entities/widget.entity';

describe('WidgetsService', () => {
  let service: WidgetsService;
  let repo: jest.Mocked<Repository<Widget>>;

  const orgId = uuid();
  const dashboardId = uuid();
  const widgetId = uuid();
  const dataSourceId = uuid();

  const mockWidget: Widget = {
    id: widgetId,
    dashboard_id: dashboardId,
    org_id: orgId,
    type: WidgetType.LINE,
    title: 'Monthly Revenue',
    config: { smooth: true, showArea: false, colorScheme: 'primary' },
    query_sql: '',
    position: { x: 0, y: 0, w: 4, h: 3 },
    data_source_id: dataSourceId,
    created_at: new Date(),
    updated_at: new Date(),
    dashboard: null as any,
    organization: null as any,
    data_source: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WidgetsService,
        {
          provide: getRepositoryToken(Widget),
          useValue: {
            create: jest.fn((dto) => ({ ...mockWidget, ...dto })),
            save: jest.fn((entity) => {
              if (Array.isArray(entity)) {
                return Promise.resolve(entity);
              }
              return Promise.resolve({ ...mockWidget, ...entity });
            }),
            find: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WidgetsService>(WidgetsService);
    repo = module.get(getRepositoryToken(Widget));
  });

  describe('create', () => {
    it('should create a line widget with default config merged', async () => {
      const dto = { type: WidgetType.LINE, title: 'Revenue', data_source_id: dataSourceId };

      await service.create(orgId, dashboardId, dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          dashboard_id: dashboardId,
          org_id: orgId,
          type: WidgetType.LINE,
          title: 'Revenue',
          config: { smooth: true, showArea: false, colorScheme: 'primary' },
          query_sql: '',
          position: { x: 0, y: 0, w: 4, h: 3 },
          data_source_id: dataSourceId,
        }),
      );
      expect(repo.save).toHaveBeenCalled();
    });

    it('should create a bar widget with default config', async () => {
      const dto = { type: WidgetType.BAR, title: 'Top Clients' };

      await service.create(orgId, dashboardId, dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          config: { horizontal: false, gradient: true, colorScheme: 'primary' },
        }),
      );
    });

    it('should create a pie widget with default config', async () => {
      const dto = { type: WidgetType.PIE, title: 'Status Distribution' };

      await service.create(orgId, dashboardId, dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          config: { donut: false, showLabels: true, colorScheme: 'primary' },
        }),
      );
    });

    it('should create a table widget with default config', async () => {
      const dto = { type: WidgetType.TABLE, title: 'Recent Invoices' };

      await service.create(orgId, dashboardId, dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          config: { pageSize: 10, sortOrder: 'DESC', searchable: true },
        }),
      );
    });

    it('should create a kpi widget with default config', async () => {
      const dto = { type: WidgetType.KPI, title: 'Total Revenue' };

      await service.create(orgId, dashboardId, dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          config: { aggregation: 'SUM', showTrend: true, colorScheme: 'primary' },
        }),
      );
    });

    it('should merge user config over defaults', async () => {
      const dto = {
        type: WidgetType.LINE,
        title: 'Custom',
        config: { smooth: false, customField: 'value' },
      };

      await service.create(orgId, dashboardId, dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          config: { smooth: false, showArea: false, colorScheme: 'primary', customField: 'value' },
        }),
      );
    });

    it('should use default position when not provided', async () => {
      const dto = { type: WidgetType.KPI, title: 'Test' };

      await service.create(orgId, dashboardId, dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          position: { x: 0, y: 0, w: 4, h: 3 },
        }),
      );
    });

    it('should use custom position when provided', async () => {
      const dto = {
        type: WidgetType.KPI,
        title: 'Test',
        position: { x: 4, y: 2, w: 6, h: 4 },
      };

      await service.create(orgId, dashboardId, dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          position: { x: 4, y: 2, w: 6, h: 4 },
        }),
      );
    });

    it('should set data_source_id to null when not provided', async () => {
      const dto = { type: WidgetType.BAR, title: 'No DS' };

      await service.create(orgId, dashboardId, dto);

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ data_source_id: null }));
    });
  });

  describe('findByDashboard', () => {
    it('should return widgets for a dashboard with data_source relation', async () => {
      const widgets = [mockWidget, { ...mockWidget, id: uuid(), title: 'Second' }];
      repo.find.mockResolvedValue(widgets as Widget[]);

      const result = await service.findByDashboard(orgId, dashboardId);

      expect(repo.find).toHaveBeenCalledWith({
        where: { dashboard_id: dashboardId, org_id: orgId },
        relations: ['data_source'],
        order: { created_at: 'ASC' },
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no widgets exist', async () => {
      repo.find.mockResolvedValue([]);

      const result = await service.findByDashboard(orgId, dashboardId);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return the widget when found', async () => {
      repo.findOne.mockResolvedValue(mockWidget);

      const result = await service.findOne(orgId, dashboardId, widgetId);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: widgetId, dashboard_id: dashboardId, org_id: orgId },
        relations: ['data_source'],
      });
      expect(result).toEqual(mockWidget);
    });

    it('should throw NotFoundException when widget is not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne(orgId, dashboardId, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne(orgId, dashboardId, 'nonexistent')).rejects.toThrow(
        'Widget not found',
      );
    });
  });

  describe('update', () => {
    it('should update widget title', async () => {
      repo.findOne.mockResolvedValue({ ...mockWidget });

      await service.update(orgId, dashboardId, widgetId, {
        title: 'Updated Title',
      });

      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'Updated Title' }));
    });

    it('should merge config additively (spread)', async () => {
      repo.findOne.mockResolvedValue({
        ...mockWidget,
        config: { smooth: true, showArea: false, colorScheme: 'primary' },
      });

      await service.update(orgId, dashboardId, widgetId, {
        config: { showArea: true, newProp: 42 },
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          config: { smooth: true, showArea: true, colorScheme: 'primary', newProp: 42 },
        }),
      );
    });

    it('should update position', async () => {
      repo.findOne.mockResolvedValue({ ...mockWidget });

      await service.update(orgId, dashboardId, widgetId, {
        position: { x: 6, y: 3, w: 6, h: 4 },
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ position: { x: 6, y: 3, w: 6, h: 4 } }),
      );
    });

    it('should update type', async () => {
      repo.findOne.mockResolvedValue({ ...mockWidget });

      await service.update(orgId, dashboardId, widgetId, { type: WidgetType.BAR });

      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ type: WidgetType.BAR }));
    });

    it('should throw NotFoundException when widget is not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update(orgId, dashboardId, 'nonexistent', { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should hard remove the widget', async () => {
      repo.findOne.mockResolvedValue(mockWidget);

      await service.remove(orgId, dashboardId, widgetId);

      expect(repo.remove).toHaveBeenCalledWith(mockWidget);
    });

    it('should throw NotFoundException when widget is not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove(orgId, dashboardId, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('bulkUpdatePositions', () => {
    it('should update positions for multiple widgets', async () => {
      const id1 = uuid();
      const id2 = uuid();
      const widget1 = { ...mockWidget, id: id1, position: { x: 0, y: 0, w: 4, h: 3 } };
      const widget2 = { ...mockWidget, id: id2, position: { x: 4, y: 0, w: 4, h: 3 } };

      repo.find.mockResolvedValue([widget1, widget2] as Widget[]);

      const dto = {
        widgets: [
          { id: id1, position: { x: 0, y: 0, w: 6, h: 4 } },
          { id: id2, position: { x: 6, y: 0, w: 6, h: 4 } },
        ],
      };

      await service.bulkUpdatePositions(orgId, dashboardId, dto);

      expect(repo.find).toHaveBeenCalledWith({
        where: {
          id: expect.anything(),
          dashboard_id: dashboardId,
          org_id: orgId,
        },
      });
      expect(repo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: id1, position: { x: 0, y: 0, w: 6, h: 4 } }),
          expect.objectContaining({ id: id2, position: { x: 6, y: 0, w: 6, h: 4 } }),
        ]),
      );
    });

    it('should skip widgets not found in the database', async () => {
      const id1 = uuid();
      const widget1 = { ...mockWidget, id: id1 };

      repo.find.mockResolvedValue([widget1] as Widget[]);

      const dto = {
        widgets: [
          { id: id1, position: { x: 0, y: 0, w: 12, h: 6 } },
          { id: uuid(), position: { x: 0, y: 6, w: 12, h: 6 } }, // not found in DB
        ],
      };

      await service.bulkUpdatePositions(orgId, dashboardId, dto);

      expect(repo.save).toHaveBeenCalledWith([
        expect.objectContaining({ id: id1, position: { x: 0, y: 0, w: 12, h: 6 } }),
      ]);
    });

    it('should handle empty widgets array', async () => {
      repo.find.mockResolvedValue([]);

      await service.bulkUpdatePositions(orgId, dashboardId, { widgets: [] });

      expect(repo.save).toHaveBeenCalledWith([]);
    });
  });
});
