import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';

describe('NotificationsService', () => {
  let service: NotificationsService;
  const mockRepo = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated notifications with unread count', async () => {
      const notifications = [
        { id: 'n-1', title: 'Test', is_read: false },
        { id: 'n-2', title: 'Test 2', is_read: true },
      ];
      mockRepo.findAndCount.mockResolvedValue([notifications, 2]);
      mockRepo.count.mockResolvedValue(1);

      const result = await service.findAll('user-1', 'org-1', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.unreadCount).toBe(1);
      expect(mockRepo.findAndCount).toHaveBeenCalledWith({
        where: { user_id: 'user-1', org_id: 'org-1' },
        order: { created_at: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    it('should filter unread only when requested', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);
      mockRepo.count.mockResolvedValue(0);

      await service.findAll('user-1', 'org-1', { unreadOnly: true });

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 'user-1', org_id: 'org-1', is_read: false },
        }),
      );
    });
  });

  describe('markRead', () => {
    it('should mark a notification as read', async () => {
      const notification = { id: 'n-1', user_id: 'user-1', org_id: 'org-1', is_read: false };
      mockRepo.findOne.mockResolvedValue(notification);
      mockRepo.save.mockResolvedValue({ ...notification, is_read: true });

      const result = await service.markRead('user-1', 'org-1', 'n-1');

      expect(result.is_read).toBe(true);
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent notification', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.markRead('user-1', 'org-1', 'n-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllRead', () => {
    it('should update all unread notifications', async () => {
      mockRepo.update.mockResolvedValue({ affected: 5 });

      const result = await service.markAllRead('user-1', 'org-1');

      expect(result.message).toBe('All notifications marked as read');
      expect(mockRepo.update).toHaveBeenCalledWith(
        { user_id: 'user-1', org_id: 'org-1', is_read: false },
        { is_read: true },
      );
    });
  });

  describe('remove', () => {
    it('should delete a notification', async () => {
      const notification = { id: 'n-1', user_id: 'user-1', org_id: 'org-1' };
      mockRepo.findOne.mockResolvedValue(notification);
      mockRepo.remove.mockResolvedValue(notification);

      await service.remove('user-1', 'org-1', 'n-1');

      expect(mockRepo.remove).toHaveBeenCalledWith(notification);
    });

    it('should throw NotFoundException for non-existent notification', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('user-1', 'org-1', 'n-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      mockRepo.count.mockResolvedValue(7);

      const result = await service.getUnreadCount('user-1', 'org-1');

      expect(result).toEqual({ count: 7 });
      expect(mockRepo.count).toHaveBeenCalledWith({
        where: { user_id: 'user-1', org_id: 'org-1', is_read: false },
      });
    });
  });
});
