import { EntitySubscriberInterface, EventSubscriber, UpdateEvent, RemoveEvent } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

const RETENTION_YEARS = 2;

@EventSubscriber()
export class AuditLogSubscriber implements EntitySubscriberInterface<AuditLog> {
  listenTo() {
    return AuditLog;
  }

  beforeUpdate(_event: UpdateEvent<AuditLog>): void {
    throw new Error('Audit logs are immutable');
  }

  beforeRemove(event: RemoveEvent<AuditLog>): void {
    const entity = event.entity;
    if (!entity) {
      return;
    }

    const createdAt = entity.created_at;
    if (!createdAt) {
      throw new Error('Audit logs cannot be deleted within retention period');
    }

    const retentionCutoff = new Date();
    retentionCutoff.setFullYear(retentionCutoff.getFullYear() - RETENTION_YEARS);

    if (createdAt > retentionCutoff) {
      throw new Error('Audit logs cannot be deleted within retention period');
    }
  }
}
