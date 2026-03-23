import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

import { User } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { TeamMember, TeamRole } from '../teams/entities/team-member.entity';
import { GdprRequest, GdprRequestType, GdprRequestStatus } from './entities/gdpr-request.entity';
import { AuditLog } from '../admin/entities/audit-log.entity';
import { Subscription, SubscriptionStatus } from '../billing/entities/subscription.entity';
import { DataSourceEntity } from '../data-sources/entities/data-source.entity';
import { Dashboard } from '../dashboards/entities/dashboard.entity';
import { DashboardShare } from '../dashboards/entities/dashboard-share.entity';
import { Widget } from '../widgets/entities/widget.entity';
import { AIConversation } from '../ai/entities/ai-conversation.entity';
import { AIMessage } from '../ai/entities/ai-message.entity';
import { Report } from '../reports/entities/report.entity';
import { ReportSchedule } from '../reports/entities/report-schedule.entity';
import { Alert } from '../alerts/entities/alert.entity';
import { AlertTrigger } from '../alerts/entities/alert-trigger.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { SyncJob } from '../sync/entities/sync-job.entity';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { gdprHardDeleteQueue, gdprExportQueue } from '../sync/queues.config';

const DELETION_DELAY_DAYS = 30;
const EXPORT_EXPIRY_DAYS = 7;

// ClickHouse tables that store org-scoped data
const CLICKHOUSE_TABLES = [
  'invoices',
  'customers',
  'orders',
  'order_items',
  'products',
  'payments',
  'csv_data',
];

