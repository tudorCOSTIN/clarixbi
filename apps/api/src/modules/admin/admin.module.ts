import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogService } from './audit-log.service';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { AuditLogSubscriber } from './subscribers/audit-log.subscriber';
import { AuditLogCron } from './audit-log.cron';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditLogService, AuditLogInterceptor, AuditLogSubscriber, AuditLogCron],
  exports: [AuditLogService, AuditLogInterceptor],
})
export class AdminModule {}
