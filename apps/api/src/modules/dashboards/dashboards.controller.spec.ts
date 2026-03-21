import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';

describe('DashboardsController', () => {
  let controller: DashboardsController;
  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockUser = { id: 'user-1', email: 'test@test.com', auth0_id: 'auth0|123' };

  beforeEach(() => {
    controller = new DashboardsController(mockService as unknown as DashboardsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a dashboard', async () => {
      const orgId = '00000000-0000-0000-0000-000000000001';
      const dto = { name: 'Test Dashboard' };
      const dashboard = { id: '00000000-0000-0000-0000-000000000002', ...dto, org_id: orgId };
      mockService.create.mockResolvedValue(dashboard);

      const result = await controller.create(orgId, mockUser, dto);
      expect(result).toEqual({ data: dashboard });
      expect(mockService.create).toHaveBeenCalledWith(orgId, mockUser.id, dto);
    });
  });

  describe('findAll', () => {
    it('should return all dashboards', async () => {
      const orgId = '00000000-0000-0000-0000-000000000001';
      const dashboards = [{ id: '1', name: 'Dashboard 1' }];
      mockService.findAll.mockResolvedValue(dashboards);

      const result = await controller.findAll(orgId);
      expect(result).toEqual({ data: dashboards });
    });
  });

  describe('update', () => {
    it('should update a dashboard', async () => {
      const orgId = '00000000-0000-0000-0000-000000000001';
      const id = '00000000-0000-0000-0000-000000000002';
      const dto = { name: 'Updated' };
      const dashboard = { id, name: 'Updated', org_id: orgId };
      mockService.update.mockResolvedValue(dashboard);

      const result = await controller.update(orgId, id, dto);
      expect(result).toEqual({ data: dashboard });
    });
  });

  describe('remove', () => {
    it('should delete a dashboard', async () => {
      const orgId = '00000000-0000-0000-0000-000000000001';
      const id = '00000000-0000-0000-0000-000000000002';
      mockService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(orgId, id);
      expect(result).toEqual({ data: { message: 'Dashboard deleted' } });
    });
  });
});
