import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  async findAll(userId: string, orgId: string, query: QueryNotificationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Record<string, unknown> = { user_id: userId, org_id: orgId };
    if (query.unreadOnly) {
      where.is_read = false;
    }

    const [data, total] = await this.notificationRepo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const unreadCount = await this.notificationRepo.count({
      where: { user_id: userId, org_id: orgId, is_read: false },
    });

    return {
      data,
      meta: { page, limit, total, unreadCount },
    };
  }

  async markRead(userId: string, orgId: string, id: string) {
    const notification = await this.notificationRepo.findOne({
      where: { id, user_id: userId, org_id: orgId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.is_read = true;
    return this.notificationRepo.save(notification);
  }

  async markAllRead(userId: string, orgId: string) {
    await this.notificationRepo.update(
      { user_id: userId, org_id: orgId, is_read: false },
      { is_read: true },
    );
    return { message: 'All notifications marked as read' };
  }

  async remove(userId: string, orgId: string, id: string) {
    const notification = await this.notificationRepo.findOne({
      where: { id, user_id: userId, org_id: orgId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.notificationRepo.remove(notification);
  }

  async getUnreadCount(userId: string, orgId: string) {
    const count = await this.notificationRepo.count({
      where: { user_id: userId, org_id: orgId, is_read: false },
    });

    return { count };
  }
}
