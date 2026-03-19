import { Test, TestingModule } from '@nestjs/testing';
import { WidgetsController } from './widgets.controller';
import { WidgetsService } from './widgets.service';
import { WidgetType } from './entities/widget.entity';

describe('WidgetsController', () => {
  let controller: WidgetsController;
  const mockService = {
    create: jest.fn(),
    findByDashboard: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    bulkUpdatePositions: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WidgetsController],
      providers: [{ provide: WidgetsService, useValue: mockService }],
    }).compile();

    controller = module.get<WidgetsController>(WidgetsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a widget', async () => {
      const orgId = '00000000-0000-0000-0000-000000000001';
      const dashboardId = '00000000-0000-0000-0000-000000000002';
      const dto = { type: WidgetType.LINE, title: 'Revenue Trend' };
      const widget = { id: '00000000-0000-0000-0000-000000000003', ...dto };
      mockService.create.mockResolvedValue(widget);

      const result = await controller.create(orgId, dashboardId, dto);
      expect(result).toEqual({ data: widget });
    });
  });

  describe('findAll', () => {
    it('should return widgets for a dashboard', async () => {
      const orgId = '00000000-0000-0000-0000-000000000001';
      const dashboardId = '00000000-0000-0000-0000-000000000002';
      const widgets = [{ id: '1', title: 'Widget 1' }];
      mockService.findByDashboard.mockResolvedValue(widgets);

      const result = await controller.findAll(orgId, dashboardId);
      expect(result).toEqual({ data: widgets });
    });
  });

  describe('bulkUpdatePositions', () => {
    it('should update widget positions in bulk', async () => {
      const orgId = '00000000-0000-0000-0000-000000000001';
      const dashboardId = '00000000-0000-0000-0000-000000000002';
      const dto = {
        widgets: [
          { id: '00000000-0000-0000-0000-000000000003', position: { x: 0, y: 0, w: 6, h: 4 } },
          { id: '00000000-0000-0000-0000-000000000004', position: { x: 6, y: 0, w: 6, h: 4 } },
        ],
      };
      mockService.bulkUpdatePositions.mockResolvedValue(undefined);

      const result = await controller.bulkUpdatePositions(orgId, dashboardId, dto);
      expect(result).toEqual({ data: { message: 'Positions updated' } });
    });
  });

  describe('remove', () => {
    it('should delete a widget', async () => {
      const orgId = '00000000-0000-0000-0000-000000000001';
      const dashboardId = '00000000-0000-0000-0000-000000000002';
      const id = '00000000-0000-0000-0000-000000000003';
      mockService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(orgId, dashboardId, id);
      expect(result).toEqual({ data: { message: 'Widget deleted' } });
    });
  });
});
