import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Resolves "current" in the :orgId route param to the actual org UUID
 * from the X-Org-Id header (set by OrgContextMiddleware).
 * Runs before pipes, so ParseUUIDPipe receives a valid UUID.
 */
@Injectable()
export class ResolveOrgIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();

    if (request.params?.orgId === 'current') {
      const orgId = request.orgId || request.headers['x-org-id'];
      if (orgId) {
        request.params.orgId = orgId;
      }
    }

    return next.handle();
  }
}
