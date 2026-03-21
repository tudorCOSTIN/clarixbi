import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  const mockService = {
    findAll: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    remove: jest.fn(),
    getUnreadCount: jest.fn(),
  };

  const mockUser = { id: 'user-1', email: 'test@test.com', auth0_id: 'auth0|123' };

  beforeEach(() => {
    controller = new NotificationsController(mockService as unknown as NotificationsService);
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should return paginated notifications', async () => {
      const mockResult = {
        data: [{ id: 'n-1', title: 'Test' }],
        meta: { page: 1, limit: 20, total: 1, unreadCount: 1 },
      };
      mockService.findAll.mockResolvedValue(mockResult);

      const result = await controller.list('org-1', { page: 1, limit: 20 }, mockUser);

      expect(result).toEqual(mockResult);
      expect(mockService.findAll).toHaveBeenCalledWith('user-1', 'org-1', {
        page: 1,
        limit: 20,
      });
    });
  });

  describe('markRead', () => {
    it('should mark notification as read', async () => {
      const notification = { id: 'n-1', is_read: true };
      mockService.markRead.mockResolvedValue(notification);

      const result = await controller.markRead('org-1', 'n-1', mockUser);

      expect(result).toEqual({ data: notification });
      expect(mockService.markRead).toHaveBeenCalledWith('user-1', 'org-1', 'n-1');
    });
  });

  describe('markAllRead', () => {
    it('should mark all notifications as read', async () => {
      mockService.markAllRead.mockResolvedValue({
        message: 'All notifications marked as read',
      });

      const result = await controller.markAllRead('org-1', mockUser);

      expect(result).toEqual({ message: 'All notifications marked as read' });
    });
  });

  describe('remove', () => {
    it('should delete notification', async () => {
      mockService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('org-1', 'n-1', mockUser);

      expect(result).toEqual({ data: { message: 'Notification deleted' } });
    });
  });

  describe('unreadCount', () => {
    it('should return unread count', async () => {
      mockService.getUnreadCount.mockResolvedValue({ count: 3 });

      const result = await controller.unreadCount('org-1', mockUser);

      expect(result).toEqual({ count: 3 });
    });
  });
});
