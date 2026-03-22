import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SharedDashboardController } from '../src/modules/dashboards/shared-dashboard.controller';
import { DashboardsService } from '../src/modules/dashboards/dashboards.service';

describe('SharedDashboardController', () => {
  let controller: SharedDashboardController;
  let dashboardsService: jest.Mocked<DashboardsService>;

  const mockDashboard = {
    id: 'dash-uuid-1',
    name: 'Sales Overview',
    description: 'Monthly sales metrics',
    layout: [{ x: 0, y: 0, w: 6, h: 4 }],
    is_auto_generated: false,
    source_type: null,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-02'),
    org_id: 'org-uuid-1',
    created_by: 'user-uuid-1',
    deleted_at: null,
    widgets: [],
    shares: [],
    organization: undefined as any,
    creator: undefined as any,
  };

  const mockWidgets = [
    { title: 'Revenue Chart', type: 'bar', data: [{ month: 'Jan', revenue: 10000 }] },
    { title: 'Orders Table', type: 'table', data: [{ id: 1, total: 250 }] },
  ];

  const mockSharedResult = {
    dashboard: mockDashboard,
    widgets: mockWidgets,
  };

  beforeEach(async () => {
    const mockDashboardsService = {
      getSharedDashboard: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SharedDashboardController],
      providers: [{ provide: DashboardsService, useValue: mockDashboardsService }],
    }).compile();

    controller = module.get<SharedDashboardController>(SharedDashboardController);
    dashboardsService = module.get(DashboardsService);
  });

  it('should return { data: dashboard } for a valid share token', async () => {
    dashboardsService.getSharedDashboard.mockResolvedValue(mockSharedResult as any);

    const result = await controller.getSharedDashboard('valid-token-abc');

    expect(result).toEqual({ data: mockSharedResult });
  });

  it('should throw NotFoundException for an invalid share token', async () => {
    dashboardsService.getSharedDashboard.mockRejectedValue(
      new NotFoundException('Dashboard not found'),
    );

    await expect(controller.getSharedDashboard('invalid-token')).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException when the share token is expired', async () => {
    dashboardsService.getSharedDashboard.mockRejectedValue(
      new NotFoundException('Dashboard not found'),
    );

    await expect(controller.getSharedDashboard('expired-token')).rejects.toThrow(NotFoundException);
    await expect(controller.getSharedDashboard('expired-token')).rejects.toThrow(
      'Dashboard not found',
    );
  });

  it('should NOT include sensitive data (owner email, org internal details) in the response', async () => {
    dashboardsService.getSharedDashboard.mockResolvedValue(mockSharedResult as any);

    const result = await controller.getSharedDashboard('valid-token-abc');
    const data = result.data;

    // The returned dashboard should not expose owner email or org internal details
    expect(data.dashboard).not.toHaveProperty('owner_email');
    expect(data.dashboard).not.toHaveProperty('org_secret');
    expect(data.dashboard).not.toHaveProperty('api_key');
    // Widgets should only have title, type, data — no query_sql or config
    for (const widget of data.widgets) {
      expect(widget).toHaveProperty('title');
      expect(widget).toHaveProperty('type');
      expect(widget).toHaveProperty('data');
      expect(widget).not.toHaveProperty('query_sql');
      expect(widget).not.toHaveProperty('config');
      expect(widget).not.toHaveProperty('data_source_id');
    }
  });

  it('should return response with widgets containing data', async () => {
    dashboardsService.getSharedDashboard.mockResolvedValue(mockSharedResult as any);

    const result = await controller.getSharedDashboard('valid-token-abc');

    expect(result.data.widgets).toHaveLength(2);
    expect(result.data.widgets[0].title).toBe('Revenue Chart');
    expect(result.data.widgets[0].type).toBe('bar');
    expect(result.data.widgets[0].data).toEqual([{ month: 'Jan', revenue: 10000 }]);
    expect(result.data.widgets[1].title).toBe('Orders Table');
    expect(result.data.widgets[1].data).toEqual([{ id: 1, total: 250 }]);
  });

  it('should be a public endpoint (has @Public() decorator, no auth required)', () => {
    // Verify @Public() decorator is applied to the getSharedDashboard method
    const publicMetadata = Reflect.getMetadata('isPublic', controller.getSharedDashboard);
    expect(publicMetadata).toBe(true);
  });

  it('should call dashboardsService.getSharedDashboard with the correct token', async () => {
    dashboardsService.getSharedDashboard.mockResolvedValue(mockSharedResult as any);

    await controller.getSharedDashboard('my-share-token-xyz');

    expect(dashboardsService.getSharedDashboard).toHaveBeenCalledTimes(1);
    expect(dashboardsService.getSharedDashboard).toHaveBeenCalledWith('my-share-token-xyz');
  });

  it('should convert any generic service error into NotFoundException', async () => {
    dashboardsService.getSharedDashboard.mockRejectedValue(new Error('Database connection failed'));

    await expect(controller.getSharedDashboard('some-token')).rejects.toThrow(NotFoundException);
    await expect(controller.getSharedDashboard('some-token')).rejects.toThrow(
      'Dashboard not found',
    );
  });
});
