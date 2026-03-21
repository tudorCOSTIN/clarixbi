import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { TeamMember } from '../teams/entities/team-member.entity';
import { DataSourceEntity } from '../data-sources/entities/data-source.entity';
import { Dashboard } from '../dashboards/entities/dashboard.entity';
import { Subscription } from '../billing/entities/subscription.entity';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepo: Repository<TeamMember>,
    @InjectRepository(DataSourceEntity)
    private readonly dataSourceRepo: Repository<DataSourceEntity>,
    @InjectRepository(Dashboard)
    private readonly dashboardRepo: Repository<Dashboard>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  async findAllAuditLogs(orgId: string, query: QueryAuditLogsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const qb = this.auditLogRepo
      .createQueryBuilder('log')
      .where('log.org_id = :orgId', { orgId })
      .orderBy('log.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.action) {
      qb.andWhere('log.action = :action', { action: query.action });
    }

    if (query.userId) {
      qb.andWhere('log.user_id = :userId', { userId: query.userId });
    }

    if (query.dateFrom) {
      qb.andWhere('log.created_at >= :dateFrom', { dateFrom: query.dateFrom });
    }

    if (query.dateTo) {
      qb.andWhere('log.created_at <= :dateTo', { dateTo: query.dateTo });
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { page, limit, total },
    };
  }

  async findOneAuditLog(orgId: string, id: string) {
    return this.auditLogRepo.findOneOrFail({
      where: { id, org_id: orgId },
    });
  }

  async getOrgStats(orgId: string) {
    const [totalUsers, totalDataSources, totalDashboards, subscription] = await Promise.all([
      this.teamMemberRepo.count({ where: { org_id: orgId } }),
      this.dataSourceRepo.count({ where: { org_id: orgId } }),
      this.dashboardRepo.count({ where: { org_id: orgId } }),
      this.subscriptionRepo.findOne({
        where: { org_id: orgId },
        relations: ['plan'],
      }),
    ]);

    let subscriptionInfo = null;
    if (subscription) {
      const now = new Date();
      const trialDaysLeft =
        subscription.trial_ends_at && subscription.trial_ends_at > now
          ? Math.ceil(
              (subscription.trial_ends_at.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            )
          : 0;

      subscriptionInfo = {
        plan_name: subscription.plan?.display_name ?? subscription.plan?.name ?? null,
        status: subscription.status,
        billing_period: subscription.billing_period,
        trial_days_left: trialDaysLeft,
        current_period_end: subscription.current_period_end,
      };
    }

    return {
      total_users: totalUsers,
      total_data_sources: totalDataSources,
      total_dashboards: totalDashboards,
      subscription: subscriptionInfo,
    };
  }
}