@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepo: Repository<TeamMember>,
    @InjectRepository(GdprRequest)
    private readonly gdprRequestRepo: Repository<GdprRequest>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(DataSourceEntity)
    private readonly dataSourceRepo: Repository<DataSourceEntity>,
    @InjectRepository(Dashboard)
    private readonly dashboardRepo: Repository<Dashboard>,
    @InjectRepository(DashboardShare)
    private readonly dashboardShareRepo: Repository<DashboardShare>,
    @InjectRepository(Widget)
    private readonly widgetRepo: Repository<Widget>,
    @InjectRepository(AIConversation)
    private readonly aiConversationRepo: Repository<AIConversation>,
    @InjectRepository(AIMessage)
    private readonly aiMessageRepo: Repository<AIMessage>,
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    @InjectRepository(ReportSchedule)
    private readonly reportScheduleRepo: Repository<ReportSchedule>,
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,
    @InjectRepository(AlertTrigger)
    private readonly alertTriggerRepo: Repository<AlertTrigger>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(SyncJob)
    private readonly syncJobRepo: Repository<SyncJob>,
    private readonly clickhouse: ClickHouseService,
    private readonly dataSource: DataSource,
  ) {}

  async requestDeletion(userId: string): Promise<GdprRequest> {
    // Check for existing pending deletion request
    const existing = await this.gdprRequestRepo.findOne({
      where: {
        user_id: userId,
        type: GdprRequestType.DELETION,
        status: GdprRequestStatus.PENDING,
      },
    });
    if (existing) {
      throw new BadRequestException('A deletion request is already pending');
    }

    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + DELETION_DELAY_DAYS);

    const request = this.gdprRequestRepo.create({
      user_id: userId,
      type: GdprRequestType.DELETION,
      status: GdprRequestStatus.PENDING,
      scheduled_at: scheduledAt,
    });
    const saved = await this.gdprRequestRepo.save(request);

    // Soft-delete user and deactivate
    await this.userRepo.update(userId, {
      is_active: false,
      deleted_at: new Date(),
    });

    // Deactivate subscriptions for orgs where user is owner
    const ownedMemberships = await this.teamMemberRepo.find({
      where: { user_id: userId, role: TeamRole.OWNER },
    });
    for (const membership of ownedMemberships) {
      await this.subscriptionRepo.update(
        { org_id: membership.org_id },
        { status: SubscriptionStatus.CANCELED, canceled_at: new Date() },
      );
    }

    // Audit log
    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        user_id: userId,
        action: 'gdpr_delete_request',
        entity_type: 'gdpr_request',
        entity_id: saved.id,
        details: { scheduled_at: scheduledAt.toISOString() },
      }),
    );

    // Queue delayed hard-delete job
    const delayMs = DELETION_DELAY_DAYS * 24 * 60 * 60 * 1000;
    await gdprHardDeleteQueue.add(
      'hard-delete',
      { userId, requestId: saved.id },
      { delay: delayMs, jobId: `gdpr-delete-${saved.id}` },
    );

    this.logger.log(
      `GDPR deletion requested for user ${userId}, scheduled at ${scheduledAt.toISOString()}`,
    );
    return saved;
  }

  async executeHardDelete(userId: string, requestId: string): Promise<void> {
    this.logger.log(`Executing hard delete for user ${userId}, request ${requestId}`);

    // Find orgs where user is the sole OWNER
    const ownedMemberships = await this.teamMemberRepo.find({
      where: { user_id: userId, role: TeamRole.OWNER },
    });

    const soleOwnerOrgIds: string[] = [];
    for (const membership of ownedMemberships) {
      const ownerCount = await this.teamMemberRepo.count({
        where: { org_id: membership.org_id, role: TeamRole.OWNER },
      });
      if (ownerCount <= 1) {
        soleOwnerOrgIds.push(membership.org_id);
      }
    }

    // Delete ClickHouse data for sole-owner orgs (outside transaction - separate DB)
    for (const orgId of soleOwnerOrgIds) {
      for (const table of CLICKHOUSE_TABLES) {
        try {
          await this.clickhouse.query(`DELETE FROM ${table} WHERE org_id = {orgId:String}`, {
            orgId,
          });
        } catch (error) {
          this.logger.warn(
            `Failed to delete ClickHouse data from ${table} for org ${orgId}: ${error}`,
          );
        }
      }
    }

    // Hard delete PostgreSQL data in a transaction for consistency
    await this.dataSource.transaction(async (manager) => {
      // 1. Widgets (depend on dashboards)
      const dashboards = await manager.find(Dashboard, {
        where: soleOwnerOrgIds.map((org_id) => ({ org_id })),
        withDeleted: true,
      });
      const dashboardIds = dashboards.map((d) => d.id);

      if (dashboardIds.length > 0) {
        await manager
          .createQueryBuilder()
          .delete()
          .from(Widget)
          .where('dashboard_id IN (:...dashboardIds)', { dashboardIds })
          .execute();

        await manager
          .createQueryBuilder()
          .delete()
          .from(DashboardShare)
          .where('dashboard_id IN (:...dashboardIds)', { dashboardIds })
          .execute();
      }

      // 2. AI messages (depend on conversations)
      const conversations = await manager.find(AIConversation, {
        where: { user_id: userId },
      });
      const conversationIds = conversations.map((c) => c.id);

      if (conversationIds.length > 0) {
        await manager
          .createQueryBuilder()
          .delete()
          .from(AIMessage)
          .where('conversation_id IN (:...conversationIds)', { conversationIds })
          .execute();
      }

      // 3. AI conversations
      await manager
        .createQueryBuilder()
        .delete()
        .from(AIConversation)
        .where('user_id = :userId', { userId })
        .execute();

      // 4. Report schedules and reports for sole-owner orgs
      if (soleOwnerOrgIds.length > 0) {
        const reports = await manager.find(Report, {
          where: soleOwnerOrgIds.map((org_id) => ({ org_id })),
        });
        const reportIds = reports.map((r) => r.id);

        if (reportIds.length > 0) {
          await manager
            .createQueryBuilder()
            .delete()
            .from(ReportSchedule)
            .where('report_id IN (:...reportIds)', { reportIds })
            .execute();
        }

        await manager
          .createQueryBuilder()
          .delete()
          .from(Report)
          .where('org_id IN (:...orgIds)', { orgIds: soleOwnerOrgIds })
          .execute();

        // 5. Alert triggers and alerts
        const alerts = await manager.find(Alert, {
          where: soleOwnerOrgIds.map((org_id) => ({ org_id })),
        });
        const alertIds = alerts.map((a) => a.id);

        if (alertIds.length > 0) {
          await manager
            .createQueryBuilder()
            .delete()
            .from(AlertTrigger)
            .where('alert_id IN (:...alertIds)', { alertIds })
            .execute();
        }

        await manager
          .createQueryBuilder()
          .delete()
          .from(Alert)
          .where('org_id IN (:...orgIds)', { orgIds: soleOwnerOrgIds })
          .execute();

        // 6. Data sources and sync jobs
        await manager
          .createQueryBuilder()
          .delete()
          .from(SyncJob)
          .where('org_id IN (:...orgIds)', { orgIds: soleOwnerOrgIds })
          .execute();

        await manager
          .createQueryBuilder()
          .delete()
          .from(DataSourceEntity)
          .where('org_id IN (:...orgIds)', { orgIds: soleOwnerOrgIds })
          .execute();

        // 7. Dashboards
        await manager
          .createQueryBuilder()
          .delete()
          .from(Dashboard)
          .where('org_id IN (:...orgIds)', { orgIds: soleOwnerOrgIds })
          .execute();

        // 8. Notifications
        await manager
          .createQueryBuilder()
          .delete()
          .from(Notification)
          .where('org_id IN (:...orgIds)', { orgIds: soleOwnerOrgIds })
          .execute();

        // 9. Subscriptions
        await manager
          .createQueryBuilder()
          .delete()
          .from(Subscription)
          .where('org_id IN (:...orgIds)', { orgIds: soleOwnerOrgIds })
          .execute();
      }

      // 10. Team members for user
      await manager
        .createQueryBuilder()
        .delete()
        .from(TeamMember)
        .where('user_id = :userId', { userId })
        .execute();

      // 11. Notifications for user (in non-sole-owner orgs)
      await manager
        .createQueryBuilder()
        .delete()
        .from(Notification)
        .where('user_id = :userId', { userId })
        .execute();

      // 12. Organizations where user was sole owner
      if (soleOwnerOrgIds.length > 0) {
        await manager
          .createQueryBuilder()
          .delete()
          .from(Organization)
          .where('id IN (:...orgIds)', { orgIds: soleOwnerOrgIds })
          .execute();
      }

      // 13. Hard delete user
      await manager
        .createQueryBuilder()
        .delete()
        .from(User)
        .where('id = :userId', { userId })
        .execute();

      // 14. Update GDPR request status
      await manager.update(GdprRequest, requestId, {
        status: GdprRequestStatus.COMPLETED,
        completed_at: new Date(),
      });
    });

    // Audit log (audit logs are RETAINED - never deleted, outside transaction)
    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        user_id: null,
        action: 'gdpr_hard_delete',
        entity_type: 'user',
        entity_id: userId,
        details: {
          request_id: requestId,
          sole_owner_orgs_deleted: soleOwnerOrgIds,
        },
      }),
    );

    this.logger.log(`Hard delete completed for user ${userId}`);
  }

  async requestExport(userId: string): Promise<GdprRequest> {
    const request = this.gdprRequestRepo.create({
      user_id: userId,
      type: GdprRequestType.EXPORT,
      status: GdprRequestStatus.PROCESSING,
    });
    const saved = await this.gdprRequestRepo.save(request);

    // Queue export job
    await gdprExportQueue.add(
      'export',
      { userId, requestId: saved.id },
      { jobId: `gdpr-export-${saved.id}` },
    );

    // Audit log
    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        user_id: userId,
        action: 'gdpr_export_request',
        entity_type: 'gdpr_request',
        entity_id: saved.id,
      }),
    );

    this.logger.log(`GDPR export requested for user ${userId}`);
    return saved;
  }

  async generateExport(userId: string, requestId: string): Promise<void> {
    this.logger.log(`Generating GDPR export for user ${userId}, request ${requestId}`);

    // Collect all user data
    const user = await this.userRepo.findOne({
      where: { id: userId },
      withDeleted: true,
    });

    const teamMemberships = await this.teamMemberRepo.find({
      where: { user_id: userId },
      relations: ['organization'],
    });

    const orgIds = teamMemberships.map((tm) => tm.org_id);

    const dashboards =
      orgIds.length > 0
        ? await this.dashboardRepo.find({
            where: orgIds.map((org_id) => ({ org_id })),
            withDeleted: true,
          })
        : [];

    const dashboardIds = dashboards.map((d) => d.id);
    const widgets =
      dashboardIds.length > 0
        ? await this.widgetRepo.find({
            where: dashboardIds.map((dashboard_id) => ({ dashboard_id })),
          })
        : [];

    const reports =
      orgIds.length > 0
        ? await this.reportRepo.find({
            where: orgIds.map((org_id) => ({ org_id })),
          })
        : [];

    const alerts =
      orgIds.length > 0
        ? await this.alertRepo.find({
            where: orgIds.map((org_id) => ({ org_id })),
          })
        : [];

    const conversations = await this.aiConversationRepo.find({
      where: { user_id: userId },
    });
    const conversationIds = conversations.map((c) => c.id);
    const messages =
      conversationIds.length > 0
        ? await this.aiMessageRepo.find({
            where: conversationIds.map((conversation_id) => ({ conversation_id })),
          })
        : [];

    const dataSources =
      orgIds.length > 0
        ? await this.dataSourceRepo.find({
            where: orgIds.map((org_id) => ({ org_id })),
            withDeleted: true,
          })
        : [];

    // Strip credentials from data sources
    const sanitizedDataSources = dataSources.map((ds) => ({
      id: ds.id,
      org_id: ds.org_id,
      type: ds.type,
      name: ds.name,
      config: ds.config,
      status: ds.status,
      last_sync_at: ds.last_sync_at,
      total_rows: ds.total_rows,
      sync_interval_minutes: ds.sync_interval_minutes,
      created_at: ds.created_at,
      updated_at: ds.updated_at,
    }));

    const syncJobs =
      orgIds.length > 0
        ? await this.syncJobRepo.find({
            where: orgIds.map((org_id) => ({ org_id })),
          })
        : [];

    const notifications = await this.notificationRepo.find({
      where: { user_id: userId },
    });

    const auditLogs = await this.auditLogRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });

    // Prepare export data
    const exportData: Record<string, unknown> = {
      profile: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar_url: user.avatar_url,
            preferred_language: user.preferred_language,
            preferred_timezone: user.preferred_timezone,
            is_active: user.is_active,
            created_at: user.created_at,
            updated_at: user.updated_at,
          }
        : null,
      organizations: teamMemberships.map((tm) => ({
        org_id: tm.org_id,
        org_name: tm.organization?.name,
        role: tm.role,
        joined_at: tm.joined_at,
      })),
      dashboards,
      widgets,
      reports,
      alerts,
      ai_conversations: conversations,
      ai_messages: messages,
      data_sources: sanitizedDataSources,
      sync_jobs: syncJobs,
      notifications,
      audit_logs: auditLogs,
    };

    // Create export directory with a timestamped subfolder for JSON files
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportDir = join(process.cwd(), 'uploads', 'gdpr-exports', userId);
    const dataDir = join(exportDir, `data-${timestamp}`);
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    // Write each category as a separate JSON file
    for (const [key, value] of Object.entries(exportData)) {
      writeFileSync(join(dataDir, `${key}.json`), JSON.stringify(value, null, 2), 'utf-8');
    }

    // Create zip archive using system zip command
    const zipFileName = `gdpr-export-${timestamp}.zip`;
    const zipFilePath = join(exportDir, zipFileName);
    execSync(`cd "${dataDir}" && zip -r "${zipFilePath}" .`, {
      timeout: 60000,
    });

    // Update request
    const downloadExpiresAt = new Date();
    downloadExpiresAt.setDate(downloadExpiresAt.getDate() + EXPORT_EXPIRY_DAYS);

    await this.gdprRequestRepo.update(requestId, {
      status: GdprRequestStatus.COMPLETED,
      completed_at: new Date(),
      download_url: zipFilePath,
      download_expires_at: downloadExpiresAt,
    });

    this.logger.log(`GDPR export completed for user ${userId}: ${zipFilePath}`);
  }

  async getExportStatus(userId: string, requestId: string): Promise<GdprRequest> {
    const request = await this.gdprRequestRepo.findOne({
      where: { id: requestId, user_id: userId, type: GdprRequestType.EXPORT },
    });

    if (!request) {
      throw new NotFoundException('Export request not found');
    }

    // Check if download has expired
    if (
      request.status === GdprRequestStatus.COMPLETED &&
      request.download_expires_at &&
      new Date() > request.download_expires_at
    ) {
      await this.gdprRequestRepo.update(requestId, {
        status: GdprRequestStatus.EXPIRED,
      });
      request.status = GdprRequestStatus.EXPIRED;
    }

    return request;
  }

  async getExportDownload(userId: string, requestId: string): Promise<string> {
    const request = await this.getExportStatus(userId, requestId);

    if (request.status !== GdprRequestStatus.COMPLETED) {
      throw new BadRequestException(
        `Export is not available for download (status: ${request.status})`,
      );
    }

    if (!request.download_url) {
      throw new BadRequestException('Export file not found');
    }

    return request.download_url;
  }

  async getDeletionStatus(userId: string): Promise<GdprRequest | null> {
    return this.gdprRequestRepo.findOne({
      where: { user_id: userId, type: GdprRequestType.DELETION },
      order: { created_at: 'DESC' },
    });
  }
}
