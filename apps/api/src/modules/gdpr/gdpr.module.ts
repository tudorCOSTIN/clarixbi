import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GdprController } from './gdpr.controller';
import { GdprService } from './gdpr.service';
import { GdprHardDeleteProcessor } from './processors/gdpr-hard-delete.processor';
import { GdprExportProcessor } from './processors/gdpr-export.processor';
import { GdprRequest } from './entities/gdpr-request.entity';
import { User } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { TeamMember } from '../teams/entities/team-member.entity';
import { AuditLog } from '../admin/entities/audit-log.entity';
import { Subscription } from '../billing/entities/subscription.entity';
import { DataSource } from '../data-sources/entities/data-source.entity';
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
import { ClickHouseModule } from '../clickhouse/clickhouse.module';
// Queues are initialized on import
import '../sync/queues.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GdprRequest,
      User,
      Organization,
      TeamMember,
      AuditLog,
      Subscription,
      DataSource,
      Dashboard,
      DashboardShare,
      Widget,
      AIConversation,
      AIMessage,
      Report,
      ReportSchedule,
      Alert,
      AlertTrigger,
      Notification,
      SyncJob,
    ]),
    ClickHouseModule,
  ],
  controllers: [GdprController],
  providers: [GdprService, GdprHardDeleteProcessor, GdprExportProcessor],
  exports: [GdprService],
})
export class GdprModule {}
