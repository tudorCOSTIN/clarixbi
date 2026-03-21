import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

describe('AdminController', () => {
  let controller: AdminController;
  const mockAdminService = {
    findAllAuditLogs: jest.fn(),
    findOneAuditLog: jest.fn(),
    getOrgStats: jest.fn(),
  };

  beforeEach(() => {
    controller = new AdminController(mockAdminService as unknown as AdminService);
    jest.clearAllMocks();
  });

  describe('listAuditLogs', () => {
    it('should return paginated audit logs', async () => {
      const mockResult = {
        data: [{ id: 'log-1', action: 'login' }],
        meta: { page: 1, limit: 50, total: 1 },
      };
      mockAdminService.findAllAuditLogs.mockResolvedValue(mockResult);

      const result = await controller.listAuditLogs('org-1', { page: 1, limit: 50 });

      expect(result).toEqual(mockResult);
      expect(mockAdminService.findAllAuditLogs).toHaveBeenCalledWith('org-1', {
        page: 1,
        limit: 50,
      });
    });

    it('should pass filter params to service', async () => {
      const query = { page: 1, limit: 20, action: 'login', userId: 'user-1' };
      mockAdminService.findAllAuditLogs.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0 },
      });

      await controller.listAuditLogs('org-1', query);

      expect(mockAdminService.findAllAuditLogs).toHaveBeenCalledWith('org-1', query);
    });
  });

  describe('getAuditLog', () => {
    it('should return a single audit log', async () => {
      const mockLog = { id: 'log-1', action: 'login', org_id: 'org-1' };
      mockAdminService.findOneAuditLog.mockResolvedValue(mockLog);

      const result = await controller.getAuditLog('org-1', 'log-1');

      expect(result).toEqual({ data: mockLog });
      expect(mockAdminService.findOneAuditLog).toHaveBeenCalledWith('org-1', 'log-1');
    });
  });

  describe('getOrgStats', () => {
    it('should return organization statistics', async () => {
      const mockStats = {
        total_users: 5,
        total_data_sources: 3,
        total_dashboards: 10,
        subscription: { plan_name: 'Pro', status: 'active', trial_days_left: 0 },
      };
      mockAdminService.getOrgStats.mockResolvedValue(mockStats);

      const result = await controller.getOrgStats('org-1');

      expect(result).toEqual({ data: mockStats });
      expect(mockAdminService.getOrgStats).toHaveBeenCalledWith('org-1');
    });
  });
});
