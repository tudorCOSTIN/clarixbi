import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { cacheRedis } from '../../config/redis.config';
import { Subscription } from '../billing/entities/subscription.entity';
import { Notification, NotificationType } from '../notifications/entities/notification.entity';
import { TeamMember } from '../teams/entities/team-member.entity';
import { NotificationsGateway } from '../notifications/notifications.gateway';

export interface AiUsageInfo {
  used: number;
  limit: number;
  percentage: number;
  resetsAt: string;
  tier: string;
}

const WARNING_THRESHOLDS = [70, 80, 85] as const;

const RATE_LIMIT_TTL = 35 * 24 * 60 * 60; // 35 days in seconds

@Injectable()
export class AiRateLimitService {
  private readonly logger = new Logger(AiRateLimitService.name);

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    @InjectRepository(TeamMember)
    private teamMemberRepo: Repository<TeamMember>,
    private notificationsGateway: NotificationsGateway,
  ) {}

  private getRedisKey(orgId: string): string {
    const now = new Date();
    const period = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    return `ai_usage:${orgId}:${period}`;
  }

  async getUsage(orgId: string): Promise<AiUsageInfo> {
    const key = this.getRedisKey(orgId);
    const used = parseInt((await cacheRedis.get(key)) || '0', 10);
    const { limit, tier } = await this.getPlanLimit(orgId);

    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const percentage = limit > 0 ? Math.round((used / limit) * 1000) / 10 : 0;

    return {
      used,
      limit,
      percentage,
      resetsAt: nextMonth.toISOString().split('T')[0] as string,
      tier,
    };
  }

  async checkAndIncrement(
    orgId: string,
    userId: string,
  ): Promise<{ allowed: boolean; usage: AiUsageInfo }> {
    const { limit, tier } = await this.getPlanLimit(orgId);
    const key = this.getRedisKey(orgId);

    const currentUsed = parseInt((await cacheRedis.get(key)) || '0', 10);

    // Hard limit for Starter and Pro
    if (currentUsed >= limit && tier !== 'enterprise') {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return {
        allowed: false,
        usage: {
          used: currentUsed,
          limit,
          percentage: 100,
          resetsAt: nextMonth.toISOString().split('T')[0] as string,
          tier,
        },
      };
    }

    // Enterprise soft limit: warn but allow
    if (currentUsed >= limit && tier === 'enterprise') {
      this.logger.warn(`Enterprise org ${orgId} exceeded AI soft limit: ${currentUsed}/${limit}`);
    }

    // Increment counter
    const newCount = await cacheRedis.incr(key);
    if (newCount === 1) {
      await cacheRedis.expire(key, RATE_LIMIT_TTL);
    }

    // Check warning thresholds
    await this.checkWarningThresholds(orgId, userId, newCount, limit, tier);

    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const percentage = limit > 0 ? Math.round((newCount / limit) * 1000) / 10 : 0;

    return {
      allowed: true,
      usage: {
        used: newCount,
        limit,
        percentage,
        resetsAt: nextMonth.toISOString().split('T')[0] as string,
        tier,
      },
    };
  }

  async getRetryConfig(
    orgId: string,
  ): Promise<{ maxRetries: number; notifyOnFinalFailure: boolean }> {
    const { tier } = await this.getPlanLimit(orgId);
    switch (tier) {
      case 'starter':
        return { maxRetries: 0, notifyOnFinalFailure: false };
      case 'pro':
        return { maxRetries: 3, notifyOnFinalFailure: false };
      case 'enterprise':
        return { maxRetries: 5, notifyOnFinalFailure: true };
      default:
        return { maxRetries: 0, notifyOnFinalFailure: false };
    }
  }

  private async getPlanLimit(orgId: string): Promise<{ limit: number; tier: string }> {
    try {
      const subscription = await this.subscriptionRepo.findOne({
        where: { org_id: orgId },
        relations: ['plan'],
      });

      if (subscription?.plan) {
        return {
          limit: subscription.plan.limits.max_ai_queries_monthly,
          tier: subscription.plan.name,
        };
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch plan for org ${orgId}: ${error}`);
    }

    // Default to Starter limits
    return { limit: 100, tier: 'starter' };
  }

  private async checkWarningThresholds(
    orgId: string,
    userId: string,
    currentCount: number,
    limit: number,
    tier: string,
  ): Promise<void> {
    if (limit <= 0) return;

    const percentage = (currentCount / limit) * 100;

    for (const threshold of WARNING_THRESHOLDS) {
      // Check if we just crossed this threshold (previous count was below)
      const prevPercentage = ((currentCount - 1) / limit) * 100;
      if (percentage >= threshold && prevPercentage < threshold) {
        await this.createWarningNotification(orgId, userId, threshold, currentCount, limit, tier);
      }
    }
  }

  private async createWarningNotification(
    orgId: string,
    _userId: string,
    threshold: number,
    used: number,
    limit: number,
    tier: string,
  ): Promise<void> {
    const remaining = 100 - threshold;
    let title: string;
    let message: string;

    if (threshold === 70) {
      title = 'Utilizare AI 70%';
      message = `Ai folosit ${used} din ${limit} interogari AI (planul ${tier}). Mai ai ${limit - used} interogari disponibile.`;
    } else if (threshold === 80) {
      title = 'Utilizare AI 80%';
      message = `Ai folosit 80% din interogari AI. Mai ai doar ${limit - used} interogari ramase luna aceasta.`;
    } else {
      title = `Mai ai doar ${remaining}% interogari AI`;
      message = `Ai folosit ${used} din ${limit} interogari AI. Upgradeaza planul pentru mai multe interogari.`;
    }

    // Notify all org members
    const members = await this.teamMemberRepo.find({ where: { org_id: orgId } });

    for (const member of members) {
      const notification = this.notificationRepo.create({
        user_id: member.user_id,
        org_id: orgId,
        type: NotificationType.PLAN_LIMIT_WARNING,
        title,
        message,
        link_url: '/settings/billing',
        metadata: { threshold, used, limit, tier },
      });
      await this.notificationRepo.save(notification);

      // Send real-time notification
      this.notificationsGateway.emitNotification(member.user_id, {
        id: notification.id,
        type: NotificationType.PLAN_LIMIT_WARNING,
        title,
        message,
      });
    }

    this.logger.log(`AI usage warning: org ${orgId} reached ${threshold}% (${used}/${limit})`);
  }
}
