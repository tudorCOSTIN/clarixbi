import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AuditLogService } from '../audit-log.service';
import { AUDIT_ACTION_KEY } from '../decorators/audit-log.decorator';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.getAllAndOverride<string | undefined>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!action) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        const request = context.switchToHttp().getRequest<Request>();
        const user = request.user as { id?: string } | undefined;
        const params = request.params;

        // Extract entity type and id from route params if available
        const entityType = params['entityType'] ?? params['type'] ?? undefined;
        const entityId = params['id'] ?? params['entityId'] ?? undefined;

        // Extract org_id from params, query, or body
        const orgId =
          params['orgId'] ?? (request.query as Record<string, string>)['orgId'] ?? undefined;

        this.auditLogService.log({
          userId: user?.id ?? null,
          orgId: orgId ?? null,
          action,
          entityType: entityType ?? null,
          entityId: entityId ?? null,
          ipAddress: request.ip ?? request.socket.remoteAddress ?? null,
          userAgent: request.headers['user-agent'] ?? null,
        });
      }),
    );
  }
}
