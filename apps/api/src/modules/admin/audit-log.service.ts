import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export interface AuditLogData {
  userId?: string | null;
  orgId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const RETENTION_YEARS = 2;

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  /**
   * Log an audit event. Fire-and-forget — errors are caught silently.
   */
  log(data: AuditLogData): void {
    this.auditLogRepo
      .save(
        this.auditLogRepo.create({
          user_id: data.userId ?? null,
          org_id: data.orgId ?? null,
          action: data.action,
          entity_type: data.entityType ?? null,
          entity_id: data.entityId ?? null,
          details: data.details ?? null,
          ip_address: data.ipAddress ?? null,
          user_agent: data.userAgent ?? null,
        }),
      )
      .catch((err) => {
        this.logger.error(`Failed to write audit log: ${err.message}`);
      });
  }

  async findByUser(
    userId: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: AuditLog[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.auditLogRepo.findAndCount({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async cleanupOld(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - RETENTION_YEARS);

    const result = await this.auditLogRepo.delete({
      created_at: LessThan(cutoffDate),
    });

    const deleted = result.affected ?? 0;
    this.logger.log(
      `Audit log cleanup: deleted ${deleted} records older than ${cutoffDate.toISOString()}`,
    );
    return deleted;
  }
}
