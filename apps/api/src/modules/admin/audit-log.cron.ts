import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuditLogService } from './audit-log.service';

@Injectable()
export class AuditLogCron {
  private readonly logger = new Logger(AuditLogCron.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  @Cron('0 0 1 * *')
  async handleMonthlyCleanup(): Promise<void> {
    this.logger.log('Starting monthly audit log cleanup...');
    try {
      const deleted = await this.auditLogService.cleanupOld();
      this.logger.log(`Monthly audit log cleanup completed: ${deleted} records removed`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Monthly audit log cleanup failed: ${message}`);
    }
  }
}
