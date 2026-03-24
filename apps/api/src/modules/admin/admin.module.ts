import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogService } from './audit-log.service';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { AuditLogSubscriber } from './subscribers/audit-log.subscriber';
import { AuditLogCron } from './audit-log.cron';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Organization } from '../organizations/entities/organization.entity';
import { TeamMember } from '../teams/entities/team-member.entity';
import { DataSource } from '../data-sources/entities/data-source.entity';
import { Dashboard } from '../dashboards/entities/dashboard.entity';
import { Subscription } from '../billing/entities/subscription.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditLog,
      Organization,
      TeamMember,
      DataSource,
      Dashboard,
      Subscription,
    ]),
  ],
  controllers: [AdminController],
  providers: [AuditLogService, AdminService, AuditLogInterceptor, AuditLogSubscriber, AuditLogCron],
  exports: [AuditLogService, AuditLogInterceptor],
})
export class AdminModule {}
